"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingEmailValidation = void 0;
const zod_1 = require("zod");
const emailRetry_config_1 = require("../../../config/emailRetry.config");
const STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'DEAD'];
/**
 * `GET /admin/pending-emails` — query params for list / filter.
 * Mirrors the QueryBuilder convention used elsewhere; the validator
 * only checks shape, not business rules.
 */
const listPendingEmailsZodSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        status: zod_1.z.enum(STATUSES).optional(),
        kind: zod_1.z.enum(emailRetry_config_1.EMAIL_KINDS).optional(),
        page: zod_1.z.string().regex(/^\d+$/).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).optional(),
        sort: zod_1.z.string().optional(),
        searchTerm: zod_1.z.string().optional(),
        fields: zod_1.z.string().optional(),
    })
        .passthrough(),
});
const requeuePendingEmailZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        pendingEmailId: zod_1.z
            .string({ required_error: 'Pending email ID is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid pending-email ID format'),
    }),
});
exports.PendingEmailValidation = {
    listPendingEmailsZodSchema,
    requeuePendingEmailZodSchema,
};
