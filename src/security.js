'use strict';

const config = require('./config');

// ── Security headers ──────────────────────────────────────────────────────────
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://translate.google.com https://translate.googleapis.com https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "connect-src 'self' https://translate.googleapis.com; " +
    "img-src 'self' data: https://www.gstatic.com https://translate.google.com;"
  );
}

// ── In-memory rate limiter ────────────────────────────────────────────────────
const requestCounts = new Map();

function getRateLimitKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now - entry.windowStart > config.rateLimit.windowMs) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > config.rateLimit.maxRequests) return true;
  return false;
}

// Cleanup old entries every minute to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - config.rateLimit.windowMs;
  for (const [key, entry] of requestCounts.entries()) {
    if (entry.windowStart < cutoff) requestCounts.delete(key);
  }
}, 60 * 1000);

// ── Input sanitization ────────────────────────────────────────────────────────
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .slice(0, config.maxInputLength)
    .replace(/[<>]/g, ''); // strip angle brackets to prevent HTML injection
}

function validateChatPayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid request body';
  if (!payload.persona || !['voter', 'candidate', 'official'].includes(payload.persona)) {
    return 'Invalid persona';
  }
  if (!payload.message || typeof payload.message !== 'string' || !payload.message.trim()) {
    return 'Message is required';
  }
  if (!Array.isArray(payload.history)) return 'History must be an array';
  if (payload.history.length > 40) return 'History too long';
  return null;
}

module.exports = { applySecurityHeaders, isRateLimited, sanitizeInput, validateChatPayload };
