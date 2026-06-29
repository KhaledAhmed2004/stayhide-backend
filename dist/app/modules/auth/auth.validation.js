"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
const zod_1 = require("zod");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
const createVerifyEmailZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }).email(),
        otp: zod_1.z.string({ required_error: 'OTP is required' }),
    }),
});
const createLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address'),
        password: zod_1.z
            .string({ required_error: 'Password is required' })
            .min(1, 'Password is required'),
        deviceToken: zod_1.z.string().optional(),
        platform: zod_1.z.enum(['ios', 'android', 'web']).optional(),
        appVersion: zod_1.z.string().optional(),
    }),
});
const createForgetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address'),
    }),
});
const createResetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        newPassword: zod_1.z
            .string({ required_error: 'Password is required' })
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars'),
    }),
});
const createChangePasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string({
            required_error: 'Current Password is required',
        }),
        newPassword: zod_1.z
            .string({ required_error: 'New Password is required' })
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars'),
    }),
});
const createSocialLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        provider: zod_1.z.enum(['google', 'apple'], {
            required_error: 'Provider is required',
        }),
        idToken: zod_1.z.string({ required_error: 'ID token is required' }),
        // Apple: nonce is REQUIRED at the service layer (plugin supports it
        //   cleanly via sign_in_with_apple).
        // Google: nonce is OPTIONAL here because mainstream Flutter plugins
        //   don't expose a nonce parameter, but the service still verifies it
        //   when provided. Teams wanting strict nonce for Google should wire
        //   up flutter_appauth or a platform channel to pass it through.
        // If provided, the raw nonce must be at least 32 characters.
        nonce: zod_1.z
            .string()
            .min(32, 'Nonce must be at least 32 characters')
            .optional(),
        deviceToken: zod_1.z.string().optional(),
        platform: zod_1.z.enum(['ios', 'android', 'web']).optional(),
        appVersion: zod_1.z.string().optional(),
    }),
});
const createRefreshTokenZodSchema = zod_1.z.object({
    // Allow empty body when using cookie-based refresh tokens
    body: zod_1.z
        .object({
        refreshToken: zod_1.z.string().optional(),
    })
        .optional(),
});
const createResendOtpZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address')
            .toLowerCase(),
    }),
});
const createRestoreAccountZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address')
            .toLowerCase(),
        password: zod_1.z
            .string({ required_error: 'Password is required' })
            .min(1, 'Password is required'),
        deviceToken: zod_1.z.string().optional(),
    }),
});
exports.AuthValidation = {
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
