/**
 * CAPTCHA middleware — verifies the client-issued Turnstile token from
 * `req.body.captchaToken` before the request reaches its handler.
 *
 * No-op when TURNSTILE_SECRET is not set in env (dev convenience). In
 * production, leaving the secret unset disables bot protection — set
 * the env to activate.
 *
 * On rejection: 401 Unauthorized with a generic message — we don't
 * surface Cloudflare's error codes to the client to avoid giving
 * attackers feedback on what tripped the check.
 */
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../errors/ApiError';
import {
  isConfigured,
  verifyTurnstileToken,
} from '../../helpers/captchaHelper';
import { logger } from '../../shared/logger';

export const verifyCaptcha = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isConfigured()) {
      // Dev mode — log once per request so the gap is visible in dev
      // logs but doesn't spam in production where the env is set.
      logger.debug?.('Captcha not configured (TURNSTILE_SECRET unset); skipping');
      return next();
    }

    const token =
      (req.body as { captchaToken?: string })?.captchaToken ?? undefined;
    const remoteIp =
      (req.headers['cf-connecting-ip'] as string | undefined) ??
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip;

    const result = await verifyTurnstileToken(token ?? '', remoteIp);
    if (!result.ok) {
      logger.warn(
        `Captcha rejected (${result.errorCodes?.join(',') ?? 'unknown'}) from ${remoteIp}`,
      );
      return next(
        new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Captcha verification failed. Please try again.',
        ),
      );
    }

    next();
  };
};
