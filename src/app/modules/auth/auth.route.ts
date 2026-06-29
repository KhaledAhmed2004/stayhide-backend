import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import { idempotency } from '../../middlewares/idempotency';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';
const router = express.Router();

// 10 req/min per IP — guards against brute-force password attempts and
// spray attacks against the token verification endpoint, which does expensive
// RSA signature validation.
const loginRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 10,
  routeName: 'auth:login',
});

const socialLoginRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 10,
  routeName: 'auth:social-login',
});

const passwordResetRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 5,
  routeName: 'auth:password-reset',
});

// Refresh is automatic / background work in normal clients, so it gets a
// slightly higher cap than login. Still rate-limited to make stolen-token
// brute-force impractical even if the reuse-detection check were bypassed.
const refreshTokenRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 20,
  routeName: 'auth:refresh',
});

// Resend-otp is per-user cooldown-throttled inside the helper, but the
// per-IP route limit closes the email-enumeration / OTP-spam window where
// an attacker hits many addresses at once.
const resendOtpRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 5,
  routeName: 'auth:resend-otp',
});

// User login
router.post(
  '/login',
  // loginRateLimit,
  validateRequest(AuthValidation.createLoginZodSchema),
  AuthController.loginUser,
);

// Social login (Google / Apple ID token verification)
router.post(
  '/social-login',
  socialLoginRateLimit,
  validateRequest(AuthValidation.createSocialLoginZodSchema),
  AuthController.socialLogin,
);

// User logout — invalidate active sessions/tokens
router.post(
  '/logout',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  AuthController.logoutUser,
);

// Password reset request — send OTP via email
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  idempotency('auth:forgot-password'),
  validateRequest(AuthValidation.createForgetPasswordZodSchema),
  AuthController.forgetPassword,
);

// OTP verification — verify via code
router.post(
  '/verify-otp',
  passwordResetRateLimit,
  validateRequest(AuthValidation.createVerifyEmailZodSchema),
  AuthController.verifyEmail,
);

// Password reset — set new password with valid token
router.post(
  '/reset-password',
  passwordResetRateLimit,
  idempotency('auth:reset-password'),
  validateRequest(AuthValidation.createResetPasswordZodSchema),
  AuthController.resetPassword,
);

// Change password — authenticated user provides old/new password
router.post(
  '/change-password',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  validateRequest(AuthValidation.createChangePasswordZodSchema),
  AuthController.changePassword,
);

// Resend verification OTP — per-user 60s cooldown is enforced in the
// service; the per-IP cap here protects against email-enumeration sweeps.
router.post(
  '/resend-otp',
  resendOtpRateLimit,
  idempotency('auth:resend-otp'),
  validateRequest(AuthValidation.createResendOtpZodSchema),
  AuthController.resendVerifyEmail,
);

// Refresh token — renew access token
router.post(
  '/refresh-token',
  refreshTokenRateLimit,
  validateRequest(AuthValidation.createRefreshTokenZodSchema),
  AuthController.refreshToken,
);

// Restore an account that is in DELETED status and inside its 30-day
// recovery window. Public — credentials are validated inline.
router.post(
  '/restore-account',
  loginRateLimit,
  idempotency('auth:restore-account'),
  validateRequest(AuthValidation.createRestoreAccountZodSchema),
  AuthController.restoreAccount,
);

export const AuthRoutes = router;
