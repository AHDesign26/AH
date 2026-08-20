#!/usr/bin/env node
/**
 * Mint the Google Calendar refresh token used by /api/slots and /api/book.
 *
 * There is no Google Workspace behind ahdesign.website (mail is forwarded by
 * ImprovMX and sent from a personal Gmail account), so a service account with
 * domain-wide delegation is not an option. This runs the installed-app OAuth
 * flow once and prints a refresh token to paste into the Pages env vars.
 *
 * Before running, in console.cloud.google.com:
 *   1. Create a project, enable the Google Calendar API.
 *   2. OAuth consent screen: External, add both of your Google accounts as
 *      test users, then PUBLISH IT. Left in "Testing", Google expires the
 *      refresh token after about a week and availability silently stops
 *      reflecting your calendars.
 *   3. Credentials -> Create OAuth client ID -> Desktop app. Copy the id and
 *      secret.
 *
 * Then:  node scripts/google-oauth.mjs <client-id> <client-secret>
 *
 * Run it once per Google account whose calendar should be checked.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 8789;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/google-oauth.mjs <client-id> <client-secret>');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    // Both are required to get a refresh token back: offline access asks for
    // one, and forcing the consent screen makes Google reissue it even if this
    // account has approved the app before.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

async function exchange(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(body)}`);
  if (!body.refresh_token) {
    throw new Error('no refresh_token returned; revoke the app at myaccount.google.com and retry');
  }
  return body.refresh_token;
}

/** Which calendars this token can see, so the ids can be copied straight out. */
async function listCalendars(refreshToken) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const { access_token: accessToken } = await tokenRes.json();
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  return (body.items ?? []).map((c) => c.id);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end();
    return;
  }

  const respond = (message) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(message);
  };

  if (url.searchParams.get('state') !== state) {
    respond('State mismatch. Close this tab and run the script again.');
    server.close();
    process.exitCode = 1;
    return;
  }

  const error = url.searchParams.get('error');
  if (error) {
    respond(`Google returned: ${error}. You can close this tab.`);
    server.close();
    process.exitCode = 1;
    return;
  }

  try {
    const refreshToken = await exchange(url.searchParams.get('code'));
    const calendars = await listCalendars(refreshToken);
    respond('Done. Close this tab and look at your terminal.');
    console.log('\nGOOGLE_REFRESH_TOKEN=%s\n', refreshToken);
    console.log('Calendars this token can read (use these for GOOGLE_CALENDAR_IDS):');
    for (const id of calendars) console.log(`  ${id}`);
    console.log('\nSet all four in the Cloudflare Pages env vars, then deploy.');
  } catch (err) {
    respond('Something went wrong. Check your terminal.');
    console.error(err.message);
    process.exitCode = 1;
  }
  server.close();
});

server.listen(PORT, () => {
  console.log('Open this in a browser, signed in as the account whose calendar to check:\n');
  console.log(authUrl + '\n');
  console.log(`Waiting on ${REDIRECT_URI} ...`);
});
