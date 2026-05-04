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

// Field allowlist — matches the `keys` list in app.py:303. Anything outside
// this list is silently dropped from the message body.
export const ALLOWED_FIELDS = ['name', 'email', 'phone', 'company', 'title', 'message'] as const;

export function buildMessageBody(form: FormData): { body: string; reject: boolean } {
  let reject = false;
  let body = '';
  for (const k of ALLOWED_FIELDS) {
    const v = form.get(k);
    if (v === null) continue;
    const value = String(v);
    if (k !== 'email' && hasUrl(value)) {
      reject = true;
      // Keep walking to log the attempt; the caller decides what to do.
    }
    body += `${k} = ${value}\n`;
  }
  return { body, reject };
}
