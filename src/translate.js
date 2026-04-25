'use strict';

const https = require('https');
const config = require('./config');

const TRANSLATE_TIMEOUT_MS = 10000;

const SUPPORTED_LANGUAGES = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  mr: 'मराठी',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
  pa: 'ਪੰਜਾਬੀ',
  ur: 'اردو',
};

function callTranslateApi(text, targetLang) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ q: text, target: targetLang, format: 'text' });

    const options = {
      hostname: 'translation.googleapis.com',
      path: `/language/translate/v2?key=${config.translateApiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (parsed.error) return reject(new Error(parsed.error.message));
          const translated = parsed.data?.translations?.[0]?.translatedText;
          resolve(translated || text);
        } catch {
          reject(new Error('Failed to parse Translation API response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TRANSLATE_TIMEOUT_MS, () => req.destroy(new Error('Translation request timed out')));
    req.write(body);
    req.end();
  });
}

async function translate(text, targetLang) {
  if (!targetLang || targetLang === 'en') return text;
  if (!SUPPORTED_LANGUAGES[targetLang]) return text;
  return callTranslateApi(text, targetLang);
}

module.exports = { translate, SUPPORTED_LANGUAGES };
