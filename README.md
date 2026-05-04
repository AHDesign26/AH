# AH-design website

Astro-on-Cloudflare-Pages static site for `ahdesign.website`. Replaces the
former Flask + pypy3 + Docker + Django-blog-API stack (kept on the
`legacy-flask` branch for the rollback window — see "Migration" below).

## Stack

- **Astro 5** — static site generator. `output: 'static'`; pages prerender.
- **Cloudflare Pages** — hosting, automatic builds on `git push`.
- **Cloudflare Pages Functions** — serverless TypeScript handlers under `functions/`
  for form submissions and the Decap CMS OAuth proxy.
- **Decap CMS** at `/admin/` — GitHub-OAuth-authenticated content editor that
  commits straight back to the repo.
- **Cloudflare Turnstile** + honeypot field — spam protection on forms.
- **Gmail SMTP via worker-mailer** — outbound transactional email.
- **Telegram Bot API** — instant form notifications.

## Repo layout

```
src/
  layouts/BaseLayout.astro       Page chrome (header, menu, footer, cursor)
  pages/                         File-based routing
    index.astro                  Homepage
    {about-us, services, ...}.astro
    blog.astro
    post/[slug].astro            Blog post detail
    category/[slug].astro
    author/[id].astro
    404.astro
  content/                       Astro Content Collections (markdown + json)
    blog/<slug>.md
    authors/<slug>.json
    categories/<slug>.json
  lib/                           Server-side helpers (TS)
    spam.ts                      URL regex, honeypot, field allowlist
    turnstile.ts                 CF Turnstile verify
    telegram.ts                  Bot API client
    email.ts                     Gmail SMTP via worker-mailer
functions/
  api/contact.ts                 POST /api/contact
  api/order.ts                   POST /api/order
  api/cms-oauth/[[path]].ts      Decap GitHub OAuth proxy (/auth + /callback)
public/
  static/                        Junction → ../static (Flask-era assets, served as /static/*)
  uploads/blog/<slug>/           Blog hero + thumbnail images
  uploads/authors/<slug>/        Author photos
  uploads/cms/                   CMS-uploaded media
  admin/                         Decap CMS UI (index.html + config.yml)
scripts/
  setup-public-static.{ps1,sh}   Idempotent helper to (re)create the public/static junction
  convert-templates.mjs          One-shot Jinja → Astro converter
  import-blog.mjs                One-shot scraper-output → content collections
tests/
  visual/                        Playwright visual regression vs live site baselines
  unit/                          Vitest unit tests
templates/, static/, app.py, ...   Legacy Flask code — deleted at cutover
```

## Local development

Prereqs: Node 20+, Git, PowerShell or bash.

One-time setup after a fresh clone:

```bash
npm install
npx playwright install chromium
# Recreate the public/static directory junction (needed because static/ is
# the canonical asset location during the migration coexistence period):
#   Windows
.\scripts\setup-public-static.ps1
#   Linux/macOS
./scripts/setup-public-static.sh
```

Run the dev server:

```bash
npm run dev          # http://localhost:4321
```

Build / preview / type-check:

```bash
npm run build        # → dist/
npm run preview      # serves dist/ for parity testing
npm run check        # astro check (TS in .astro)
npm run lint
npm run format
```

Tests:

```bash
npm run test:unit                 # vitest
npm run test:visual               # playwright vs whatever BASE_URL points at
npm run test:visual:live          # vs https://ahdesign.website
npm run test:visual:live:update   # update baselines from the live site
```

## Cloudflare Pages — required env vars

Set as **encrypted secrets** in the CF Pages project settings (Production
+ Preview environments). The site builds without them but the form handlers
and CMS OAuth will return 5xx until they're populated.

| Variable | Purpose |
|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget client key (build-time, public). Defaults to the always-pass dummy key in dev. |
| `TURNSTILE_SECRET_KEY` | Turnstile server-side verification secret. |
| `TELEGRAM_BOT_TOKEN` | Bot API token (existing bot — `pyTelegramBotAPI` was using this in the old stack). |
| `TELEGRAM_CHAT_ID` | Destination chat ID for form notifications. |
| `GMAIL_USER` | Sending Gmail account, e.g. `info@ahdesign.website`. |
| `GMAIL_APP_PASSWORD` | 16-char App Password from https://myaccount.google.com/apppasswords (requires 2FA on the Gmail account). |
| `CONTACT_TO_EMAIL` | Optional — recipient address. Defaults to `GMAIL_USER`. |
| `ORIGIN` | Optional — `https://ahdesign.website`; rejects cross-origin form posts. |
| `GITHUB_OAUTH_CLIENT_ID` | OAuth app client id (CMS). |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth app client secret (CMS). |

### One-time GitHub OAuth app setup (CMS)

1. https://github.com/settings/developers → **New OAuth App**.
2. Application name: `AHDesign CMS`.
3. Homepage URL: `https://ahdesign.website`.
4. Authorization callback URL: `https://ahdesign.website/api/cms-oauth/callback`.
5. Generate a client secret. Copy both values into the CF Pages secrets above.

Decap CMS at `/admin/` will redirect to the proxy, which redirects to GitHub,
which sends the user back to `/api/cms-oauth/callback`. The proxy exchanges
the code for a token and `postMessage`s it to Decap. Anyone with **push
access** to `AHDesign26/AH` can edit content.

### Gmail App Password

CF Workers can't open arbitrary TCP ports for plain SMTP, but
`worker-mailer` uses CF's TCP socket API to talk SMTP to `smtp.gmail.com:465`.
Gmail requires either OAuth2 or an App Password:

1. Enable 2FA on the sending Gmail account.
2. https://myaccount.google.com/apppasswords → generate a 16-char password
   for "Mail" / device "Cloudflare Worker".
3. Paste it into `GMAIL_APP_PASSWORD`.

Alternative if Gmail-via-Workers ever proves flaky: switch `src/lib/email.ts`
to a Resend transactional API call. Resend's free tier covers 3k emails/mo.

## Visual regression workflow

The migration's binary success criterion is "no pixel changes vs the live
site". After each visible change, run:

```bash
npm run test:visual               # default BASE_URL = http://localhost:4321
```

Tolerance is `maxDiffPixels: 100` per page. Failed diffs land in
`test-results/<test>/`; open with `npm run test:visual:report`.

To re-baseline against the live site (only after a deliberate visual change
goes live):

```bash
npm run test:visual:live:update
git add tests/visual/__screenshots__
git commit
```

## Migration

Tracked in `astro-cloudflare-migration-plan.md` at repo root. Branch story:

- `main` — currently still serves the Flask app via `legacy-flask` mirror.
- `astro-migration` — this Astro rewrite (the branch you're on).
- At cutover: `main` is renamed to `legacy-flask`, `astro-migration` becomes
  `main`, the old Flask files (`app.py`, `templates/`, `Dockerfile`,
  `docker-compose.yml`, `bjoern_server.py`) are deleted in a single follow-up
  commit. Legacy branch kept for ~1 month as instant rollback.

## Legacy Flask docs (will be removed at cutover)

The pre-migration deploy/reload guide for the Flask + Docker stack lived
here. Until cutover, the legacy site continues to serve from the Oracle VM
under `legacy-flask`. See that branch's README for the Docker Compose
operational docs.
