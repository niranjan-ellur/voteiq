'use strict';

const config = require('./config');

// ── Security headers ──────────────────────────────────────────────────────────
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://fonts.googleapis.com https://apis.google.com https://www.googletagmanager.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self' https://www.gstatic.com https://translate.googleapis.com https://translate-pa.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://generativelanguage.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com https://www.google-analytics.com https://www.google.com",
    "img-src 'self' data: https://www.gstatic.com https://translate.google.com https://lh3.googleusercontent.com https://fonts.gstatic.com https://maps.gstatic.com https://maps.googleapis.com",
    "frame-src https://voteiq-494318.firebaseapp.com https://accounts.google.com https://www.google.com https://maps.google.com",
    "worker-src 'self' blob:",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
}

// ── In-memory rate limiter ────────────────────────────────────────────────────
const MAX_RATE_LIMIT_ENTRIES = 10000;
const requestCounts = new Map();

function getRateLimitKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    // Basic validation — reject obviously spoofed values
    if (ip && ip.length < 50) return ip;
  }
  return req.socket.remoteAddress || 'unknown';
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
  // Hard cap: if map is still too large, clear oldest entries
  if (requestCounts.size > MAX_RATE_LIMIT_ENTRIES) {
    const excess = requestCounts.size - MAX_RATE_LIMIT_ENTRIES;
    let i = 0;
    for (const key of requestCounts.keys()) {
      if (i++ >= excess) break;
      requestCounts.delete(key);
    }
  }
}, 60 * 1000);

// ── Input sanitization ────────────────────────────────────────────────────────
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .slice(0, config.maxInputLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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
