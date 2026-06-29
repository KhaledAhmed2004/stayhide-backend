/**
 * Cloudflare Turnstile verifier.
 *
 * Calls Cloudflare's /siteverify endpoint to validate a client-issued
 * Turnstile token. The token comes from the Turnstile widget in the
 * client (mobile/web), is opaque, single-use, and short-lived.
 *
 * Activation: set `TURNSTILE_SECRET` in env. If unset, `isConfigured()`
 * returns false and the middleware no-ops — keeps the dev loop friendly
 * while protecting production once the secret is set.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
import { logger } from '../shared/logger';

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export const isConfigured = (): boolean => {
  return Boolean(process.env.TURNSTILE_SECRET);
};

/**
 * Verify a Turnstile token. Returns true on success; throws nothing
 * (caller decides how to surface failure). On any error (network,
 * unconfigured, malformed response) returns false.
 */
export const verifyTurnstileToken = async (
  token: string,
  remoteIp?: string,
): Promise<{ ok: boolean; errorCodes?: string[] }> => {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    // Dev mode — pass-through. Production deployments MUST set the env.
    return { ok: true };
  }

  if (!token) {
    return { ok: false, errorCodes: ['missing-input-response'] };
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      logger.warn(`Turnstile verify HTTP ${res.status}`);
      return { ok: false, errorCodes: [`http-${res.status}`] };
    }

    const data = (await res.json()) as TurnstileResponse;
    return {
      ok: Boolean(data.success),
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    logger.warn(`Turnstile verify error: ${(err as Error).message}`);
    return { ok: false, errorCodes: ['network-error'] };
  }
};
