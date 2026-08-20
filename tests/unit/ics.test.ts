import { describe, expect, it } from 'vitest';
import { buildIcs, toBase64 } from '../../src/lib/ics';
import type { IcsEvent } from '../../src/lib/ics';

const EVENT: IcsEvent = {
  uid: 'call-1@ahdesign.website',
  startMs: Date.parse('2026-01-15T08:00:00Z'),
  endMs: Date.parse('2026-01-15T08:30:00Z'),
  stampMs: Date.parse('2026-01-14T12:00:00Z'),
  summary: 'Intro call: AH Design & Jane Doe',
  description: 'Line one\nLine two',
  organizer: { name: 'AH Design', email: 'info@ahdesign.website' },
  attendee: { name: 'Jane Doe', email: 'jane@example.com' },
};

function lines(ics: string): string[] {
  // Unfold first: continuation lines start with a single space.
  return ics.replace(/\r\n /g, '').split('\r\n');
}

describe('buildIcs', () => {
  it('wraps a single VEVENT in a VCALENDAR', () => {
    const out = lines(buildIcs(EVENT));
    expect(out[0]).toBe('BEGIN:VCALENDAR');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('END:VEVENT');
    expect(out.filter(Boolean).at(-1)).toBe('END:VCALENDAR');
  });

  it('uses CRLF endings, as the spec requires', () => {
    expect(
      buildIcs(EVENT)
        .split('\n')
        .every((l) => l === '' || l.endsWith('\r')),
    ).toBe(true);
  });

  it('writes UTC timestamps without punctuation', () => {
    const out = lines(buildIcs(EVENT));
    expect(out).toContain('DTSTART:20260115T080000Z');
    expect(out).toContain('DTEND:20260115T083000Z');
    expect(out).toContain('DTSTAMP:20260114T120000Z');
  });

  it('escapes commas, semicolons, backslashes and newlines', () => {
    const out = lines(buildIcs({ ...EVENT, summary: 'a,b;c\\d', description: 'one\ntwo' }));
    expect(out).toContain('SUMMARY:a\\,b\\;c\\\\d');
    expect(out).toContain('DESCRIPTION:one\\ntwo');
  });

  it('carries organizer and attendee as mailto values', () => {
    const out = lines(buildIcs(EVENT));
    expect(out).toContain('ORGANIZER;CN=AH Design:mailto:info@ahdesign.website');
    expect(
      out.some((l) => l.startsWith('ATTENDEE;') && l.endsWith(':mailto:jane@example.com')),
    ).toBe(true);
  });

  it('omits DESCRIPTION when there is none', () => {
    expect(buildIcs({ ...EVENT, description: undefined })).not.toContain('DESCRIPTION');
  });

  it('folds long lines to 75 octets and unfolds back to the original', () => {
    const summary = 'A'.repeat(200);
    const ics = buildIcs({ ...EVENT, summary });
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(lines(ics)).toContain(`SUMMARY:${summary}`);
  });

  it('never splits a multi-byte character while folding', () => {
    const summary = 'Ѝ'.repeat(120);
    const ics = buildIcs({ ...EVENT, summary });
    expect(ics).not.toContain('�');
    expect(lines(ics)).toContain(`SUMMARY:${summary}`);
  });
});

describe('toBase64', () => {
  it('round-trips ASCII', () => {
    expect(atob(toBase64('BEGIN:VCALENDAR'))).toBe('BEGIN:VCALENDAR');
  });

  it('handles non-ASCII that would break btoa on its own', () => {
    expect(() => toBase64('Отчет')).not.toThrow();
    const bytes = Uint8Array.from(atob(toBase64('Отчет')), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe('Отчет');
  });
});
