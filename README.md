# AH-design website

Astro-on-Cloudflare-Pages static site for `ahdesign.website`.

## Stack

- **Astro 5** — static site generator. Pure SSG (`output: 'static'`).
- **Cloudflare Pages** — hosting + automatic builds on `git push`.
- **Cloudflare Pages Functions** (`functions/`) — serverless TypeScript handlers
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
  static/                        CSS, JS, fonts, images (served at /static/*)
  uploads/blog/<slug>/           Blog hero + thumbnail images
  uploads/authors/<slug>/        Author photos
  uploads/cms/                   CMS-uploaded media
  admin/                         Decap CMS UI (index.html + config.yml)
tests/
  visual/                        Playwright visual regression
  unit/                          Vitest unit tests
```

## Local development

```bash
npm install
npx playwright install chromium
npm run dev          # http://localhost:4321
npm run build        # → dist/
npm run preview      # serves dist/
npm run check        # astro check (TS in .astro)
npm run lint
npm run format
npm run test:unit                 # vitest
npm run test:visual               # playwright
npm run test:visual:live          # playwright vs https://ahdesign.website
```

## Cloudflare Pages — required env vars

Set as encrypted secrets in the CF Pages project (Production + Preview):

| Variable | Required | Purpose |
|---|---|---|
| `NODE_VERSION=20` | yes | force Node 20 in builds |
| `PUBLIC_TURNSTILE_SITE_KEY` | yes (forms) | Turnstile widget client key — public, baked at build time |
| `TURNSTILE_SECRET_KEY` | yes (forms) | Turnstile server-side verify secret |
| `TELEGRAM_BOT_TOKEN` | yes (forms) | bot API token |
| `TELEGRAM_CHAT_ID` | yes (forms) | destination chat id |
| `GMAIL_USER` | yes (forms) | sending address, e.g. `info@ahdesign.website` |
| `GMAIL_APP_PASSWORD` | yes (forms) | 16-char App Password from https://myaccount.google.com/apppasswords (requires 2FA) |
| `CONTACT_TO_EMAIL` | optional | recipient — defaults to `GMAIL_USER` |
| `ORIGIN` | optional | reject cross-site posts; e.g. `https://ahdesign.website` |
| `GITHUB_OAUTH_CLIENT_ID` | yes (CMS) | OAuth app client id |
| `GITHUB_OAUTH_CLIENT_SECRET` | yes (CMS) | OAuth app client secret |

### One-time GitHub OAuth app (CMS)

`https://github.com/settings/developers` → New OAuth App.
- Homepage: `https://ahdesign.website`
- Callback: `https://ahdesign.website/api/cms-oauth/callback`

## Editing content

`https://ahdesign.website/admin/` — log in with a GitHub account that has push
access to this repo. Every save commits to `main` and triggers a CF Pages
rebuild.
