# newAH → Astro migration plan

Reference doc for resuming this work in a future chat. Written 2026-05-04 against
commits up to `03defa0` (current `main` of `AHDesign26/AH`).

## Goal

Replace the Flask + pypy3 + Bjoern + Redis + Django-blog-API stack with a
statically-built Astro site, keeping the existing visual design **pixel-identical**.
Forms continue to send Telegram notifications + email. Blog content (currently
recovered from web.archive.org and held in the sibling `blog_django_backend`
repo's `scraper/output/`) gets baked into the repo as Astro Content Collections.
A CMS at `/admin/` with GitHub OAuth login lets non-developers edit page text
and blog posts; the CMS commits straight to the repo.

## Confirmed decisions

| Topic | Decision |
|---|---|
| Framework | Astro 5, mostly SSG, Cloudflare adapter |
| Hosting | **Open — see "Hosting alternatives" below.** Originally Cloudflare Pages; user is now reconsidering due to GitHub Business paywall confusion. |
| Form endpoints | Pages Functions (or equivalent) — TypeScript |
| Email | Gmail SMTP via `worker-mailer` (Cloudflare TCP sockets API). User must generate a Gmail App Password (requires 2FA) and store it as a Pages env secret at deploy time. Fallback if Gmail-via-Workers proves fragile: Resend (free 3k/mo). |
| Anti-spam | Cloudflare Turnstile + hidden honeypot field + URL-in-non-email-fields regex (port the existing rule from `app.py`) |
| CMS | **Decap CMS** at `/admin/` + a small Cloudflare Worker as the GitHub OAuth proxy (~50 LOC, well-documented pattern). GitHub login. Saves commit straight to the repo. Any GitHub user with push access can log in. |
| Blog source of truth | Markdown in `src/content/blog/*.md` — Astro Content Collections. Edited by Decap. |
| Page text source of truth | YAML/JSON in `src/content/pages/` so non-dev edits work via Decap. |
| Image storage | `public/uploads/blog/<slug>/{hero,thumbnail}.<ext>` and `public/uploads/authors/<slug>/photo.<ext>`. Decap uploads into `public/uploads/cms/`. |
| Cache layer | Dropped (Redis db=1, `data_getter()`, `cloudflare_clear()`, `/hook`, `HOOK_SECRET` — all gone) |
| Cutover branch | `astro-migration` of `AHDesign26/AH` |
| At cutover | Flask code preserved on `legacy-flask` branch for ~1 month, then deleted |
| URL preservation | Required: `/post/<slug>`, `/blog`, `/about-us`, `/ads-service`, `/contact`, `/order`, `/price`, `/projects`, `/services`, `/web_development`, `/category/<slug>`, `/author/<id>` |
| Visual fidelity | Binary success criterion — Playwright pixel-diff vs golden masters captured from current live site. Threshold: `maxDiffPixels: 100` per page. |
| Analytics | Cloudflare Web Analytics (free, no cookies) |
| Cutover style | Stage on preview URL → user smoke tests → user flips DNS |

## Blog migration source

Use `D:/projects_new/blog_django_backend/scraper/output/` directly — **do not**
go through the live Django API. The scraper output has:

- 7 posts as `posts/<slug>/{post.json, body.html, hero.<ext>, thumbnail.<ext>}`
- 2 authors as `authors/<slug>/{meta.json, photo.<ext>}`
- 1 category at `categories.json`
- Already cleaned: Wayback prefixes stripped, `loading="lazy"` removed, etc.

`post.json` keys map 1:1 onto Astro frontmatter. Body HTML preserves Quill-style
nested `<span style="...">` wrappers — **do not "clean" these without
testing rendering** (per `blog_incident.md`).

Inline base64 images in `body.html` stay inline (faithful to the source).

Special case: Ivaylo Papazov's "photo" is an MP4 — drop it (importer did the
same). Author still gets created, no avatar.

## Repo strategy during migration

`astro-migration` branch coexists Astro + Flask:

- All Flask files (`app.py`, `templates/`, `Dockerfile`, `docker-compose.yml`,
  `bjoern_server.py`, `wait-for-postgres.sh`, etc.) stay where they are.
- New Astro files (`astro.config.mjs`, `package.json`, `src/`, `public/`,
  `tsconfig.json`, etc.) added alongside.
- At cutover, one commit on `main` deletes the Flask files.
- `main` immediately before that cutover is renamed/branched to `legacy-flask`
  for the rollback window.

## File layout (target)

