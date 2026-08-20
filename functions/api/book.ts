// Cloudflare Pages Function — POST /api/book.
//
// Books one intro call. The slot is reserved in KV before anything is sent, so
// a slow mail leg cannot let a second visitor take the same time. If we then
// fail to hear about the booking on every channel, the reservation is released
// again rather than left holding a call nobody knows about.

import { BOOKING_CONFIG, generateSlots, parseSlotKey, slotKey } from '../../src/lib/booking';
import { buildIcs, toBase64 } from '../../src/lib/ics';
import { hasUrl, honeypotTripped, looksLikePhone } from '../../src/lib/spam';
import { verifyTurnstile } from '../../src/lib/turnstile';
import { sendTelegram } from '../../src/lib/telegram';
import { sendEmail } from '../../src/lib/email';
import { withTimeout } from '../../src/lib/timeout';
import { isReserved, release, reserve } from '../../src/lib/reservations';
import { toWallClock } from '../../src/lib/timezone';
import { busyOrEmpty } from './slots';

interface Env {
  BOOKINGS: KVNamespace;
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  CONTACT_TO_EMAIL?: string;
  ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_IDS?: string;
}

const TELEGRAM_TIMEOUT_MS = 8_000;
const EMAIL_TIMEOUT_MS = 12_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (env.ORIGIN) {
    const origin = request.headers.get('origin');
    if (origin && origin !== env.ORIGIN) return json({ error: 'bad-origin' }, 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'bad-form' }, 400);
  }

  if (honeypotTripped(form.get('website'))) return json({ success: true }, 200);

  const verify = await verifyTurnstile(
    typeof form.get('cf-turnstile-response') === 'string'
      ? String(form.get('cf-turnstile-response'))
      : null,
    env.TURNSTILE_SECRET_KEY,
    request.headers.get('cf-connecting-ip') ?? undefined,
  );
  if (!verify.success) return json({ error: 'captcha-failed', codes: verify.errorCodes }, 403);

  const name = text(form, 'name');
  const email = text(form, 'email');
  const phone = text(form, 'phone');
  const company = text(form, 'company');
  const topic = text(form, 'topic');
  const visitorTimeZone = text(form, 'visitor_timezone');

  if (
    !name ||
    !EMAIL_PATTERN.test(email) ||
    !looksLikePhone(phone) ||
    phone.replace(/\D/g, '').length < 6
  ) {
    return json({ error: 'invalid-details' }, 400);
  }
  // A URL has no business in either of these; the topic is free prose and may
  // legitimately contain one, matching how the contact form treats `message`.
  if (hasUrl(name) || hasUrl(company)) {
    return json({ error: 'url-in-field' }, 403);
  }

  // Only ever book a slot the rules actually generate. Without this the
  // request could name any instant it liked.
  const startMs = parseSlotKey(text(form, 'slot'));
  if (startMs === null || !generateSlots(Date.now(), BOOKING_CONFIG).includes(startMs)) {
    return json({ error: 'slot-unavailable' }, 409);
  }
  const endMs = startMs + BOOKING_CONFIG.durationMinutes * 60_000;

  if (await isReserved(env.BOOKINGS, startMs)) return json({ error: 'slot-taken' }, 409);

  const busy = await busyOrEmpty(env, startMs, endMs);
  if (busy.some((b) => startMs < b.end && endMs > b.start)) {
    return json({ error: 'slot-taken' }, 409);
  }

  const reservation = {
    name,
    email,
    phone,
    ...(company ? { company } : {}),
    ...(topic ? { topic } : {}),
    ...(visitorTimeZone ? { visitorTimeZone } : {}),
    createdAt: new Date().toISOString(),
  };
  await reserve(env.BOOKINGS, startMs, endMs, reservation);

  const ourAddress = env.CONTACT_TO_EMAIL ?? env.GMAIL_USER;
  const localTime = formatLocal(startMs, BOOKING_CONFIG.timeZone);
  const summary = `Intro call: AH Design & ${name}`;
  const invite = buildIcs({
    uid: `call-${slotKey(startMs)}@ahdesign.website`,
    startMs,
    endMs,
    stampMs: Date.now(),
    summary,
    description: [
      `${BOOKING_CONFIG.durationMinutes} minute intro call.`,
      `Phone: ${phone}`,
      topic ? `Topic: ${topic}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    organizer: { name: 'AH Design', email: ourAddress },
    attendee: { name, email },
  });
  const attachments = [
    { filename: 'call.ics', content: toBase64(invite), mimeType: 'text/calendar; method=REQUEST' },
  ];

  const detail = [
    `When: ${localTime} (${BOOKING_CONFIG.timeZone})`,
    `Slot: ${slotKey(startMs)}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    company ? `Company: ${company}` : '',
    topic ? `Topic: ${topic}` : '',
    visitorTimeZone ? `Their time zone: ${visitorTimeZone}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const [tg, ours, theirs] = await Promise.allSettled([
    withTimeout(
      sendTelegram({
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_CHAT_ID,
        text: `New Call Booking\n${detail}`,
      }),
      TELEGRAM_TIMEOUT_MS,
      'telegram',
    ),
    withTimeout(
      sendEmail({
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
        to: ourAddress,
        from: env.GMAIL_USER,
        fromName: 'AHDesign Website',
        subject: `Call booked — ${localTime}`,
        text: detail,
        replyTo: email,
        attachments,
      }),
      EMAIL_TIMEOUT_MS,
      'email-internal',
    ),
    withTimeout(
      sendEmail({
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
        to: email,
        from: env.GMAIL_USER,
        fromName: 'AH Design',
        subject: `Your call with AH Design — ${localTime}`,
        text: visitorEmail(name, localTime, phone),
        replyTo: ourAddress,
        attachments,
      }),
      EMAIL_TIMEOUT_MS,
      'email-visitor',
    ),
  ]);

  // sendTelegram resolves with {ok:false} on an API-level rejection rather
  // than throwing, so a settled promise is not proof of delivery.
  const weWereTold =
    (tg.status === 'fulfilled' && tg.value.ok === true) || ours.status === 'fulfilled';
  if (!weWereTold) {
    console.error('booking notifications all failed, releasing slot', slotKey(startMs));
    await release(env.BOOKINGS, startMs);
    return json({ error: 'delivery-failed' }, 502);
  }
  if (theirs.status === 'rejected') {
    // Their copy is a courtesy; the on-screen confirmation already stands and
    // we have the booking either way.
    console.warn('visitor confirmation email failed', theirs.reason);
  }

  return json({ success: true, slot: slotKey(startMs), localTime }, 200);
};

function visitorEmail(name: string, localTime: string, phone: string): string {
  return [
    `Hi ${name.split(' ')[0]},`,
    '',
    `Your call with AH Design is booked for ${localTime} (Sofia time). The`,
    `calendar invite is attached, and we will call you on ${phone}.`,
    '',
    'If that time stops working, just reply to this email and we will move it.',
    '',
    'AH Design',
    'https://ahdesign.website',
  ].join('\n');
}

function formatLocal(ms: number, timeZone: string): string {
  const w = toWallClock(ms, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
