import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import {
  computeNextAttemptAt,
  emailRetryConfig,
  EMAIL_KINDS,
  EmailKind,
} from '../../../config/emailRetry.config';
import { errorLogger, logger } from '../../../shared/logger';
import { PendingEmail } from './pending-email.model';
import { IPendingEmail } from './pending-email.interface';
import { sendNow, SendEmailInput } from './pending-email.transport';

const INLINE_WORKER_MARKER = 'inline';

const truncateError = (err: unknown): string => {
  const raw = err instanceof Error ? err.stack || err.message : String(err);
  return raw.slice(0, 1024);
};

/**
 * Enqueue an email and attempt to send it inline (in the same request).
 * Always resolves — never throws to the caller. See
 * [system-concepts.md → Email Delivery & Retry Queue].
 *
 * Inline path takes a 60s lease (workerId='inline') BEFORE attempting
 * `sendNow` so the scheduler tick cannot also claim the row mid-send
 * and cause a duplicate. On success the row flips to SENT; on failure
 * the row stays PENDING with a backed-off `nextAttemptAt` for the
 * scheduler to pick up.
 *
 * G5 fallback: if the initial Mongo insert fails (transient connection
 * error), the function tries a best-effort inline send anyway so the
 * request that depended on the email doesn't fail outright. Failure
 * mode degrades to today's fire-and-forget behavior, NOT to total
 * silent failure of the higher-level flow.
 */
export const enqueueAndTrySend = async (
  template: SendEmailInput,
  opts: { kind: EmailKind },
): Promise<{ id: string | null; status: 'SENT' | 'PENDING' | 'BEST_EFFORT' }> => {
  const { kind } = opts;
  const maxAttempts =
    emailRetryConfig.maxAttemptsByKind[kind] ?? 4;

  const now = new Date();
  const leaseExpiresAt = new Date(
    now.getTime() + emailRetryConfig.leaseSeconds * 1000,
  );

  // 1) Insert with PROCESSING + inline lease, so the scheduler tick
  //    skips this row while we're attempting inline.
  let row: IPendingEmail & { _id: any };
  try {
    row = (await PendingEmail.create({
      kind,
      to: template.to,
      subject: template.subject,
      html: template.html,
      status: 'PROCESSING',
      attempts: 1,
      maxAttempts,
      nextAttemptAt: now,
      workerId: INLINE_WORKER_MARKER,
      leaseExpiresAt,
      lastError: null,
      messageId: null,
      sentAt: null,
    })) as unknown as IPendingEmail & { _id: any };
  } catch (insertErr) {
    // G5: Mongo-insert failure. Try a best-effort inline send so the
    // higher-level flow doesn't fail because the queue is down. The
    // send may also fail — that surfaces today's behavior, not worse.
    errorLogger.error(
      `PendingEmail.enqueue insert failed (${truncateError(insertErr).slice(0, 200)}); falling back to fire-and-forget`,
    );
    try {
      await sendNow(template);
      return { id: null, status: 'BEST_EFFORT' };
    } catch (sendErr) {
      errorLogger.error(
        `PendingEmail.enqueue best-effort send also failed: ${truncateError(sendErr).slice(0, 200)}`,
      );
      return { id: null, status: 'BEST_EFFORT' };
    }
  }

  // 2) Inline send. We hold the lease so a concurrent scheduler tick
  //    won't reclaim. On success → SENT. On failure → release lease,
  //    reset status to PENDING, schedule next attempt.
  try {
    const result = await sendNow(template);
    await PendingEmail.findByIdAndUpdate(row._id, {
      $set: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: result.messageId,
        workerId: null,
        leaseExpiresAt: null,
      },
    });
    return { id: row._id.toString(), status: 'SENT' };
  } catch (sendErr) {
    const errStr = truncateError(sendErr);
    const attempts = 1;
    // attempts already at 1 (from create). Next worker tick will be
    // attempt 2.
    if (attempts >= maxAttempts) {
      await PendingEmail.findByIdAndUpdate(row._id, {
        $set: {
          status: 'DEAD',
          lastError: errStr,
          workerId: null,
          leaseExpiresAt: null,
          nextAttemptAt: null as any,
        },
      });
      errorLogger.error(
        `PendingEmail.DEAD id=${row._id} kind=${kind} to=${template.to} attempts=${attempts}`,
      );
      return { id: row._id.toString(), status: 'PENDING' };
    }

    await PendingEmail.findByIdAndUpdate(row._id, {
      $set: {
        status: 'PENDING',
        lastError: errStr,
        workerId: null,
        leaseExpiresAt: null,
        nextAttemptAt: computeNextAttemptAt(attempts),
      },
    });
    logger.warn?.(
      `PendingEmail inline send failed id=${row._id} kind=${kind} attempts=${attempts}/${maxAttempts}; will retry`,
    );
    return { id: row._id.toString(), status: 'PENDING' };
  }
};

/**
 * Worker tick body — used by PendingEmailScheduler. Processes up to
 * `batchSize` due rows. Each claim is atomic via `findOneAndUpdate`.
 * Returns the count processed.
 */
