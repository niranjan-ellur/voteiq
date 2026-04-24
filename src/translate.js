'use strict';

const https = require('https');
const config = require('./config');

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
    const path = `/language/translate/v2?key=${config.translateApiKey}`;

    const options = {
      hostname: 'translation.googleapis.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const translated = parsed.data?.translations?.[0]?.translatedText;
          resolve(translated || text);
        } catch {
          reject(new Error('Failed to parse Translation API response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('Translation request timed out')));
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
