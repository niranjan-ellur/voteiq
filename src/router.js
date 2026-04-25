'use strict';

const { isRateLimited, sanitizeInput, validateChatPayload } = require('./security');
const { chat } = require('./gemini');
const { translate, SUPPORTED_LANGUAGES } = require('./translate');

const VALID_ROLES = new Set(['user', 'model']);
const VALID_PERSONAS = new Set(['voter', 'candidate', 'official']);

let firebaseAdmin = null;
function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    try { firebaseAdmin = require('./firebase-admin'); } catch { /* not configured */ }
  }
  return firebaseAdmin;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 8192) { req.destroy(); reject(new Error('Request body too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getAuthToken(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function handleChat(req, res) {
  if (isRateLimited(req)) {
    return json(res, 429, { error: 'Too many requests. Please wait a moment and try again.' });
  }

  let payload;
  try { payload = await readBody(req); }
  catch (err) { return json(res, 400, { error: err.message }); }

  const validationError = validateChatPayload(payload);
  if (validationError) return json(res, 400, { error: validationError });

  const message = sanitizeInput(payload.message);
  const { persona, history } = payload;
  const lang = typeof payload.lang === 'string' && SUPPORTED_LANGUAGES[payload.lang] ? payload.lang : 'en';

  try {
    const result = await chat(persona, message, history);

    if (lang !== 'en') {
      try {
        result.englishReply = result.reply;
        result.reply = await translate(result.reply, lang);
        result.translated = true;
        result.lang = lang;
      } catch {
        result.translateError = true;
      }
    }

    return json(res, 200, result);
  } catch (err) {
    return json(res, 502, { error: 'AI service unavailable. Please try again.' });
  }
}

async function handleSaveMessage(req, res) {
  if (isRateLimited(req)) return json(res, 429, { error: 'Too many requests.' });

  const idToken = getAuthToken(req);
  if (!idToken) return json(res, 401, { error: 'Unauthorized' });

  let payload;
  try { payload = await readBody(req); }
  catch (err) { return json(res, 400, { error: err.message }); }

  const { persona, role, text } = payload;
  if (!VALID_PERSONAS.has(persona)) return json(res, 400, { error: 'Invalid persona' });
  if (!VALID_ROLES.has(role)) return json(res, 400, { error: 'Invalid role' });
  if (!text || typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text is required' });

  const fb = getFirebaseAdmin();
  if (!fb) return json(res, 200, { ok: true });

  try {
    const decoded = await fb.verifyIdToken(idToken);
    await fb.saveMessage(decoded.uid, persona, role, sanitizeInput(text));
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 401, { error: 'Invalid or expired token' });
  }
}

async function handleLoadHistory(req, res) {
  const idToken = getAuthToken(req);
  if (!idToken) return json(res, 401, { error: 'Unauthorized' });

  const url = new URL(req.url, 'http://localhost');
  const persona = url.searchParams.get('persona');
  if (!VALID_PERSONAS.has(persona)) return json(res, 400, { error: 'Invalid persona' });

  const fb = getFirebaseAdmin();
  if (!fb) return json(res, 200, { history: [] });

  try {
    const decoded = await fb.verifyIdToken(idToken);
    const history = await fb.loadChatHistory(decoded.uid, persona);
    return json(res, 200, { history });
  } catch {
    return json(res, 401, { error: 'Invalid or expired token' });
  }
}

async function handleTranslate(req, res) {
  if (isRateLimited(req)) return json(res, 429, { error: 'Too many requests.' });

  let payload;
  try { payload = await readBody(req); }
  catch (err) { return json(res, 400, { error: err.message }); }

  const { text, lang } = payload;
  if (!text || typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text is required' });
  if (!lang || !SUPPORTED_LANGUAGES[lang]) return json(res, 400, { error: 'Invalid language code' });

  try {
    const translated = await translate(sanitizeInput(text), lang);
    return json(res, 200, { translated, lang });
  } catch {
    return json(res, 502, { error: 'Translation service unavailable.' });
  }
}

const LANGUAGES_RESPONSE = JSON.stringify({ languages: SUPPORTED_LANGUAGES });

function handleLanguages(res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(LANGUAGES_RESPONSE);
}

function handleHealth(res) {
  json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
}

module.exports = {
  handleChat, handleSaveMessage, handleLoadHistory,
  handleTranslate, handleLanguages, handleHealth,
};
