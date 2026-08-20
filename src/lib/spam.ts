// URL detection — ported from `find_urls_in_string` in app.py:269. Matches
// http(s)/ftp URLs with or without scheme, www-prefixed domains, and bare
// IP-as-host. Used by the form handlers to reject submissions that try to
// smuggle links into non-email fields.

const URL_REGEX =
  /((?:(?:https?|s?ftp):\/\/)?(?:www\.)?((?:(?:[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]\.)+)([A-Za-z]{2,6})|(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))(?::(\d{1,8}))?(?:(\/\S+)*))/g;

export function findUrlsInString(input: string): string[] {
  if (!input) return [];
  return Array.from(input.matchAll(URL_REGEX), (m) => m[0]);
}

export function hasUrl(input: string): boolean {
  return findUrlsInString(input).length > 0;
}

// Honeypot: a hidden field bots will fill, real users will not. The Astro
// pages render an `<input name="website">` with absolute-positioned-offscreen
// styling.  Any non-empty value is a bot.
export function honeypotTripped(value: FormDataEntryValue | null): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

// Field allowlist — matches the `keys` list in app.py:303, plus website_url
// for the order wizard. Anything outside this list is dropped from the body.
export const ALLOWED_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'website_url',
  'title',
  'message',
] as const;

/**
 * Fields where a URL is expected rather than a spam signal.
 *
 * The order wizard asks "do you have a website?" and the contact form invites
 * people to describe a project, so a link in either is normal: redesign and
 * migration enquiries almost always contain one. Rejecting those was dropping
 * exactly the leads the form exists to collect.
 *
 * The check still applies to name, company and title, where a URL has no
 * legitimate use and is a reliable spam tell. Turnstile and the honeypot
 * remain the primary defence. Phone is handled separately, see below.
 */
const URL_ALLOWED_FIELDS: ReadonlySet<string> = new Set(['email', 'website_url', 'message']);

/**
 * Phone gets a positive check rather than the URL one.
 *
 * A number written with dots, like 359.88.666.0034, matches the bare-IPv4
 * branch of URL_REGEX, so screening this field for URLs would 403 a real
 * enquiry over its phone number's punctuation. Digits and separators cannot
 * carry a link: a domain needs letters and a scheme needs a colon and slashes,
 * none of which are allowed through here.
 */
const PHONE_PATTERN = /^[\d\s+().\-/]*$/;

export function looksLikePhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export function buildMessageBody(form: FormData): { body: string; reject: boolean } {
  let reject = false;
  let body = '';
  for (const k of ALLOWED_FIELDS) {
    const v = form.get(k);
    if (v === null) continue;
    const value = String(v);
    if (k === 'phone') {
      if (!looksLikePhone(value)) reject = true;
    } else if (!URL_ALLOWED_FIELDS.has(k) && hasUrl(value)) {
      reject = true;
      // Keep walking to log the attempt; the caller decides what to do.
    }
    body += `${k} = ${value}\n`;
  }
  return { body, reject };
}