```
.
├── astro-cloudflare-migration-plan.md   # this file
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── playwright.config.ts
├── public/
│   ├── static/                          # css, js, fonts copied verbatim from current Flask static/
│   ├── uploads/
│   │   ├── blog/<slug>/{hero,thumbnail}.<ext>
│   │   ├── authors/<slug>/photo.<ext>
│   │   └── cms/                         # CMS-uploaded media
│   └── admin/                           # Decap CMS HTML+JS (also OAuth callback served by Worker)
├── src/
│   ├── content/
│   │   ├── config.ts                    # collection schemas
│   │   ├── blog/<slug>.md               # post body + frontmatter
│   │   ├── authors/<slug>.json
│   │   ├── categories/<slug>.json
│   │   └── pages/<slug>.yaml            # page text (about-us, services, etc.)
│   ├── layouts/BaseLayout.astro         # the <html><head><body> shell (port of base.html)
│   ├── components/                      # nav, footer, cursor, service card, etc.
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about-us.astro
│   │   ├── ads-service.astro
│   │   ├── contact.astro
│   │   ├── order.astro
│   │   ├── price.astro
│   │   ├── projects.astro
│   │   ├── services.astro
│   │   ├── web_development.astro
│   │   ├── blog/index.astro
│   │   ├── post/[slug].astro
│   │   ├── category/[slug].astro
│   │   ├── author/[id].astro
│   │   ├── api/contact.ts               # form endpoint (POST)
│   │   ├── api/order.ts                 # form endpoint (POST)
│   │   └── api/cms-oauth/[...slug].ts   # Decap OAuth proxy
│   └── lib/
│       ├── email.ts                     # worker-mailer wrapper
│       ├── telegram.ts                  # bot.send_message equivalent
│       ├── spam.ts                      # honeypot + URL-regex check + Turnstile verify
│       └── cms-auth.ts
├── scripts/
│   └── import-blog.ts                   # one-off: scraper/output/ → src/content/blog/
├── tests/
│   └── visual/                          # Playwright suite (see below)
├── .github/workflows/
│   └── ci.yml                           # lint + types + unit + playwright
└── .gitignore                           # adds dist/, .astro/, node_modules/, test-results/, playwright-report/
```

## Visual regression strategy

Source of truth: the live site at `https://ahdesign.website`.

1. **Baseline capture** — run Playwright against the live site to populate
   `tests/visual/__screenshots__/`. Commit the snapshots.
2. **During migration** — after each page is converted, re-run the suite
   pointed at the local Astro dev server (`http://localhost:4321`). Diff
   threshold: `maxDiffPixels: 100` per page (tolerates anti-aliasing noise
   only). Any larger diff = the page is rejected, fix before moving on.
3. **At preview deploy** — re-run against the CF Pages preview URL.

Test surface (full detail in `tests/visual/`):

- Full-page snapshots of every public route at three viewports: desktop
  (1920×1080), tablet (768×1024), mobile (375×667 — iPhone SE-class).
- Focused snapshot of the homepage banner — verifies the mix-blend-mode
  split (left half of "Expanding Possibilities" reads black on white, right
  half reads white on black).
- Per-card hover snapshots of all four service cards. The two with the
  inverted PNG icons (Advertising Solutions, Business Development) are
  asserted separately to confirm the red accent survives `invert(1) hue-rotate(180deg)`.
- Custom cursor follower (`.vlt-cursor`) — assert it becomes visible /
  scaled when the pointer enters a `.has-cursor` element.
- Mobile menu open/close.
- Form pages render (no submit — submit happens in integration tests).

## Quality gates (CI)

Run on every push and PR:

| Gate | Tool | Purpose |
|---|---|---|
| Format | Prettier | Consistent style |
| Lint | ESLint + `eslint-plugin-astro` | TS/Astro lint |
| Types | `astro check` | TS in `.astro` files |
| Unit | Vitest | `lib/spam.ts` URL regex, honeypot logic, frontmatter parsers |
| Visual | Playwright | Pixel-diff vs golden masters |
| A11y | axe-core via Playwright | No new violations vs baseline |
| Lighthouse | `@lhci/cli` (optional) | Perf score not regressed |

## Form security

- **Honeypot**: hidden `<input name="website" tabindex="-1" autocomplete="off">`
  styled `position:absolute;left:-9999px;`. Submissions where this is non-empty
  are silently rejected (no Telegram, no email).
- **Turnstile**: invisible challenge, server-verified.
- **URL regex**: existing `find_urls_in_string()` ported to TS. If non-empty for
  any field except `email`, reject with 403.
- **Rate limit**: Cloudflare WAF rule, 5 form submissions per IP per hour.
- **Origin check**: reject if `Origin` header isn't the production domain.
- **Field allowlist**: only `name, email, phone, company, title, message`
  (existing `keys` list in `app.py`); ignore extras.

## Phased execution plan

Each phase ends with a commit + visual diff before moving on.

- **P0** Capture Playwright baselines from live site. (This task is being
  scaffolded now.)
- **P1** Bootstrap Astro project skeleton. Lint, format, TS, Vitest, Playwright,
  CI workflow. Static assets copied verbatim into `public/static/`.
