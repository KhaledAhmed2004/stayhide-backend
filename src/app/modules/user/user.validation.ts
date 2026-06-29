import { z } from 'zod';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

const createUserZodSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: 'Name is required' }).min(1),
      email: z
        .string({ required_error: 'Email is required' })
        .email('Invalid email address')
        .toLowerCase(),
      dateOfBirth: z.string({ required_error: 'Date of birth is required' }).datetime().refine((dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age >= 16;
      }, 'Minimum age is 16 years'),
      password: z.string().optional(),
      profileImage: z.string().optional(),
      googleId: z.string().optional(),
      appleId: z.string().optional(),
      // Cloudflare Turnstile token from the client widget. Verified by
      // the `verifyCaptcha` middleware downstream. Optional in the schema
      // so dev mode (TURNSTILE_SECRET unset) works without it; the
      // middleware no-ops in that case.
      captchaToken: z.string().optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (!data.googleId && !data.appleId) {
        if (!data.password || data.password.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password is required', path: ['password'] });
        } else if (!passwordRegex.test(data.password)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password must include upper, lower, number, special and be 8+ chars',
            path: ['password']
          });
        }
      }
    }),
});

const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    profileImage: z.string().optional(),
  }),
});

const updateUserPreferencesZodSchema = z.object({
  body: z.object({
    isDailySymptomReminderEnabled: z.boolean().optional(),
    timezone: z.string().optional(),
  }),
});

export const UserValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  updateUserPreferencesZodSchema,
  updateUserStatusZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.REJECTED, USER_STATUS.SUSPENDED], {
        required_error: 'status is required',
      }),
      rejectionReason: z.string().optional()
    }),
  }),

  adminUpdateUserZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      name: z.string().optional(),
      email: z.string().email('Invalid email address').toLowerCase().optional(),
      dateOfBirth: z.string().datetime().optional(),
      status: z.enum([
        USER_STATUS.PENDING,
        USER_STATUS.ACTIVE,
        USER_STATUS.REJECTED,
        USER_STATUS.SUSPENDED,
        USER_STATUS.DELETED,
      ]).optional(),
      role: z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]).optional(),
    }),
  }),
  deleteAccountZodSchema: z.object({
    body: z.object({
      password: z
        .string({ required_error: 'Password is required to confirm account deletion' })
        .min(1, 'Password is required to confirm account deletion'),
    }),
  }),
  requestEmailChangeZodSchema: z.object({
    body: z.object({
      newEmail: z
        .string({ required_error: 'New email is required' })
        .email('Invalid email address')
        .toLowerCase(),
      password: z
        .string({ required_error: 'Password is required to confirm email change' })
        .min(1, 'Password is required to confirm email change'),
    }),
  }),
  confirmEmailChangeZodSchema: z.object({
    body: z.object({
      otp: z
        .string({ required_error: 'OTP is required' })
        .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
    }),
  }),
  revokeSessionZodSchema: z.object({
    params: z.object({
      tokenId: z
        .string({ required_error: 'Token ID is required' })
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Token ID format'),
    }),
  }),

  getAllUserRolesZodSchema: z.object({
    query: z.object({
      searchTerm: z.string().optional(),
      email: z.string().optional(),
      role: z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]).optional(),
      status: z.enum([
        USER_STATUS.PENDING,
        USER_STATUS.ACTIVE,
        USER_STATUS.REJECTED,
        USER_STATUS.SUSPENDED,
        USER_STATUS.DELETED,
      ]).optional(),
      isVerified: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }),
  }),
};
