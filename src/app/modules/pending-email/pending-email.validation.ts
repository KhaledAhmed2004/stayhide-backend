import { z } from 'zod';
import { EMAIL_KINDS } from '../../../config/emailRetry.config';

const STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'DEAD'] as const;

/**
 * `GET /admin/pending-emails` — query params for list / filter.
 * Mirrors the QueryBuilder convention used elsewhere; the validator
 * only checks shape, not business rules.
 */
const listPendingEmailsZodSchema = z.object({
  query: z
    .object({
      status: z.enum(STATUSES).optional(),
      kind: z.enum(EMAIL_KINDS as [string, ...string[]]).optional(),
      page: z.string().regex(/^\d+$/).optional(),
      limit: z.string().regex(/^\d+$/).optional(),
      sort: z.string().optional(),
      searchTerm: z.string().optional(),
      fields: z.string().optional(),
    })
    .passthrough(),
});

const requeuePendingEmailZodSchema = z.object({
  params: z.object({
    pendingEmailId: z
      .string({ required_error: 'Pending email ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid pending-email ID format'),
  }),
});

export const PendingEmailValidation = {
  listPendingEmailsZodSchema,
  requeuePendingEmailZodSchema,
};
