'use strict';

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const { applySecurityHeaders } = require('./src/security');
const {
  handleChat, handleSaveMessage, handleLoadHistory,
  handleTranslate, handleLanguages, handleHealth,
} = require('./src/router');

const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function serveStatic(req, res, urlPath) {
  const safePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, safePath);

  // Prevent path traversal — resolved path must be inside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.resolve(PUBLIC_DIR, 'index.html')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

function applyCors(req, res) {
  const origin = req.headers['origin'];
  const allowed = config.allowedOrigin;

  if (allowed && origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
  } else if (!allowed) {
    // Dev mode: no restriction
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);
  applyCors(req, res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (req.method === 'POST' && pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'POST' && pathname === '/api/history/save') return handleSaveMessage(req, res);
  if (req.method === 'GET'  && pathname === '/api/history') return handleLoadHistory(req, res);
  if (req.method === 'POST' && pathname === '/api/translate') return handleTranslate(req, res);
  if (req.method === 'GET'  && pathname === '/api/languages') return handleLanguages(res);
  if (req.method === 'GET'  && pathname === '/health') return handleHealth(res);
  if (req.method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(config.port, () => {
  console.log(`VoteIQ running on http://localhost:${config.port}`);
});

module.exports = server;
