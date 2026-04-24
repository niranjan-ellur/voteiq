'use strict';

const { isRateLimited, sanitizeInput, validateChatPayload } = require('./security');
const { chat } = require('./gemini');
const { translate, SUPPORTED_LANGUAGES } = require('./translate');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8192) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleChat(req, res) {
  if (isRateLimited(req)) {
    return json(res, 429, { error: 'Too many requests. Please wait a moment and try again.' });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (err) {
    return json(res, 400, { error: err.message });
  }

  const validationError = validateChatPayload(payload);
  if (validationError) return json(res, 400, { error: validationError });

  const message = sanitizeInput(payload.message);
  const { persona, history, lang } = payload;

  try {
    const result = await chat(persona, message, history);

    // Translate reply if user has selected a non-English language
    // Always keep the original English reply separate so frontend stores it in history
    if (lang && lang !== 'en') {
      try {
        result.englishReply = result.reply; // frontend stores this in chatHistory
        result.reply = await translate(result.reply, lang);
        result.translated = true;
        result.lang = lang;
      } catch {
        result.translateError = true;
      }
    }

    return json(res, 200, result);
  } catch (err) {
    return json(res, 502, { error: err.message });
  }
}

async function handleTranslate(req, res) {
  if (isRateLimited(req)) {
    return json(res, 429, { error: 'Too many requests.' });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (err) {
    return json(res, 400, { error: err.message });
  }

  const { text, lang } = payload;
  if (!text || typeof text !== 'string') return json(res, 400, { error: 'text is required' });
  if (!lang || !SUPPORTED_LANGUAGES[lang]) return json(res, 400, { error: 'Invalid language code' });

  try {
    const translated = await translate(sanitizeInput(text), lang);
    return json(res, 200, { translated, lang });
  } catch (err) {
    return json(res, 502, { error: err.message });
  }
}

function handleLanguages(res) {
  json(res, 200, { languages: SUPPORTED_LANGUAGES });
}

function handleHealth(res) {
  json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
}

module.exports = { handleChat, handleTranslate, handleLanguages, handleHealth };
