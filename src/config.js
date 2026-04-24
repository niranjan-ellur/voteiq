'use strict';

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  translateApiKey: process.env.TRANSLATE_API_KEY || process.env.GEMINI_API_KEY || '',
  geminiModel: 'gemini-2.5-flash',
  geminiEndpoint: 'generativelanguage.googleapis.com',
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },
  maxInputLength: 1000,
  cacheTtlMs: 5 * 60 * 1000,
};

module.exports = config;
