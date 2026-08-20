// Slot reservations in Workers KV.
//
// KV is the authority on what we have booked; Google Calendar only says what
// else we are busy with. Keys are `slot:<ISO instant>` so they sort
// chronologically and a slot can only ever be held once.

import { slotKey } from './booking';

const KEY_PREFIX = 'slot:';
/** Keep a booked slot readable for a week after the call, then let KV drop it. */
const RETAIN_AFTER_MS = 7 * 86_400_000;

export interface Reservation {
  name: string;
  email: string;
  phone: string;
  company?: string;
  topic?: string;
  /** The visitor's own time zone, as reported by their browser. */
  visitorTimeZone?: string;
  createdAt: string;
}

/**
 * Slots already held, as canonical slot keys.
 *
 * One unpaginated list call. Past reservations expire on their own, so the
 * live key count is bounded by how many calls can be booked inside the
 * horizon, which is tens at most.
 */
export async function reservedSlots(kv: KVNamespace): Promise<Set<string>> {
  const listed = await kv.list({ prefix: KEY_PREFIX, limit: 1000 });
  return new Set(listed.keys.map((k) => k.name.slice(KEY_PREFIX.length)));
}

export async function isReserved(kv: KVNamespace, startMs: number): Promise<boolean> {
  return (await kv.get(KEY_PREFIX + slotKey(startMs))) !== null;
}

/**
 * Hold a slot.
 *
 * Deliberately not atomic: KV has no compare-and-set, so two people booking
 * the same slot within the same moment can both succeed. At the volume this
 * page serves, catching that in the Telegram notification is cheaper than the
 * machinery to prevent it.
 */
export async function reserve(
  kv: KVNamespace,
  startMs: number,
  endMs: number,
  reservation: Reservation,
): Promise<void> {
  await kv.put(KEY_PREFIX + slotKey(startMs), JSON.stringify(reservation), {
    expiration: Math.floor((endMs + RETAIN_AFTER_MS) / 1000),
  });
}

/** Give a slot back, used when we could not be told about the booking. */
export async function release(kv: KVNamespace, startMs: number): Promise<void> {
  await kv.delete(KEY_PREFIX + slotKey(startMs));
}
