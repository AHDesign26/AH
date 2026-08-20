import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FIELDS,
  buildMessageBody,
  findUrlsInString,
  hasUrl,
  honeypotTripped,
  looksLikePhone,
} from '../../src/lib/spam';

describe('looksLikePhone', () => {
  it('accepts the shapes people actually type', () => {
    for (const phone of [
      '+359 88 666 0034',
      '00359886660034',
      '359.88.666.0034',
      '+1 (555) 010-9999',
      '020 7946 0958',
      '+49 30 / 123456',
    ]) {
      expect(looksLikePhone(phone)).toBe(true);
    }
  });

  it('rejects anything carrying letters or a scheme', () => {
    expect(looksLikePhone('call me at example.com')).toBe(false);
    expect(looksLikePhone('https://spam.example')).toBe(false);
    expect(looksLikePhone('0888 buy viagra')).toBe(false);
  });
});

describe('phone is exempt from the URL check', () => {
  it('keeps a dotted number that reads as an IPv4 address', () => {
    // Regression: this shape matches the bare-IP branch of URL_REGEX, and
    // screening it as a URL 403s the whole enquiry over its punctuation.
    expect(hasUrl('359.88.666.0034')).toBe(true);
    const form = new FormData();
    form.set('phone', '359.88.666.0034');
    expect(buildMessageBody(form).reject).toBe(false);
  });

  it('still rejects a link smuggled into the phone field', () => {
    const form = new FormData();
    form.set('phone', 'https://spam.example');
    expect(buildMessageBody(form).reject).toBe(true);
  });
});

describe('findUrlsInString', () => {
  it('returns empty for plain text', () => {
    expect(findUrlsInString('Hello, this is a normal message.')).toEqual([]);
  });

  it('detects http and https URLs', () => {
    expect(findUrlsInString('check http://example.com today')).toContain('http://example.com');
    expect(findUrlsInString('go to https://example.com/path')).toContain(
      'https://example.com/path',
    );
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

  it('flags reject when an identity field contains a URL', () => {
    for (const field of ['name', 'phone', 'company', 'title']) {
      const { reject } = buildMessageBody(
        fd({ name: 'Bot', email: 'b@example.com', [field]: 'https://spam.example/win' }),
      );
      expect(reject, `${field} should be checked for URLs`).toBe(true);
    }
  });

  it('does not flag reject when only the email field contains a URL-shaped value', () => {
    const { reject } = buildMessageBody(fd({ name: 'Real', email: 'foo@bar.com' }));
    expect(reject).toBe(false);
  });

  // The order wizard asks for the customer's website, and people paste links
  // when describing a project. Rejecting those dropped real enquiries.
  it('allows a URL in website_url and in the message', () => {
    const { body, reject } = buildMessageBody(
      fd({
        name: 'Jane',
        email: 'jane@example.org',
        website_url: 'https://janescoffee.com',
        message: 'Has website: yes\nI like the look of stripe.com',
      }),
    );
    expect(reject).toBe(false);
    expect(body).toContain('website_url = https://janescoffee.com\n');
  });

  it('still rejects a bare domain in an identity field', () => {
    const { reject } = buildMessageBody(
      fd({ name: 'Bot', email: 'b@example.com', company: 'cheap-pills.example' }),
    );
    expect(reject).toBe(true);
  });
});

describe('ALLOWED_FIELDS', () => {
  it('is the app.py keys list plus website_url for the order wizard', () => {
    expect([...ALLOWED_FIELDS]).toEqual([
      'name',
      'email',
      'phone',
      'company',
      'website_url',
      'title',
      'message',
    ]);
  });
});
