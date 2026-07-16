/**
 * Vercel Serverless Function: /api/sendPhoto
 * 
 * Receives multipart form data (photo + chat_id + caption)
 * and forwards it to the Telegram Bot API.
 * 
 * The bot token is never exposed to the client.
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.DEFAULT_CHAT_ID || '';
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '30', 10);

// Simple in-memory rate limiting (resets on Vercel cold start — acceptable for this use case)
const ipCounts = new Map();

function getClientIP(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 60000); // current minute
  const key = ip + ':' + now;
  const count = (ipCounts.get(key) || 0) + 1;
  ipCounts.set(key, count);

  // Clean old entries periodically
  if (ipCounts.size > 1000) {
    const currentKey = ip + ':' + now;
    for (const [k] of ipCounts) {
      if (k !== currentKey) ipCounts.delete(k);
    }
  }

  return count <= RATE_LIMIT;
}

export const config = {
  api: {
    bodyParser: false, // We handle multipart manually
  },
};

export default async function handler(request, response) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, description: 'Method not allowed' });
  }

  // Rate limit check
  const clientIP = getClientIP(request);
  if (!checkRateLimit(clientIP)) {
    return response.status(429).json({ ok: false, description: 'Rate limit exceeded' });
  }

  if (!BOT_TOKEN) {
    return response.status(500).json({ ok: false, description: 'Server configuration error: BOT_TOKEN not set' });
  }

  try {
    // Parse multipart form data from the incoming request
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return response.status(400).json({ ok: false, description: 'Content-Type must be multipart/form-data' });
    }

    // Read the raw body as a buffer
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Extract boundary from content-type header
    const boundary = contentType.split('boundary=')[1]?.trim();
    if (!boundary) {
      return response.status(400).json({ ok: false, description: 'Missing boundary in Content-Type' });
    }

    // Parse multipart data manually (avoids heavy dependencies like formidable)
    const fields = {};
    const files = {};

    // Split by boundary
    const parts = rawBody.toString('binary').split('--' + boundary);
    
    for (const part of parts) {
      // Skip boundary markers and empty parts
      if (part.trim() === '' || part.trim() === '--') continue;

      // Split headers from body
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headerSection = part.substring(0, headerEnd);
      const bodySection = part.substring(headerEnd + 4);

      // Remove trailing \r\n and --
      let value = bodySection.replace(/\r\n--$/, '').replace(/\r\n$/, '');

      // Parse Content-Disposition to get field name
      const nameMatch = headerSection.match(/name="([^"]+)"/);
      if (!nameMatch) continue;

      const fieldName = nameMatch[1];

      // Check if this is a file (has filename)
      const filenameMatch = headerSection.match(/filename="([^"]+)"/);

      if (filenameMatch) {
        // This is a file — get the content type and binary data
        const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
        const fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

        // Get binary buffer from the raw body section
        const binaryStart = part.indexOf('\r\n\r\n') + 4;
        const binaryEnd = part.lastIndexOf('\r\n--');
        const binaryPart = part.substring(binaryStart, binaryEnd !== -1 ? binaryEnd : part.length);

        // Convert binary string back to buffer
        const fileBuffer = Buffer.from(binaryPart, 'binary');

        files[fieldName] = {
          filename: filenameMatch[1],
          contentType: fileType,
          data: fileBuffer,
        };
      } else {
        // Regular form field
        fields[fieldName] = value;
      }
    }

    const chatId = fields.chat_id || DEFAULT_CHAT_ID;
    if (!chatId) {
      return response.status(400).json({ ok: false, description: 'chat_id is required' });
    }

    const photo = files.photo;
    if (!photo) {
      return response.status(400).json({ ok: false, description: 'photo file is required' });
    }

    // Validate photo size (Telegram limit: 10MB)
    if (photo.data.length > 10 * 1024 * 1024) {
      return response.status(400).json({ ok: false, description: 'Photo exceeds 10MB limit' });
    }

    // Build FormData for Telegram API
    const tgForm = new FormData();
    tgForm.append('chat_id', chatId);
    tgForm.append('photo', photo.data, {
      filename: photo.filename,
      contentType: photo.contentType,
    });

    const caption = fields.caption || '';
    if (caption) {
      tgForm.append('caption', caption.substring(0, 1024));
      tgForm.append('parse_mode', 'HTML');
    }

    // Send to Telegram
    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: tgForm,
      headers: tgForm.getHeaders(),
    });

    const tgResult = await tgResponse.json();

    if (!tgResult.ok) {
      console.error('Telegram API error:', tgResult);
    }

    return response.status(tgResponse.status).json(tgResult);

  } catch (error) {
    console.error('sendPhoto error:', error);
    return response.status(500).json({ ok: false, description: 'Internal server error: ' + error.message });
  }
}
