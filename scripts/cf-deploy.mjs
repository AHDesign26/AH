#!/usr/bin/env node
// Provision the Cloudflare side of the AH-design deploy: Pages project,
// env vars, optional Turnstile site, optional custom domain. Reads secrets
// from .env.deploy.local (gitignored).
//
// Usage:
//   npm install                              # gets wrangler as a dep
//   npx wrangler login                       # one-time browser auth
//   cp .env.deploy.example .env.deploy.local
//   # …fill in CF_ACCOUNT_ID, CF_API_TOKEN, etc.
//   node scripts/cf-deploy.mjs               # provisions everything
//
// Idempotent. Re-running updates env vars to current values, doesn't
// re-create the project.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(repoRoot, '.env.deploy.local');

if (!existsSync(envPath)) {
  console.error('Missing .env.deploy.local — copy from .env.deploy.example and fill it in.');
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
const required = ['CF_ACCOUNT_ID', 'CF_API_TOKEN', 'CF_PAGES_PROJECT', 'DOMAIN'];
for (const k of required) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env.deploy.local`);
    process.exit(1);
  }
}

const PROJECT = env.CF_PAGES_PROJECT;
const ACCOUNT = env.CF_ACCOUNT_ID;
const DOMAIN = env.DOMAIN;
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
const headers = {
  authorization: `Bearer ${env.CF_API_TOKEN}`,
  'content-type': 'application/json',
};

await main();

async function main() {
  console.log(`\n→ creating / verifying Pages project "${PROJECT}"`);
  await ensurePagesProject();

  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
    console.log(`\n→ creating Turnstile site for ${DOMAIN}`);
    const { siteKey, secretKey } = await createTurnstileSite();
    env.TURNSTILE_SITE_KEY = siteKey;
    env.TURNSTILE_SECRET_KEY = secretKey;
    console.log(`  site:   ${siteKey}`);
    console.log(`  secret: ${secretKey.slice(0, 8)}…  (full value sent to Pages env)`);
  } else {
    console.log(`\n→ Turnstile keys already in .env.deploy.local — skipping creation`);
  }

  console.log(`\n→ writing env vars to Pages project`);
  await setPagesEnv();

  console.log(`\n→ ensuring custom domain ${DOMAIN} attached to Pages`);
  await ensureCustomDomain();

  console.log(`\n✓ done. Trigger a build:`);
  console.log(`    cd ${repoRoot}`);
  console.log(`    npm run build && npx wrangler pages deploy ./dist --project-name=${PROJECT}`);
  console.log(`  …or push to main if you've connected the GitHub repo in the dashboard.`);
}

// --------------------------------------------------------------------------

async function ensurePagesProject() {
  // GET — does it exist?
  const r = await fetch(`${API}/pages/projects/${PROJECT}`, { headers });
  if (r.status === 200) {
    console.log(`  exists`);
    return;
  }
  if (r.status !== 404) throw new Error(`unexpected status ${r.status}: ${await r.text()}`);

  const body = {
    name: PROJECT,
    production_branch: 'main',
    build_config: {
      build_command: 'npm run build',
      destination_dir: 'dist',
      root_dir: '',
    },
  };
  const c = await fetch(`${API}/pages/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!c.ok) throw new Error(`create project failed: ${c.status} ${await c.text()}`);
  console.log(`  created`);
}

async function createTurnstileSite() {
  const body = {
    name: `${PROJECT}-${DOMAIN}`,
    domains: [DOMAIN, `${PROJECT}.pages.dev`],
    mode: 'invisible',
  };
  const r = await fetch(`${API}/challenges/widgets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`turnstile create failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return {
    siteKey: j.result.sitekey,
    secretKey: j.result.secret,
  };
}

const PAGES_ENV = (env) => ({
  // plaintext — visible in dashboard
  vars: {
    NODE_VERSION: '20',
    PUBLIC_TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
    GMAIL_USER: env.GMAIL_USER ?? '',
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID ?? '',
    GITHUB_OAUTH_CLIENT_ID: env.GITHUB_OAUTH_CLIENT_ID ?? '',
    CONTACT_TO_EMAIL: env.CONTACT_TO_EMAIL || env.GMAIL_USER || '',
    ORIGIN: `https://${env.DOMAIN}`,
  },
  // encrypted — type "secret_text"
  secrets: {
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY ?? '',
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN ?? '',
    GMAIL_APP_PASSWORD: env.GMAIL_APP_PASSWORD ?? '',
    GITHUB_OAUTH_CLIENT_SECRET: env.GITHUB_OAUTH_CLIENT_SECRET ?? '',
  },
});

async function setPagesEnv() {
  const { vars, secrets } = PAGES_ENV(env);

  // Build the env_vars payload for both production + preview environments.
  const buildEnvVars = () => {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
      if (!v) continue;
      out[k] = { value: v, type: 'plain_text' };
    }
    for (const [k, v] of Object.entries(secrets)) {
      if (!v) continue;
      out[k] = { value: v, type: 'secret_text' };
    }
    return out;
  };

  const envVars = buildEnvVars();
  const body = {
    deployment_configs: {
      production: { env_vars: envVars },
      preview: { env_vars: envVars },
    },
  };

  const r = await fetch(`${API}/pages/projects/${PROJECT}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH project failed: ${r.status} ${await r.text()}`);
  console.log(`  ${Object.keys(envVars).length} vars set (production + preview)`);
  for (const k of Object.keys(envVars)) {
    const isSecret = secrets[k] !== undefined;
    console.log(`    ${k}${isSecret ? ' (encrypted)' : ''}`);
  }
}

async function ensureCustomDomain() {
  // GET existing domains
  const r = await fetch(`${API}/pages/projects/${PROJECT}/domains`, { headers });
  if (!r.ok) throw new Error(`list domains failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const have = (j.result ?? []).some((d) => d.name === DOMAIN);
  if (have) {
    console.log(`  ${DOMAIN} already attached`);
    return;
  }
  const c = await fetch(`${API}/pages/projects/${PROJECT}/domains`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: DOMAIN }),
  });
  if (!c.ok) throw new Error(`add domain failed: ${c.status} ${await c.text()}`);
  console.log(`  ${DOMAIN} attached`);
}

// --------------------------------------------------------------------------

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  out.DOMAIN = out.DOMAIN ?? '';
  return out;
}

void spawnSync; // reserved for future wrangler-shellout fallbacks
