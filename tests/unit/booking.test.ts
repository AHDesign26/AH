import { describe, expect, it } from 'vitest';
import {
  BOOKING_CONFIG,
  filterAvailable,
  generateSlots,
  parseSlotKey,
  slotKey,
} from '../../src/lib/booking';
import type { BookingConfig } from '../../src/lib/booking';

const HOUR = 3_600_000;

const CONFIG: BookingConfig = {
  timeZone: 'Europe/Sofia',
  durationMinutes: 30,
  leadTimeMinutes: 24 * 60,
  horizonDays: 21,
  // Tuesday and Thursday mornings only, to keep the expectations countable.
  windows: [
    { weekday: 2, start: '10:00', end: '12:00' },
    { weekday: 4, start: '10:00', end: '12:00' },
  ],
};

// A Tuesday, comfortably inside winter time.
const NOW = Date.parse('2026-01-13T09:00:00Z');

describe('generateSlots', () => {
  it('cuts the window into slots of the configured length', () => {
    const slots = generateSlots(NOW, CONFIG);
    const thursday = slots.filter((s) => s < Date.parse('2026-01-16T00:00:00Z'));
    expect(thursday.map(slotKey)).toEqual([
      '2026-01-15T08:00:00.000Z',
      '2026-01-15T08:30:00.000Z',
      '2026-01-15T09:00:00.000Z',
      '2026-01-15T09:30:00.000Z',
    ]);
  });

  it('respects the lead time', () => {
    const slots = generateSlots(NOW, CONFIG);
    expect(Math.min(...slots)).toBeGreaterThanOrEqual(NOW + 24 * HOUR);
    // Today is a Tuesday and its window is inside the lead time, so it is gone.
    expect(slots.some((s) => s < Date.parse('2026-01-14T00:00:00Z'))).toBe(false);
  });

  it('stops at the horizon', () => {
    const slots = generateSlots(NOW, CONFIG);
    expect(Math.max(...slots)).toBeLessThanOrEqual(NOW + 22 * 24 * HOUR);
  });

  it('only uses the configured weekdays', () => {
    for (const slot of generateSlots(NOW, CONFIG)) {
      expect([2, 4]).toContain(new Date(slot).getUTCDay());
    }
  });

  it('holds the local hour steady across the spring DST change', () => {
    const slots = generateSlots(Date.parse('2026-03-24T00:00:00Z'), CONFIG).map(slotKey);
    // Thursday before the change: Sofia is UTC+2, so 10:00 local is 08:00Z.
    expect(slots).toContain('2026-03-26T08:00:00.000Z');
    // Tuesday after it: UTC+3, so the same 10:00 local is 07:00Z.
    expect(slots).toContain('2026-03-31T07:00:00.000Z');
  });

  it('returns nothing when no window matches', () => {
    expect(generateSlots(NOW, { ...CONFIG, windows: [] })).toEqual([]);
  });

  it('drops a window too short for one slot', () => {
    const tooShort = { ...CONFIG, windows: [{ weekday: 2, start: '10:00', end: '10:20' }] };
    expect(generateSlots(NOW, tooShort)).toEqual([]);
  });

  it('returns ascending instants', () => {
    const slots = generateSlots(NOW, BOOKING_CONFIG);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
  });
});

describe('filterAvailable', () => {
  const slots = [
    Date.parse('2026-01-15T08:00:00Z'),
    Date.parse('2026-01-15T08:30:00Z'),
    Date.parse('2026-01-15T09:00:00Z'),
  ];

  it('keeps everything when nothing conflicts', () => {
    expect(filterAvailable(slots, 30, [], new Set())).toEqual(slots);
  });

  it('drops slots we already reserved', () => {
    const reserved = new Set(['2026-01-15T08:30:00.000Z']);
    expect(filterAvailable(slots, 30, [], reserved).map(slotKey)).toEqual([
      '2026-01-15T08:00:00.000Z',
      '2026-01-15T09:00:00.000Z',
    ]);
  });

  it('drops slots overlapping a busy interval', () => {
    const busy = [
      { start: Date.parse('2026-01-15T08:15:00Z'), end: Date.parse('2026-01-15T08:45:00Z') },
    ];
    expect(filterAvailable(slots, 30, busy, new Set()).map(slotKey)).toEqual([
      '2026-01-15T09:00:00.000Z',
    ]);
  });

  it('treats touching intervals as free, not busy', () => {
    // A meeting ending exactly when a slot starts does not collide with it.
    const busy = [
      { start: Date.parse('2026-01-15T07:30:00Z'), end: Date.parse('2026-01-15T08:00:00Z') },
    ];
    expect(filterAvailable(slots, 30, busy, new Set())).toEqual(slots);
  });

  it('drops a slot swallowed by an all-day event', () => {
    const busy = [
      { start: Date.parse('2026-01-15T00:00:00Z'), end: Date.parse('2026-01-16T00:00:00Z') },
    ];
    expect(filterAvailable(slots, 30, busy, new Set())).toEqual([]);
  });
});

describe('slotKey / parseSlotKey', () => {
  it('round-trips', () => {
    const ms = Date.parse('2026-01-15T08:00:00Z');
    expect(parseSlotKey(slotKey(ms))).toBe(ms);
  });

  it('rejects junk', () => {
    expect(parseSlotKey('not a date')).toBeNull();
    expect(parseSlotKey('')).toBeNull();
  });

  it('rejects non-canonical spellings of a real instant', () => {
    // Otherwise two different strings could name the same slot and each get
    // its own KV key, letting the slot be booked twice.
    expect(parseSlotKey('2026-01-15T08:00:00Z')).toBeNull();
    expect(parseSlotKey('2026-01-15T10:00:00+02:00')).toBeNull();
  });
});
