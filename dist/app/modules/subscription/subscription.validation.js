"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionValidation = void 0;
const zod_1 = require("zod");
const plan_mapper_1 = require("./helpers/plan.mapper");
exports.SubscriptionValidation = {
    appleVerifySchema: zod_1.z
        .object({
        body: zod_1.z.object({
            signedTransactionInfo: zod_1.z
                .string()
                .min(1, 'signedTransactionInfo is required'),
        }),
        params: zod_1.z.object({}).optional(),
        query: zod_1.z.object({}).optional(),
    })
        .describe('AppleVerifyPurchaseSchema'),
    googleVerifySchema: zod_1.z
        .object({
        body: zod_1.z.object({
            purchaseToken: zod_1.z.string().min(1, 'purchaseToken is required'),
            productId: zod_1.z
                .string()
                .min(1, 'productId is required')
                .refine(val => (0, plan_mapper_1.getKnownProductIds)().includes(val), {
                message: 'Invalid or unsupported productId',
            }),
        }),
        params: zod_1.z.object({}).optional(),
        query: zod_1.z.object({}).optional(),
    })
        .describe('GoogleVerifyPurchaseSchema'),
    adminGrantPlanSchema: zod_1.z.object({
        body: zod_1.z.object({
            userId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
            plan: zod_1.z.enum(['PREMIUM', 'ENTERPRISE'], {
                errorMap: () => ({ message: 'Plan must be PREMIUM or ENTERPRISE' }),
            }),
        }),
    }),
    adminResetPlanSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
        }),
    }),
};
