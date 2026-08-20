# Call booking setup

The `/call/` page needs one KV binding and four env vars. Until they are set the
page still works: it serves slots from KV alone and simply does not know about
anything else in your calendars.

Nothing here is in a `wrangler.toml` on purpose. Adding one to a Pages project
can make the config file the source of truth for bindings, and four of the
eleven env vars on `ah` are `secret_text` that nobody, including Cloudflare's
API, can read back. If a deploy blanked them the contact form, the order form
and the CMS login would all break and three secrets would need regenerating.
Dashboard bindings are additive and carry none of that risk.

## 1. Bind the KV namespace

The namespace already exists:

| Name       | ID                                 |
| ---------- | ---------------------------------- |
| `BOOKINGS` | `59f0676f91884ec5a76e8164f3f054df` |

Cloudflare dashboard, Workers & Pages, project `ah`, Settings, Functions, KV
namespace bindings. Add the same binding to **both** Production and Preview:

- Variable name: `BOOKINGS`
- KV namespace: `BOOKINGS`

## 2. Google Calendar credentials

In [console.cloud.google.com](https://console.cloud.google.com):

1. Create a project and enable the **Google Calendar API**.
2. OAuth consent screen: External, add both Google accounts as test users, then
   **publish it**. Left in "Testing", Google expires the refresh token after
   about a week and availability quietly stops reflecting your calendars. That
   is the one part of this that can rot silently.
3. Credentials, Create OAuth client ID, **Desktop app**. Copy the id and secret.

Then run, once per Google account whose calendar should be checked:

```
node scripts/google-oauth.mjs <client-id> <client-secret>
```

It opens a consent flow, prints a refresh token, and lists the calendar ids that
token can read.

## 3. Pages env vars

Add to Production and Preview, then **deploy** (editing an env var does nothing
until the next deploy):

| Variable               | Value                                            |
| ---------------------- | ------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | from step 2                                      |
| `GOOGLE_CLIENT_SECRET` | from step 2, mark as secret                      |
| `GOOGLE_REFRESH_TOKEN` | from the script, mark as secret                  |
| `GOOGLE_CALENDAR_IDS`  | comma-separated calendar ids, usually the emails |

A refresh token belongs to one account. To check two calendars from one token,
share the second calendar with the first account and list both ids here.

## Changing when calls can be booked

`BOOKING_CONFIG` in `src/lib/booking.ts`. Currently 30 minute slots, Tuesday to
Thursday, 10:00-12:00 and 14:00-16:00 Sofia time, 24 hours' notice, 21 days
ahead. Windows are wall-clock local time and the DST arithmetic is handled, so
10:00 stays 10:00 across the March and October changes.

## Running it locally

```
npx wrangler pages dev ./dist --port 8790 --ip 127.0.0.1 \
  --compatibility-date=2026-05-07 \
  --kv BOOKINGS \
  --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Post `cf-turnstile-response=XXXX.DUMMY.TOKEN.XXXX` to exercise the real handler.
Move `.env` and `.env.local` aside first unless you want it sending real mail.

If the server answers `Ready on` but every request then hangs, check for
leftover `workerd.exe` and `wrangler` processes from earlier runs; they hold
`.wrangler/tmp` and the next start fails to bundle.

## What the endpoints do

- `GET /api/slots` — generated slots, minus KV reservations, minus Google busy
  time. A Google failure is logged and ignored rather than failing the request.
- `POST /api/book` — Turnstile, validation, then reserve in KV **before**
  notifying. If neither Telegram nor our own email gets through, the reservation
  is released and the visitor gets a 502, so no slot is held for a call we never
  heard about.

Two people booking the same slot in the same second can both succeed: KV has no
compare-and-set. At this volume the Telegram notification catches it.
