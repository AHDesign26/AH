// Cloudflare Pages Function — GET /api/slots.
//
// Returns the intro-call slots that are still free. Google Calendar is a
// best-effort filter: if the lookup fails we still serve slots from KV alone,
// because an occasional slot we have to move by hand beats a booking page
// that shows nothing.

import { BOOKING_CONFIG, filterAvailable, generateSlots, slotKey } from '../../src/lib/booking';
import { fetchBusyIntervals, parseCalendarIds } from '../../src/lib/gcal';
import { reservedSlots } from '../../src/lib/reservations';
import type { Interval } from '../../src/lib/booking';

interface Env {
  BOOKINGS: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_IDS?: string;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx;
  const now = Date.now();
  const slots = generateSlots(now, BOOKING_CONFIG);

  if (slots.length === 0) {
    return json({ timeZone: BOOKING_CONFIG.timeZone, durationMinutes: 0, slots: [] });
  }

  const durationMs = BOOKING_CONFIG.durationMinutes * 60_000;
  const [reserved, busy] = await Promise.all([
    reservedSlots(env.BOOKINGS),
    busyOrEmpty(env, slots[0]!, slots[slots.length - 1]! + durationMs),
  ]);

  const available = filterAvailable(slots, BOOKING_CONFIG.durationMinutes, busy, reserved);

  return json({
    timeZone: BOOKING_CONFIG.timeZone,
    durationMinutes: BOOKING_CONFIG.durationMinutes,
    slots: available.map(slotKey),
  });
};

export async function busyOrEmpty(env: Env, fromMs: number, toMs: number): Promise<Interval[]> {
  const calendarIds = parseCalendarIds(env.GOOGLE_CALENDAR_IDS);
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN ||
    calendarIds.length === 0
  ) {
    return [];
  }
  try {
    return await fetchBusyIntervals(
      {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        refreshToken: env.GOOGLE_REFRESH_TOKEN,
      },
      calendarIds,
      fromMs,
      toMs,
    );
  } catch (err) {
    console.warn('calendar lookup failed, serving reservations only', err);
    return [];
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Availability changes as people book; the zone caches HTML for weeks
      // and would happily do the same here.
      'cache-control': 'no-store',
    },
  });
}
