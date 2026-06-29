"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address')
            .toLowerCase(),
        dateOfBirth: zod_1.z.string({ required_error: 'Date of birth is required' }).datetime().refine((dob) => {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age >= 16;
        }, 'Minimum age is 16 years'),
        password: zod_1.z.string().optional(),
        profileImage: zod_1.z.string().optional(),
        googleId: zod_1.z.string().optional(),
        appleId: zod_1.z.string().optional(),
        // Cloudflare Turnstile token from the client widget. Verified by
        // the `verifyCaptcha` middleware downstream. Optional in the schema
        // so dev mode (TURNSTILE_SECRET unset) works without it; the
        // middleware no-ops in that case.
        captchaToken: zod_1.z.string().optional(),
    })
        .strict()
        .superRefine((data, ctx) => {
        if (!data.googleId && !data.appleId) {
            if (!data.password || data.password.length === 0) {
                ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Password is required', path: ['password'] });
            }
            else if (!passwordRegex.test(data.password)) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Password must include upper, lower, number, special and be 8+ chars',
                    path: ['password']
                });
            }
        }
    }),
});
const updateUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        profileImage: zod_1.z.string().optional(),
    }),
});
const updateUserPreferencesZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        isDailySymptomReminderEnabled: zod_1.z.boolean().optional(),
        timezone: zod_1.z.string().optional(),
    }),
});
exports.UserValidation = {
    createUserZodSchema,
    updateUserZodSchema,
    updateUserPreferencesZodSchema,
    updateUserStatusZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string({ required_error: 'User ID is required' }),
        }),
        body: zod_1.z.object({
            status: zod_1.z.enum([user_1.USER_STATUS.ACTIVE, user_1.USER_STATUS.REJECTED, user_1.USER_STATUS.SUSPENDED], {
                required_error: 'status is required',
            }),
            rejectionReason: zod_1.z.string().optional()
        }),
    }),
    adminUpdateUserZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string({ required_error: 'User ID is required' }),
        }),
        body: zod_1.z.object({
            name: zod_1.z.string().optional(),
            email: zod_1.z.string().email('Invalid email address').toLowerCase().optional(),
            dateOfBirth: zod_1.z.string().datetime().optional(),
            status: zod_1.z.enum([
                user_1.USER_STATUS.PENDING,
                user_1.USER_STATUS.ACTIVE,
                user_1.USER_STATUS.REJECTED,
                user_1.USER_STATUS.SUSPENDED,
                user_1.USER_STATUS.DELETED,
            ]).optional(),
            role: zod_1.z.enum([user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN]).optional(),
        }),
    }),
    deleteAccountZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            password: zod_1.z
                .string({ required_error: 'Password is required to confirm account deletion' })
                .min(1, 'Password is required to confirm account deletion'),
        }),
    }),
    requestEmailChangeZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            newEmail: zod_1.z
                .string({ required_error: 'New email is required' })
                .email('Invalid email address')
                .toLowerCase(),
            password: zod_1.z
                .string({ required_error: 'Password is required to confirm email change' })
                .min(1, 'Password is required to confirm email change'),
        }),
    }),
    confirmEmailChangeZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            otp: zod_1.z
                .string({ required_error: 'OTP is required' })
                .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
        }),
    }),
    revokeSessionZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            tokenId: zod_1.z
                .string({ required_error: 'Token ID is required' })
                .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Token ID format'),
        }),
    }),
    getAllUserRolesZodSchema: zod_1.z.object({
        query: zod_1.z.object({
            searchTerm: zod_1.z.string().optional(),
            email: zod_1.z.string().optional(),
            role: zod_1.z.enum([user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN]).optional(),
            status: zod_1.z.enum([
                user_1.USER_STATUS.PENDING,
                user_1.USER_STATUS.ACTIVE,
                user_1.USER_STATUS.REJECTED,
                user_1.USER_STATUS.SUSPENDED,
                user_1.USER_STATUS.DELETED,
            ]).optional(),
            isVerified: zod_1.z.string().optional(),
            page: zod_1.z.string().optional(),
            limit: zod_1.z.string().optional(),
            sortBy: zod_1.z.string().optional(),
            sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
        }),
    }),
};
