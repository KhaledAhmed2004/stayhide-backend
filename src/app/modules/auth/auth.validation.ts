import { z } from 'zod';

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

const createVerifyEmailZodSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email(),
    otp: z.string({ required_error: 'OTP is required' }),
  }),
});

const createLoginZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
    deviceToken: z.string().optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    appVersion: z.string().optional(),
  }),
});

const createForgetPasswordZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
  }),
});

const createResetPasswordZodSchema = z.object({
  body: z.object({
    newPassword: z
      .string({ required_error: 'Password is required' })
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars'
      ),
  }),
});

const createChangePasswordZodSchema = z.object({
  body: z.object({
    currentPassword: z.string({
      required_error: 'Current Password is required',
    }),
    newPassword: z
      .string({ required_error: 'New Password is required' })
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars'
      ),
  }),
});

const createSocialLoginZodSchema = z.object({
  body: z.object({
    provider: z.enum(['google', 'apple'], {
      required_error: 'Provider is required',
    }),
    idToken: z.string({ required_error: 'ID token is required' }),
    // Apple: nonce is REQUIRED at the service layer (plugin supports it
    //   cleanly via sign_in_with_apple).
    // Google: nonce is OPTIONAL here because mainstream Flutter plugins
    //   don't expose a nonce parameter, but the service still verifies it
    //   when provided. Teams wanting strict nonce for Google should wire
    //   up flutter_appauth or a platform channel to pass it through.
    // If provided, the raw nonce must be at least 32 characters.
    nonce: z
      .string()
      .min(32, 'Nonce must be at least 32 characters')
      .optional(),
    deviceToken: z.string().optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    appVersion: z.string().optional(),
  }),
});

const createRefreshTokenZodSchema = z.object({
  // Allow empty body when using cookie-based refresh tokens
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

const createResendOtpZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
  }),
});

const createRestoreAccountZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
    deviceToken: z.string().optional(),
  }),
});

export const AuthValidation = {
  createVerifyEmailZodSchema,
  createForgetPasswordZodSchema,
  createLoginZodSchema,
  createResetPasswordZodSchema,
  createChangePasswordZodSchema,
  createRefreshTokenZodSchema,
  createSocialLoginZodSchema,
  createResendOtpZodSchema,
  createRestoreAccountZodSchema,
};
