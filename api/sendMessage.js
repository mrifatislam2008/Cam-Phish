/**
 * Vercel Serverless Function: /api/sendMessage
 * 
 * Sends text messages to Telegram.
 */

import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.DEFAULT_CHAT_ID || '';
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '30', 10);

const ipCounts = new Map();

function getClientIP(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 60000);
  const key = ip + ':' + now;
  const count = (ipCounts.get(key) || 0) + 1;
  ipCounts.set(key, count);
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
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ ok: false, description: 'Method not allowed' });

  const clientIP = getClientIP(request);
  if (!checkRateLimit(clientIP)) {
    return response.status(429).json({ ok: false, description: 'Rate limit exceeded' });
  }

  if (!BOT_TOKEN) {
    return response.status(500).json({ ok: false, description: 'Server configuration error: BOT_TOKEN not set' });
  }

  try {
    // Read raw body as buffer
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const contentType = request.headers['content-type'] || '';

    let chatId, text, parseMode;

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart (simpler since we only need text fields)
      const boundary = contentType.split('boundary=')[1]?.trim();
      if (!boundary) return response.status(400).json({ ok: false, description: 'Missing boundary' });

      const parts = rawBody.toString('binary').split('--' + boundary);
      for (const part of parts) {
        if (part.trim() === '' || part.trim() === '--') continue;
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headerSection = part.substring(0, headerEnd);
        const nameMatch = headerSection.match(/name="([^"]+)"/);
        if (!nameMatch) continue;
        let value = part.substring(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
        if (nameMatch[1] === 'chat_id') chatId = value;
        if (nameMatch[1] === 'text') text = value;
        if (nameMatch[1] === 'parse_mode') parseMode = value;
      }
    } else {
      // Try JSON or URL-encoded
      try {
        const body = JSON.parse(rawBody.toString('utf-8'));
        chatId = body.chat_id;
        text = body.text;
        parseMode = body.parse_mode;
      } catch {
        const params = new URLSearchParams(rawBody.toString('utf-8'));
        chatId = params.get('chat_id');
        text = params.get('text');
        parseMode = params.get('parse_mode');
      }
    }

    chatId = chatId || DEFAULT_CHAT_ID;
    if (!chatId) return response.status(400).json({ ok: false, description: 'chat_id is required' });
    if (!text?.trim()) return response.status(400).json({ ok: false, description: 'text is required' });

    // Truncate to Telegram's 4096 char limit
    text = text.length > 4000 ? text.substring(0, 4000) + '\n\n… (truncated)' : text;

    const tgForm = new URLSearchParams();
    tgForm.append('chat_id', chatId);
    tgForm.append('text', text);
    if (parseMode) tgForm.append('parse_mode', parseMode);

    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      body: tgForm,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tgResult = await tgResponse.json();
    return response.status(tgResponse.status).json(tgResult);

  } catch (error) {
    console.error('sendMessage error:', error);
    return response.status(500).json({ ok: false, description: 'Internal server error: ' + error.message });
  }
}
