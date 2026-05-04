// Cloudflare Turnstile server-side verification. Replaces the reCAPTCHA v3
// `is_human` check that previously lived in app.py. Returns true if the
// token is valid for this request.
//
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes: string[];
  hostname?: string;
  action?: string;
}

export async function verifyTurnstile(
  token: string | null,
  secretKey: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };

  const body = new URLSearchParams();
  body.append('secret', secretKey);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    return { success: false, errorCodes: ['network-error'] };
  }

  if (!res.ok) return { success: false, errorCodes: [`http-${res.status}`] };

  const data = (await res.json()) as {
    success: boolean;
    'error-codes'?: string[];
    hostname?: string;
    action?: string;
  };
  return {
    success: data.success === true,
    errorCodes: data['error-codes'] ?? [],
    hostname: data.hostname,
    action: data.action,
  };
}
