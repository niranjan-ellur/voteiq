'use strict';

const config = require('./config');

const MAX_ENTRIES = 100;
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
  // Move to end (LRU — most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function set(persona, message, value) {
  const key = getCacheKey(persona, message);
  // Evict least recently used (first inserted entry) when at capacity
  if (cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, timestamp: Date.now() });
}

function size() {
  return cache.size;
}

module.exports = { get, set, size };
