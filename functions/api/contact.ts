// Cloudflare Pages Function — POST /api/contact.
//
// Replaces app.py's page_handler() form branch (the `forms = ['order',
// 'contact']` path). Same lifecycle:
//
//   1. Reject if honeypot field is filled (silent — no Telegram, no email).
//   2. Verify Cloudflare Turnstile token. Reject 403 on failure.
//   3. URL-detect non-email fields. Reject 403 on a hit.
//   4. Build the message body from the field allowlist.
//   5. Send Telegram notification + Gmail email in parallel.
//   6. Return JSON {success: true} (matches the existing front-end contract).

import { findUrlsInString, honeypotTripped, buildMessageBody } from '../../src/lib/spam';
import { verifyTurnstile } from '../../src/lib/turnstile';
import { sendTelegram } from '../../src/lib/telegram';
import { sendEmail } from '../../src/lib/email';

interface Env {
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  CONTACT_TO_EMAIL?: string;
  ORIGIN?: string;
}

type Ctx = EventContext<Env, never, Record<string, unknown>>;

export const onRequestPost: PagesFunction<Env> = async (ctx: Ctx) => {
  return handle(ctx, 'Contact');
};

export async function handle(ctx: Ctx, formName: 'Contact' | 'Order'): Promise<Response> {
  const { request, env } = ctx;

  // Origin check — drop cross-site posts.
  if (env.ORIGIN) {
    const origin = request.headers.get('origin');
    if (origin && origin !== env.ORIGIN) {
      return json({ error: 'bad-origin' }, 403);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'bad-form' }, 400);
  }

  // Honeypot — silent reject.
  if (honeypotTripped(form.get('website'))) {
    return json({ success: true }, 200);
  }

  // Turnstile.
  const token = form.get('cf-turnstile-response');
  const remoteIp = request.headers.get('cf-connecting-ip') ?? undefined;
  const verify = await verifyTurnstile(
    typeof token === 'string' ? token : null,
    env.TURNSTILE_SECRET_KEY,
    remoteIp,
  );
  if (!verify.success) {
    return json({ error: 'captcha-failed', codes: verify.errorCodes }, 403);
  }

  // URL-in-non-email-field check.
  const { body: msgBody, reject } = buildMessageBody(form);
  if (reject) {
    return json({ error: 'url-in-field' }, 403);
  }

  const subject = `New ${formName}Form`;
  const fullText = `${subject}\n${msgBody}`;

  // Send to Telegram + Gmail concurrently. Both legs are bounded: SMTP talks
  // over a raw socket and a stalled conversation used to hold the whole
  // request open, leaving the visitor watching a "Sending..." button that
  // never resolved while the Telegram copy had already arrived.
  const [tg, email] = await Promise.allSettled([
    withTimeout(
      sendTelegram({
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_CHAT_ID,
        text: fullText,
      }),
      TELEGRAM_TIMEOUT_MS,
      'telegram',
    ),
    withTimeout(
      sendEmail({
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
        to: env.CONTACT_TO_EMAIL ?? env.GMAIL_USER,
        from: env.GMAIL_USER,
        fromName: 'AHDesign Website',
        subject,
        text: fullText,
        replyTo: typeof form.get('email') === 'string' ? String(form.get('email')) : undefined,
      }),
      EMAIL_TIMEOUT_MS,
      'email',
    ),
  ]);

  // sendTelegram resolves with {ok:false} for an API-level rejection instead
  // of throwing, so a settled promise is not proof of delivery.
  const telegramDelivered = tg.status === 'fulfilled' && tg.value.ok === true;
  const emailDelivered = email.status === 'fulfilled';

  // Log failures via console so they show up in CF Pages logs.
  if (!telegramDelivered) {
    console.warn('telegram failed', tg.status === 'rejected' ? tg.reason : tg.value);
  }
  if (!emailDelivered) console.warn('email failed', email.reason);

  // The enquiry is only lost if both channels failed. Treating email as
  // authoritative meant a flaky SMTP leg showed the visitor an error after
  // Telegram had already delivered the lead, so they submitted again and we
  // got duplicates.
  if (!telegramDelivered && !emailDelivered) {
    return json({ error: 'delivery-failed' }, 502);
  }
  return json({ success: true }, 200);
}

// Telegram is a single HTTPS call; SMTP needs a handshake, auth and a data
// phase, so it gets longer. Both are well inside what a visitor will wait.
const TELEGRAM_TIMEOUT_MS = 8_000;
const EMAIL_TIMEOUT_MS = 12_000;

/** Reject rather than hang, so one stalled channel cannot hold the request. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Reference required so eslint doesn't complain about unused import in some
// build modes; findUrlsInString isn't used here directly but is available to
// callers that might want to log details.
void findUrlsInString;
