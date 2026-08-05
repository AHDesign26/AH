#!/usr/bin/env node
/**
 * Purge the Cloudflare edge cache for ahdesign.website.
 *
 * The zone serves HTML with `Cache-Control: public, max-age=2678400` and holds
 * it at the edge, so a deploy is invisible to visitors until the cache is
 * dropped. That is a zone-level setting `public/_headers` cannot override, so
 * until it is changed in the dashboard every deploy has to purge.
 *
 * Reads CF_API_TOKEN (Zone / Cache Purge) and optionally CF_ZONE from .env,
 * .env.local or the environment. Run it after `cf:upload`, or use `cf:release`
 * which does both.
 */

import { readFileSync } from 'node:fs';

const ZONE_NAME = process.env.CF_ZONE ?? 'ahdesign.website';
const API = 'https://api.cloudflare.com/client/v4';

/** Minimal .env reader: `KEY=value`, ignores blanks and comments. */
function readEnvFiles() {
  const out = {};
  for (const file of ['.env', '.env.local', '.env.deploy.local']) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_+]*)\s*=\s*(.*)$/.exec(line);
      if (!m || line.trimStart().startsWith('#')) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

async function cf(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = await res.json();
  if (!body.success) {
    const detail = (body.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ');
    throw new Error(`${path} failed: ${detail || res.status}`);
  }
  return body.result;
}

const env = { ...readEnvFiles(), ...process.env };
// The key has been written both ways; accept either rather than fail on a typo.
const token = env.CF_API_TOKEN ?? env['CF_API+TOKEN'];

if (!token) {
  console.error('No CF_API_TOKEN found in .env, .env.local or the environment.');
  console.error('Needs a token with Zone / Cache Purge on ' + ZONE_NAME + '.');
  process.exit(1);
}

const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`, token);
if (!zones.length) throw new Error(`zone ${ZONE_NAME} not found for this token`);

await cf(`/zones/${zones[0].id}/purge_cache`, token, {
  method: 'POST',
  body: JSON.stringify({ purge_everything: true }),
});

console.log(`Purged the Cloudflare cache for ${ZONE_NAME}.`);