export const processBatch = async (
  workerId: string,
  batchSize = 10,
): Promise<{ processed: number; succeeded: number; failed: number }> => {
  const summary = { processed: 0, succeeded: 0, failed: 0 };

  for (let i = 0; i < batchSize; i++) {
    const now = new Date();
    const leaseExpiresAt = new Date(
      now.getTime() + emailRetryConfig.leaseSeconds * 1000,
    );
    const claimed = await PendingEmail.findOneAndUpdate(
      { status: 'PENDING', nextAttemptAt: { $lte: now } },
      {
        $set: {
          status: 'PROCESSING',
          workerId,
          leaseExpiresAt,
        },
        $inc: { attempts: 1 },
      },
      { sort: { nextAttemptAt: 1 }, new: true },
    );
    if (!claimed) break;

    summary.processed++;

    try {
      const result = await sendNow({
        to: claimed.to,
        subject: claimed.subject,
        html: claimed.html,
      });
      await PendingEmail.findByIdAndUpdate(claimed._id, {
        $set: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
          workerId: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      summary.succeeded++;
    } catch (err) {
      summary.failed++;
      const errStr = truncateError(err);
      const attempts = claimed.attempts;
      if (attempts >= claimed.maxAttempts) {
        await PendingEmail.findByIdAndUpdate(claimed._id, {
          $set: {
            status: 'DEAD',
            lastError: errStr,
            workerId: null,
            leaseExpiresAt: null,
            nextAttemptAt: null as any,
          },
        });
        errorLogger.error(
          `PendingEmail.DEAD id=${claimed._id} kind=${claimed.kind} to=${claimed.to} attempts=${attempts}`,
        );
      } else {
        await PendingEmail.findByIdAndUpdate(claimed._id, {
          $set: {
            status: 'PENDING',
            lastError: errStr,
            workerId: null,
            leaseExpiresAt: null,
            nextAttemptAt: computeNextAttemptAt(attempts),
          },
        });
      }
    }
  }
  return summary;
};

/**
 * Sweep expired leases — rows stuck in PROCESSING past their
 * `leaseExpiresAt` are reclaimed to PENDING so another worker can pick
 * them up. Defense against worker crashes mid-send.
 */
export const reclaimExpiredLeases = async (): Promise<number> => {
  const now = new Date();
  const result = await PendingEmail.updateMany(
    { status: 'PROCESSING', leaseExpiresAt: { $lt: now } },
    {
      $set: {
        status: 'PENDING',
        workerId: null,
        leaseExpiresAt: null,
        nextAttemptAt: now,
      },
    },
  );
  return result.modifiedCount;
};

/**
 * Admin: list pending emails. Standard QueryBuilder pipeline so
 * `?status=&kind=&searchTerm=&page=&limit=&sort=` all work.
 */
export const listPendingEmailsFromDB = async (
  query: Record<string, unknown>,
) => {
  const qb = new QueryBuilder(PendingEmail.find(), query)
    .search(['to', 'subject', 'lastError'])
    .filter()
    .sort()
    .paginate()
    .fields();
  const data = await qb.modelQuery.lean();
  const meta = await qb.getPaginationInfo();
  return { meta, data };
};

/**
 * Admin: requeue a DEAD email. G8 — explicit guard so the operator
 * gets a precise error if they try on a non-DEAD row.
 */
export const requeuePendingEmailInDB = async (pendingEmailId: string) => {
  if (!Types.ObjectId.isValid(pendingEmailId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid pending-email ID format');
  }
  const row = await PendingEmail.findById(pendingEmailId);
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Pending email not found');
  }
  if (row.status !== 'DEAD') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Only DEAD emails can be requeued (current: ${row.status})`,
    );
  }
  await PendingEmail.findByIdAndUpdate(pendingEmailId, {
    $set: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      workerId: null,
      leaseExpiresAt: null,
    },
  });
  return { id: pendingEmailId, status: 'PENDING' };
};

/**
 * Admin: counts grouped by status + kind. For ops dashboards.
 */
export const getPendingEmailStatsFromDB = async () => {
  const byStatus = await PendingEmail.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byKind = await PendingEmail.aggregate([
    {
      $group: {
        _id: { kind: '$kind', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);
  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row._id] = row.count;

  const kindCounts: Record<string, Record<string, number>> = {};
  for (const k of EMAIL_KINDS) kindCounts[k] = {};
  for (const row of byKind) {
    const kind = row._id.kind as string;
    const status = row._id.status as string;
    if (!kindCounts[kind]) kindCounts[kind] = {};
    kindCounts[kind][status] = row.count;
  }
  return { byStatus: statusCounts, byKind: kindCounts };
};

export const PendingEmailService = {
  enqueueAndTrySend,
  processBatch,
  reclaimExpiredLeases,
  listPendingEmailsFromDB,
  requeuePendingEmailInDB,
  getPendingEmailStatsFromDB,
};
