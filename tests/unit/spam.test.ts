import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FIELDS,
  buildMessageBody,
  findUrlsInString,
  hasUrl,
  honeypotTripped,
} from '../../src/lib/spam';

describe('findUrlsInString', () => {
  it('returns empty for plain text', () => {
    expect(findUrlsInString('Hello, this is a normal message.')).toEqual([]);
  });

  it('detects http and https URLs', () => {
    expect(findUrlsInString('check http://example.com today')).toContain('http://example.com');
    expect(findUrlsInString('go to https://example.com/path')).toContain('https://example.com/path');
  });

  it('detects bare domains and www-prefixed hosts', () => {
    expect(hasUrl('see example.com')).toBe(true);
    expect(hasUrl('see www.example.com')).toBe(true);
  });

  it('detects raw IPv4 addresses', () => {
    expect(hasUrl('connect to 192.168.1.1')).toBe(true);
  });

  it('does not flag normal punctuation that looks domain-ish', () => {
    expect(hasUrl('cost is 1.50 today')).toBe(false);
    expect(hasUrl('we love AH.')).toBe(false);
  });
});

describe('honeypotTripped', () => {
  it('returns false for null/empty', () => {
    expect(honeypotTripped(null)).toBe(false);
    expect(honeypotTripped('')).toBe(false);
    expect(honeypotTripped('   ')).toBe(false);
  });
  it('returns true for any non-blank value', () => {
    expect(honeypotTripped('http://spammer.example')).toBe(true);
    expect(honeypotTripped('x')).toBe(true);
  });
});

describe('buildMessageBody', () => {
  function fd(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.append(k, v);
    return f;
  }

  it('emits only allowed fields, in canonical order', () => {
    const { body, reject } = buildMessageBody(
      fd({
        message: 'hi there',
        name: 'Alice',
        email: 'a@example.com',
        extraneous: 'should be dropped',
      }),
    );
    expect(reject).toBe(false);
    // canonical order from ALLOWED_FIELDS
    expect(body).toContain('name = Alice\n');
    expect(body).toContain('email = a@example.com\n');
    expect(body).toContain('message = hi there\n');
    expect(body).not.toContain('extraneous');
    // name appears before message in the output
    expect(body.indexOf('name')).toBeLessThan(body.indexOf('message'));
  });

  it('flags reject when a non-email field contains a URL', () => {
    const { reject } = buildMessageBody(
      fd({ name: 'Bot', email: 'b@example.com', message: 'visit https://spam.example/win' }),
    );
    expect(reject).toBe(true);
  });

  it('does not flag reject when only the email field contains a URL-shaped value', () => {
    const { reject } = buildMessageBody(fd({ name: 'Real', email: 'foo@bar.com' }));
    expect(reject).toBe(false);
  });
});

describe('ALLOWED_FIELDS', () => {
  it('matches the keys list from app.py exactly', () => {
    expect([...ALLOWED_FIELDS]).toEqual(['name', 'email', 'phone', 'company', 'title', 'message']);
  });
});
