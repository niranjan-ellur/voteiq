'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.GEMINI_API_KEY = 'test-key';
process.env.PORT = '8099';

const server = require('../server');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 8099,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

after(() => server.close());

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
  });
});

describe('GET /api/languages', () => {
  it('returns supported languages object', async () => {
    const res = await request('GET', '/api/languages');
    assert.equal(res.status, 200);
    assert.ok(res.body.languages);
    assert.ok(res.body.languages.en);
    assert.ok(res.body.languages.hi);
  });
});

describe('Security headers', () => {
  it('includes X-Content-Type-Options nosniff', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('includes X-Frame-Options SAMEORIGIN', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  });

  it('includes Content-Security-Policy', async () => {
    const res = await request('GET', '/health');
    assert.ok(res.headers['content-security-policy']);
    assert.ok(res.headers['content-security-policy'].includes("default-src 'self'"));
  });

  it('includes Referrer-Policy', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  });
});

describe('POST /api/chat validation', () => {
  it('returns 400 for invalid persona', async () => {
    const res = await request('POST', '/api/chat', { persona: 'hacker', message: 'hi', history: [] });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('returns 400 for empty message', async () => {
    const res = await request('POST', '/api/chat', { persona: 'voter', message: '', history: [] });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('returns 400 for missing history', async () => {
    const res = await request('POST', '/api/chat', { persona: 'voter', message: 'hello' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost', port: 8099, path: '/api/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': 5 },
      };
      const req = http.request(options, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write('{bad}');
      req.end();
    });
    assert.equal(res.status, 400);
  });

  it('returns 405 for unsupported method', async () => {
    const res = await request('DELETE', '/api/chat');
    assert.equal(res.status, 405);
  });
});

describe('POST /api/history/save auth', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request('POST', '/api/history/save', { persona: 'voter', role: 'user', text: 'hello' });
    assert.equal(res.status, 401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request('POST', '/api/history/save',
      { persona: 'voter', role: 'user', text: 'hello' },
      { Authorization: 'Bearer invalidtoken' }
    );
    assert.equal(res.status, 401);
  });
});

describe('GET /api/history auth', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request('GET', '/api/history?persona=voter');
    assert.equal(res.status, 401);
  });
});

describe('Static file serving', () => {
  it('returns 200 for GET /', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get('http://localhost:8099/', res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode }));
      }).on('error', reject);
    });
    assert.equal(res.status, 200);
  });

  it('returns 404 for unknown path', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get('http://localhost:8099/nonexistent.xyz', res => {
        resolve({ status: res.statusCode });
        res.resume();
      }).on('error', reject);
    });
    assert.equal(res.status, 404);
  });

  it('prevents path traversal attacks', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get('http://localhost:8099/../../etc/passwd', res => {
        resolve({ status: res.statusCode });
        res.resume();
      }).on('error', reject);
    });
    assert.ok([403, 404].includes(res.status));
  });
});
