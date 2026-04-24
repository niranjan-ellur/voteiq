'use strict';

const config = require('./config');

// Simple LRU-style in-memory cache for Gemini responses
const cache = new Map();

function getCacheKey(persona, message) {
  return `${persona}::${message.toLowerCase().trim()}`;
}

function get(persona, message) {
  const key = getCacheKey(persona, message);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > config.cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function set(persona, message, value) {
  // Keep cache under 100 entries
  if (cache.size >= 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(getCacheKey(persona, message), { value, timestamp: Date.now() });
}

function size() {
  return cache.size;
}

module.exports = { get, set, size };
