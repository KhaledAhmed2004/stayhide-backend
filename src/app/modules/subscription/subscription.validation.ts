import { z } from 'zod';
import { getKnownProductIds } from './helpers/plan.mapper';

export const SubscriptionValidation = {
  appleVerifySchema: z
    .object({
      body: z.object({
        signedTransactionInfo: z
          .string()
          .min(1, 'signedTransactionInfo is required'),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    })
    .describe('AppleVerifyPurchaseSchema'),

  googleVerifySchema: z
    .object({
      body: z.object({
        purchaseToken: z.string().min(1, 'purchaseToken is required'),
        productId: z
          .string()
          .min(1, 'productId is required')
          .refine(val => getKnownProductIds().includes(val), {
            message: 'Invalid or unsupported productId',
          }),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    })
    .describe('GoogleVerifyPurchaseSchema'),

  adminGrantPlanSchema: z.object({
    body: z.object({
      userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
      plan: z.enum(['PREMIUM', 'ENTERPRISE'], {
        errorMap: () => ({ message: 'Plan must be PREMIUM or ENTERPRISE' }),
      }),
    }),
  }),

  adminResetPlanSchema: z.object({
    params: z.object({
      userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
    }),
  }),
};
