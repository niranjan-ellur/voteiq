'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeInput, validateChatPayload } = require('../src/security');

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    assert.equal(sanitizeInput('  hello  '), 'hello');
  });

  it('escapes angle brackets to prevent XSS', () => {
    assert.equal(sanitizeInput('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    assert.equal(sanitizeInput('a & b'), 'a &amp; b');
  });

  it('escapes double quotes', () => {
    assert.equal(sanitizeInput('"hello"'), '&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    assert.equal(sanitizeInput("it's"), 'it&#x27;s');
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

  it('returns empty string for object input', () => {
    assert.equal(sanitizeInput({}), '');
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

  it('rejects non-object payload', () => {
    assert.ok(validateChatPayload('string'));
    assert.ok(validateChatPayload(42));
  });

  it('rejects invalid persona', () => {
    assert.ok(validateChatPayload({ ...valid, persona: 'hacker' }));
  });

  it('rejects missing persona', () => {
    assert.ok(validateChatPayload({ ...valid, persona: undefined }));
  });

  it('accepts all valid personas', () => {
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

  it('rejects non-string message', () => {
    assert.ok(validateChatPayload({ ...valid, message: 123 }));
  });

  it('rejects non-array history', () => {
    assert.ok(validateChatPayload({ ...valid, history: 'bad' }));
    assert.ok(validateChatPayload({ ...valid, history: null }));
  });

  it('rejects history over 40 entries', () => {
    const longHistory = Array.from({ length: 41 }, (_, i) => ({ role: 'user', text: `msg ${i}` }));
    assert.ok(validateChatPayload({ ...valid, history: longHistory }));
  });

  it('accepts history with exactly 40 entries', () => {
    const maxHistory = Array.from({ length: 40 }, (_, i) => ({ role: 'user', text: `msg ${i}` }));
    assert.equal(validateChatPayload({ ...valid, history: maxHistory }), null);
  });
});
