# Call booking

The `/call/` page lets a visitor pick a 30 minute slot and get a calendar
invite. It went live on 2026-08-21 in commit `53b961f`.

Setup is **complete**. This file is the reference for changing it and for
working out what is wrong when it misbehaves.

## How it fits together

- `GET /api/slots` — generates slots, subtracts what KV already holds,
  subtracts what Google says you are busy with, returns the rest.
- `POST /api/book` — Turnstile, validation, then reserves the slot in KV
  **before** notifying anyone. If neither Telegram nor our own email gets
  through, the reservation is released and the visitor gets a 502, so no slot
  is ever held for a call we never heard about.

Google is a **secondary** filter. If the lookup fails the page still works and
serves slots from KV alone, because losing the check offers a slot we might be
busy for, while failing the request loses the booking outright. That is
deliberate, and it is why a broken credential is quiet rather than loud. See
"Checking it still works".

The confirmation email carries an `.ics` attachment. That is what removes the
need for write access to anyone's calendar: accepting the invite puts the call
where the next free/busy lookup will see it.

## What is already configured

| Thing        | Value                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| KV namespace | `BOOKINGS` = `59f0676f91884ec5a76e8164f3f054df`                                                                |
| Bound on     | production **and** preview                                                                                     |
| Env vars     | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_IDS` on both environments |

`GOOGLE_CALENDAR_IDS` is comma-separated. `primary` means the main calendar of
whichever Google account minted the refresh token. To check a second person's
calendar, they share theirs with that account at **"See only free/busy (hide
details)"**, then add its id to the list. One token can read both; you never
need a second token.

### Adding bindings later

Do **not** add a `wrangler.toml`. Once a Pages project has one it can become the
source of truth for bindings, and four of the env vars on `ah` are `secret_text`
that nobody, including Cloudflare's API, can read back. Blanking them would take
down both forms and the CMS login.

Use the dashboard, or a `PATCH`, which merges rather than replaces (verified on
a throwaway project first):

```
PATCH https://api.cloudflare.com/client/v4/accounts/<acct>/pages/projects/ah
{"deployment_configs":{"production":{"kv_namespaces":{"NAME":{"namespace_id":"..."}}}}}
```

The `CF_API_TOKEN` in `.env` is purge-only and cannot do this. Use wrangler's
OAuth token from `%APPDATA%/xdg.config/.wrangler/config/default.toml`.

Secrets are easier: `npx wrangler pages secret put NAME --project-name=ah`, then
again with `--env preview`. That flag is missing from `--help` and the docs but
does work. Both are additive; neither disturbs existing values.

**Nothing takes effect until the next deploy.**

## Changing when calls can be booked

`BOOKING_CONFIG` in `src/lib/booking.ts`. Currently 30 minute slots, Tuesday to
Thursday, 10:00-12:00 and 14:00-16:00 Sofia time, 24 hours' notice, 21 days
ahead. Windows are wall-clock local time and the DST arithmetic is handled, so
10:00 stays 10:00 across the March and October changes. Edit and push; the
GitHub connection deploys `main` on its own.

## Checking it still works

**The refresh token is the part that can rot silently.** If the Google OAuth
consent screen was left in "Testing" rather than published, Google expires the
refresh token after about 7 days. The page keeps working and quietly stops
hiding times you are busy.

So the health check is: put an event in your calendar inside one of the windows,
load `/call/`, and confirm that slot disappears. Worth doing around **1
September 2026**, a week or so after setup, and any time the page looks too
available.

To see whether the Google call is actually failing, read the function logs. The
warning is `calendar lookup failed, serving reservations only`.

```
npx wrangler pages deployment tail <deployment-id> --project-name=ah --format=json
```

The deployment id is **required** in a non-interactive shell; without it the
command exits with "Must specify a deployment in non-interactive mode". Get it
from the deployments API or `wrangler pages deployment list`. In the JSON, an
`/api/slots` request with `"logs": []` and `"exceptions": []` means Google
answered fine and you are simply free.

### Testing the live site from a script

Two things that look like breakage and are not:

- `curl` against `ahdesign.website` returns **403** with `cf-mitigated:
challenge`. That is zone bot mitigation. Pass a normal browser `User-Agent`
  and it returns 200.
- The `*.pages.dev` deployment URLs return **302** to
  `cloudflareaccess.com`. They sit behind Cloudflare Access and are not usable
  from a script at all. Test the apex instead.

A real booking still cannot be proven from a script, because Turnstile fails
automated browsers by design. The first live submission by a person is the final
test.

## Running it locally

```
npx wrangler pages dev ./dist --port 8790 --ip 127.0.0.1 \
  --compatibility-date=2026-05-07 \
  --kv BOOKINGS \
  --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Bindings are passed as flags because there is no wrangler config, on purpose.

Turnstile's real site key refuses localhost, so to submit the form locally you
also need the test **site** key baked into the build: set
`PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` before `npm run build`.
A blank value in `.env.local` overrides a `--binding`, so edit or move that file
rather than fighting it, and put it back afterwards.

The Google values only exist as Cloudflare secrets and cannot be read back, so a
local run skips the calendar check and shows every slot. Gmail credentials in
`.env.local` are real: submitting locally sends a genuine email.

If the server prints `Ready on` and then every request hangs, including static
pages, look for leftover `workerd.exe` and `wrangler` processes from earlier
runs. They hold `.wrangler/tmp` and the next start fails to bundle. `pkill` does
not reach them on Windows; use `Get-CimInstance Win32_Process`, filter on the
project path so other projects are left alone, then `Stop-Process -Force` and
`rm -rf .wrangler/tmp`.

## Known limits

Two people booking the same slot within the same second can both succeed: KV has
no compare-and-set. At this volume the Telegram notification catches it, which
is cheaper than the machinery to prevent it.
