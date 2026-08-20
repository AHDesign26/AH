// Google Calendar free/busy lookup, read-only.
//
// There is no Google Workspace behind ahdesign.website (mail is forwarded by
// ImprovMX and sent from a personal Gmail account), so a service account with
// domain-wide delegation is not available. This uses an installed-app OAuth
// refresh token instead, minted once by scripts/google-oauth.mjs.
//
// Caller is expected to treat a throw as "no calendar information" and carry
// on, not as a failed request. Losing this check offers a slot we might be
// busy for; failing the request loses the booking outright.

import type { Interval } from './booking';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const TIMEOUT_MS = 6_000;

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

async function accessToken(creds: GoogleCredentials): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // A refresh token issued while the OAuth consent screen is still in
    // "Testing" expires after about a week, and this is where that shows up.
    throw new Error(`google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('google token exchange returned no access_token');
  return data.access_token;
}

/** Busy intervals across every given calendar, merged into one flat list. */
export async function fetchBusyIntervals(
  creds: GoogleCredentials,
  calendarIds: string[],
  fromMs: number,
  toMs: number,
): Promise<Interval[]> {
  if (calendarIds.length === 0) return [];

  const token = await accessToken(creds);
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      items: calendarIds.map((id) => ({ id })),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`google freebusy failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };

  const intervals: Interval[] = [];
  for (const [id, calendar] of Object.entries(data.calendars ?? {})) {
    // A calendar the token cannot see reports an error and an empty busy list,
    // which would otherwise read as "completely free" and offer every slot.
    if (calendar.errors?.length) {
      throw new Error(`google freebusy error for ${id}: ${JSON.stringify(calendar.errors)}`);
    }
    for (const period of calendar.busy ?? []) {
      const start = Date.parse(period.start);
      const end = Date.parse(period.end);
      if (!Number.isNaN(start) && !Number.isNaN(end)) intervals.push({ start, end });
    }
  }
  return intervals;
}

/** Split the comma-separated CALENDAR_IDS env var. */
export function parseCalendarIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