- **P2** Convert layout + nav + footer + cursor. Visual diff homepage shell.
- **P3** Convert each page in order: `index`, `about-us`, `services`,
  `web_development`, `ads-service`, `projects`, `price`, `contact`, `order`,
  404 handler. Visual diff after each.
- **P4** Decap CMS + GitHub OAuth Worker proxy. Page text moved into Content
  Collections. Visual diff (refactor, no rendered change).
- **P5** Blog migration: `import-blog.ts` reads `scraper/output/`. Build
  `/blog`, `/post/[slug]`, `/category/[slug]`, `/author/[id]`. Visual diff.
- **P6** Form workers (`/api/contact`, `/api/order`). Honeypot + Turnstile +
  URL regex + Telegram + Gmail. Vitest unit tests. Playwright integration
  test (mocked Telegram + Gmail).
- **P7** Full-site Playwright + Lighthouse + a11y. Deploy to preview URL.
- **P8** User smoke tests on preview. DNS flip. Old Flask stays up 7 days.
- **P9** Decommission: delete Flask files on `main` (after the rename to
  `legacy-flask`), `docker compose down` on the Oracle VM.

## Hosting alternatives (this is currently open)

User is reconsidering due to GitHub Business paywall. Three viable paths:

### A. Cloudflare Pages + free GitHub (recommended, original plan)

Free GitHub personal/org accounts work — **GitHub Business is not required**.
The "GitHub Business" paywall the user hit is for SAML SSO, audit log, etc.,
none of which are needed here. CF Pages connects to free private GitHub repos
without paying GitHub. Free CF Pages: unlimited bandwidth, 500 builds/month,
100k Worker requests/day. **Build / deploy / host all free.**

### B. Cloudflare Pages + non-GitHub source

If the user wants to avoid GitHub entirely:

- Source code on **GitLab** (free private repos + free CI 400 min/month) or
  Bitbucket or self-hosted Gitea
- Build runs in GitLab CI / CircleCI / locally
- Deploy to Cloudflare via `wrangler pages deploy ./dist --project-name=ah`
  — no Git integration on CF side, just a direct upload from CI.
- CMS: Decap still works; the OAuth proxy must point to whichever git provider
  hosts the repo.

### C. Self-hosted on the Oracle VM

Keep everything on the existing free Oracle ARM:

- Astro builds → static `dist/` → served by nginx (drop-in for the current
  Flask routes that just render templates).
- Forms become Django views in the existing `blog_django_backend` app, or a
  small new Flask service. Forms and contact endpoint move "back" to the VM.
- Blog stays in Django (no migration needed). CMS becomes Django admin.
- CI: build in GitHub Actions free tier (or GitLab CI, CircleCI), `rsync`
  the build over SSH.

Trade-offs vs A/B:

| | Cloudflare Pages (A/B) | Oracle VM (C) |
|---|---|---|
| TTFB | ~20ms global edge | ~200ms+ (one region) |
| Infra to maintain | none | nginx, Docker, Django, Postgres, SSL renewal, OS updates |
| Hosting cost | $0 | $0 (Oracle free tier) |
| CMS backend | Decap → git | Django admin (already exists) |
| Blog migration | Need to convert posts to MD | None — keep Django |
| Form backend | TS Worker | Python Django/Flask |
| Build pipeline complexity | Low (CF Pages auto-builds) | Medium (need rsync + cache-bust) |

**Recommendation**: Path A. The user's premise that GitHub Business is required
is wrong; clarifying that should unblock the original plan. Path B is fine if
the user has a separate reason to leave GitHub. Path C only makes sense if the
user prefers Python over TS and is willing to keep the VM/nginx maintenance
burden — gains very little besides "it's the stack I already know."

## Open items

- [ ] User confirms hosting path (A / B / C)
- [ ] If A or B: user generates Gmail App Password, hands over as deploy secret
- [ ] If A: user (or AHDesign26 admin) authorizes CF Pages on the GitHub repo
- [ ] If C: confirm Django app is OK to take on form handling
- [ ] Capture Playwright baselines (this conversation, Phase 0 scaffolding in progress)
- [ ] User reviews this plan and signs off before any Astro bootstrap begins

## What this conversation produced toward the migration

- This plan document
- `playwright.config.ts` + `tests/visual/*.spec.ts` + minimal `package.json`
  (deps: `@playwright/test`). Tests are designed to run against the live site
  for baseline capture, and against any future preview/dev URL via the
  `BASE_URL` env var.
- Nothing committed to git yet.

## Files NOT touched

- `app.py`, `templates/`, `static/`, `Dockerfile`, `docker-compose.yml`,
  `bjoern_server.py`, `requirements.txt` — all untouched.
- The deploy automation plan (`.github/workflows/deploy.yml`) is paused
  pending the hosting decision.
