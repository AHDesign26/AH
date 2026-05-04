// Decap CMS GitHub OAuth proxy — runs as a Cloudflare Pages Function.
//
// Two routes:
//   GET /api/cms-oauth/auth      — kicks off the OAuth flow, redirects to GitHub
//   GET /api/cms-oauth/callback  — receives ?code=, exchanges for token, posts back to opener
//
// Why a proxy: GitHub's OAuth requires a `client_secret` to redeem the auth
// code, which can't live in the browser. Decap expects to receive the access
// token via window.postMessage from a popup that completes the flow.
//
// Required Cloudflare Pages env secrets:
//   GITHUB_OAUTH_CLIENT_ID
//   GITHUB_OAUTH_CLIENT_SECRET
//
// One-time setup on GitHub:
//   1. https://github.com/settings/developers → New OAuth App
//   2. Application name: AHDesign CMS
//   3. Homepage URL: https://ahdesign.website
//   4. Authorization callback URL: https://ahdesign.website/api/cms-oauth/callback
//   5. Save the client id + a generated client secret as the env vars above.
//
// Reference: https://decapcms.org/docs/external-oauth-clients/

interface Env {
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
}

const SCOPE = 'repo,user';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/^\/api\/cms-oauth\/?/, '').replace(/\/$/, '');

  if (path === 'auth') return startOAuth(ctx, url);
  if (path === 'callback') return finishOAuth(ctx, url);

  return new Response('not found', { status: 404 });
};

function startOAuth(ctx: { env: Env }, requestUrl: URL): Response {
  const state = crypto.randomUUID();
  const redirectUri = `${requestUrl.origin}/api/cms-oauth/callback`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', ctx.env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', SCOPE);
  authorize.searchParams.set('state', state);

  // Persist `state` in a short-lived signed cookie so /callback can verify it.
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      'set-cookie': `cms_oauth_state=${state}; Path=/api/cms-oauth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function finishOAuth(ctx: { env: Env; request: Request }, requestUrl: URL): Promise<Response> {
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const cookie = ctx.request.headers.get('cookie') ?? '';
  const cookieState = /(?:^|;\s*)cms_oauth_state=([^;]+)/.exec(cookie)?.[1];

  if (!code) return htmlError('Missing OAuth code', 400);
  if (!state || !cookieState || state !== cookieState) {
    return htmlError('OAuth state mismatch', 400);
  }

  // Exchange code → access_token.
  let tokenRes: Response;
  try {
    tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: ctx.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: ctx.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });
  } catch (e) {
    return htmlError(`Network error: ${String(e)}`, 502);
  }

  if (!tokenRes.ok) {
    return htmlError(`Token exchange failed: HTTP ${tokenRes.status}`, 502);
  }

  const data = (await tokenRes.json()) as {
    access_token?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    return htmlError(`OAuth error: ${data.error_description ?? data.error ?? 'unknown'}`, 502);
  }

  // postMessage the token back to the opener (Decap CMS) and self-close.
  // Decap looks for a message of the form `authorization:github:success:{...}`.
  const payload = JSON.stringify({
    token: data.access_token,
    provider: 'github',
  }).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Authorising...</title></head>
<body><script>
  (function(){
    function send(status){
      window.opener && window.opener.postMessage(
        'authorization:github:' + status + ':' + ${JSON.stringify(payload)},
        '*'
      );
    }
    window.addEventListener('message', function(e){
      if (e.data === 'authorizing:github') send('success');
    }, false);
    send('success');
    setTimeout(function(){ window.close(); }, 1500);
  })();
</script>
<p>Authorisation complete. You can close this window.</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': 'cms_oauth_state=; Path=/api/cms-oauth; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    },
  });
}

function htmlError(message: string, status: number): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>OAuth error</title>
<body><h1>OAuth error</h1><pre>${escapeHtml(message)}</pre></body>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
