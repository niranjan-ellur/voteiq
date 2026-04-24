'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeInput, validateChatPayload } = require('../src/security');

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    assert.equal(sanitizeInput('  hello  '), 'hello');
  });

  it('strips angle brackets', () => {
    assert.equal(sanitizeInput('<script>alert(1)</script>'), 'scriptalert(1)/script');
  });

  it('truncates to maxInputLength', () => {
    const long = 'a'.repeat(2000);
    assert.equal(sanitizeInput(long).length, 1000);
  });

  it('returns empty string for non-string input', () => {
    assert.equal(sanitizeInput(null), '');
    assert.equal(sanitizeInput(undefined), '');
    assert.equal(sanitizeInput(123), '');
  });
});

describe('validateChatPayload', () => {
  const valid = { persona: 'voter', message: 'How do I register?', history: [] };

  it('accepts valid payload', () => {
    assert.equal(validateChatPayload(valid), null);
  });

  it('rejects null payload', () => {
    assert.ok(validateChatPayload(null));
  });

  it('rejects invalid persona', () => {
    assert.ok(validateChatPayload({ ...valid, persona: 'hacker' }));
  });

  it('rejects all valid personas individually', () => {
    for (const p of ['voter', 'candidate', 'official']) {
      assert.equal(validateChatPayload({ ...valid, persona: p }), null);
    }
  });

  it('rejects empty message', () => {
    assert.ok(validateChatPayload({ ...valid, message: '   ' }));
  });

  it('rejects missing message', () => {
    assert.ok(validateChatPayload({ ...valid, message: undefined }));
  });

  it('rejects non-array history', () => {
    assert.ok(validateChatPayload({ ...valid, history: 'bad' }));
  });

  it('rejects history over 40 entries', () => {
    const longHistory = Array.from({ length: 41 }, (_, i) => ({ role: 'user', text: `msg ${i}` }));
    assert.ok(validateChatPayload({ ...valid, history: longHistory }));
  });
});
