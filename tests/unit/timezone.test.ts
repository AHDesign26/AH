import { describe, expect, it } from 'vitest';
import { toWallClock, wallClockToUtc, zoneOffsetMs } from '../../src/lib/timezone';

const SOFIA = 'Europe/Sofia';
const HOUR = 3_600_000;

describe('toWallClock', () => {
  it('reads local time, not UTC', () => {
    const w = toWallClock(Date.parse('2026-01-15T10:00:00Z'), SOFIA);
    expect(w).toMatchObject({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 });
  });

  it('reports weekday with Sunday as 0', () => {
    expect(toWallClock(Date.parse('2026-03-29T12:00:00Z'), SOFIA).weekday).toBe(0);
    expect(toWallClock(Date.parse('2026-09-01T12:00:00Z'), SOFIA).weekday).toBe(2);
  });

  it('reports midnight as hour 0, not 24', () => {
    // 22:00 UTC in winter is midnight in Sofia; some ICU builds say "24".
    expect(toWallClock(Date.parse('2026-01-14T22:00:00Z'), SOFIA).hour).toBe(0);
  });
});

describe('zoneOffsetMs', () => {
  it('is +2h in winter and +3h in summer', () => {
    expect(zoneOffsetMs(Date.parse('2026-01-15T10:00:00Z'), SOFIA)).toBe(2 * HOUR);
    expect(zoneOffsetMs(Date.parse('2026-07-15T10:00:00Z'), SOFIA)).toBe(3 * HOUR);
  });

  it('ignores the sub-second part of the instant', () => {
    const base = Date.parse('2026-01-15T10:00:00Z');
    expect(zoneOffsetMs(base + 750, SOFIA)).toBe(zoneOffsetMs(base, SOFIA));
  });
});

describe('wallClockToUtc', () => {
  it('maps winter wall-clock time at UTC+2', () => {
    expect(wallClockToUtc(2026, 3, 28, 10, 0, SOFIA)).toBe(Date.parse('2026-03-28T08:00:00Z'));
  });

  it('maps summer wall-clock time at UTC+3', () => {
    expect(wallClockToUtc(2026, 3, 29, 10, 0, SOFIA)).toBe(Date.parse('2026-03-29T07:00:00Z'));
  });

  it('gets the day after the autumn change right', () => {
    expect(wallClockToUtc(2026, 10, 26, 10, 0, SOFIA)).toBe(Date.parse('2026-10-26T08:00:00Z'));
  });

  it('round-trips through toWallClock across the year', () => {
    for (const [month, day] of [
      [1, 15],
      [3, 28],
      [3, 29],
      [7, 15],
      [10, 25],
      [10, 26],
      [12, 31],
    ]) {
      const utc = wallClockToUtc(2026, month!, day!, 10, 30, SOFIA);
      const back = toWallClock(utc, SOFIA);
      expect([back.month, back.day, back.hour, back.minute]).toEqual([month, day, 10, 30]);
    }
  });

  it('is a no-op offset for UTC itself', () => {
    expect(wallClockToUtc(2026, 6, 1, 9, 15, 'UTC')).toBe(Date.parse('2026-06-01T09:15:00Z'));
  });
});
