// Wall-clock <-> UTC conversion for a named IANA time zone, using only Intl.
//
// The booking windows are written as local Sofia wall-clock times ("Tuesday
// 10:00"), but slots have to be stored and compared as absolute instants.
// Europe/Sofia is UTC+2 in winter and UTC+3 in summer, so a fixed offset would
// silently shift every slot by an hour twice a year.

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Constructing an Intl.DateTimeFormat is expensive relative to using one, and
// slot generation calls this a few hundred times per request. Keyed by zone
// name, which only ever comes from the booking config, so it cannot grow.
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = FORMATTERS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATTERS.set(timeZone, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

/** What a clock on the wall in `timeZone` reads at the given instant. */
export function toWallClock(utcMs: number, timeZone: string): WallClock {
  const lookup: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    // Some ICU builds render midnight as hour 24 rather than 0.
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: WEEKDAY_INDEX[lookup.weekday ?? ''] ?? 0,
  };
}

/** The zone's UTC offset, in milliseconds, at the given instant. */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const w = toWallClock(utcMs, timeZone);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // formatToParts resolves to whole seconds, so compare against a truncated
  // instant or every offset comes out wrong by the millisecond remainder.
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The instant at which a clock in `timeZone` reads the given wall-clock time.
 *
 * Two passes: the first guesses the offset by treating the wall-clock reading
 * as UTC, the second re-reads the offset at the corrected instant. That second
 * pass is what makes the hour around a DST transition come out right, because
 * the offset before and after the jump differ.
 *
 * Times inside a spring-forward gap do not exist; this returns the instant
 * just past the gap rather than throwing. No booking window is configured
 * across 03:00, so that case is theoretical here.
 */
export function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(firstPass, timeZone);
}
