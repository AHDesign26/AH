// Call-booking rules: which slots exist, and which of them are still free.
//
// Pure functions only. The Google Calendar lookup and the KV reservations live
// in functions/api/, so all of the arithmetic here is testable without network
// or bindings.

import { toWallClock, wallClockToUtc } from './timezone';

export interface BookingWindow {
  /** 0 = Sunday, matching Date#getUTCDay. */
  weekday: number;
  /** Local wall-clock "HH:MM" in the config's time zone. */
  start: string;
  end: string;
}

export interface BookingConfig {
  timeZone: string;
  durationMinutes: number;
  /** How far ahead of now the earliest bookable slot sits. */
  leadTimeMinutes: number;
  /** How many days of availability to offer. */
  horizonDays: number;
  windows: BookingWindow[];
}

export interface Interval {
  start: number;
  end: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Intro calls. Narrow windows on purpose: the point is that every offered slot
 * is one we will actually turn up to. Widen `windows` rather than adding
 * machinery if that stops being enough.
 */
export const BOOKING_CONFIG: BookingConfig = {
  timeZone: 'Europe/Sofia',
  durationMinutes: 30,
  leadTimeMinutes: 24 * 60,
  horizonDays: 21,
  windows: [
    { weekday: 2, start: '10:00', end: '12:00' },
    { weekday: 2, start: '14:00', end: '16:00' },
    { weekday: 3, start: '10:00', end: '12:00' },
    { weekday: 3, start: '14:00', end: '16:00' },
    { weekday: 4, start: '10:00', end: '12:00' },
    { weekday: 4, start: '14:00', end: '16:00' },
  ],
};

function parseHourMinute(hm: string): [number, number] {
  const [h, m] = hm.split(':');
  return [Number(h), Number(m)];
}

/**
 * Every slot the windows imply between the lead time and the horizon, as UTC
 * milliseconds, ascending. Says nothing about whether a slot is free.
 */
export function generateSlots(nowMs: number, cfg: BookingConfig): number[] {
  const earliest = nowMs + cfg.leadTimeMinutes * MINUTE_MS;
  const durationMs = cfg.durationMinutes * MINUTE_MS;
  const today = toWallClock(nowMs, cfg.timeZone);

  // A cursor over calendar dates, not instants: adding a day to a UTC midnight
  // always lands on the next date, which walking real instants would not do
  // across a DST change.
  const firstDate = Date.UTC(today.year, today.month - 1, today.day);
  const slots: number[] = [];

  for (let i = 0; i <= cfg.horizonDays; i++) {
    const date = new Date(firstDate + i * DAY_MS);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();

    for (const window of cfg.windows) {
      if (window.weekday !== weekday) continue;
      const [startHour, startMinute] = parseHourMinute(window.start);
      const [endHour, endMinute] = parseHourMinute(window.end);
      const windowStart = wallClockToUtc(year, month, day, startHour, startMinute, cfg.timeZone);
      const windowEnd = wallClockToUtc(year, month, day, endHour, endMinute, cfg.timeZone);

      for (let t = windowStart; t + durationMs <= windowEnd; t += durationMs) {
        if (t >= earliest) slots.push(t);
      }
    }
  }

  return slots.sort((a, b) => a - b);
}

function overlaps(start: number, end: number, busy: Interval): boolean {
  return start < busy.end && end > busy.start;
}

/**
 * Drop slots already reserved by us, or that collide with something in a
 * calendar we were given.
 */
export function filterAvailable(
  slots: number[],
  durationMinutes: number,
  busy: Interval[],
  reserved: ReadonlySet<string>,
): number[] {
  const durationMs = durationMinutes * MINUTE_MS;
  return slots.filter((start) => {
    if (reserved.has(slotKey(start))) return false;
    const end = start + durationMs;
    return !busy.some((b) => overlaps(start, end, b));
  });
}

/** Canonical KV key and wire format for a slot. */
export function slotKey(startMs: number): string {
  return new Date(startMs).toISOString();
}

/** Parse a slot key back, rejecting anything not exactly canonical. */
export function parseSlotKey(value: string): number | null {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return slotKey(ms) === value ? ms : null;
}
