import httpStatus from 'http-status';
import { NotificationTypeV2 } from '@apple/app-store-server-library';
import ApiError from '../../../../../errors/ApiError';
import { logger, errorLogger } from '../../../../../shared/logger';
import { getAppleVerifier } from './apple.client';
import { Subscription as SubscriptionModel } from '../../subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '../../subscription.interface';
import { mapAppleProductToPlan } from '../../helpers/plan.mapper';
import { AppleWebhookResult } from './apple.types';
import { ProcessedWebhook } from '../../processed-webhook.model';
import { PendingWebhook } from '../../pending-webhook.model';

// Apply the Apple webhook state-machine to an existing subscription document.
// Returns the update delta to persist. All logic is expressed here so the
// caller only has to persist and log — no business logic at the edges.
const buildUpdatesForNotification = (
  notificationType: string,
  subtype: string | undefined,
  decodedTransaction: {
    productId?: string;
    expiresDate?: number;
    transactionId?: string;
  }
): Partial<ISubscription> => {
  const updates: Partial<ISubscription> = {};

  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED: {
      updates.status = SUBSCRIPTION_STATUS.ACTIVE;
      if (decodedTransaction.productId) {
        updates.plan = mapAppleProductToPlan(decodedTransaction.productId);
      }
      if (decodedTransaction.expiresDate) {
        updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
      }
      if (decodedTransaction.transactionId) {
        updates.appleLatestTransactionId = decodedTransaction.transactionId;
      }
      updates.canceledAt = null;
      updates.gracePeriodEndsAt = null;
      return updates;
    }

    case NotificationTypeV2.DID_RENEW: {
      updates.status = SUBSCRIPTION_STATUS.ACTIVE;
      if (decodedTransaction.productId) {
        updates.plan = mapAppleProductToPlan(decodedTransaction.productId);
      }
      if (decodedTransaction.expiresDate) {
        updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
      }
      if (decodedTransaction.transactionId) {
        updates.appleLatestTransactionId = decodedTransaction.transactionId;
      }
      updates.gracePeriodEndsAt = null;
      return updates;
    }

    case NotificationTypeV2.DID_FAIL_TO_RENEW: {
      // Billing retry phase — keep entitlement during grace period.
      updates.status = SUBSCRIPTION_STATUS.PAST_DUE;
      if (decodedTransaction.expiresDate) {
        updates.gracePeriodEndsAt = new Date(decodedTransaction.expiresDate);
      }
      return updates;
    }

    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
    case NotificationTypeV2.EXPIRED: {
      updates.status = SUBSCRIPTION_STATUS.INACTIVE;
      updates.plan = SUBSCRIPTION_PLAN.FREE;
      updates.gracePeriodEndsAt = null;
      return updates;
    }

    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.REVOKE: {
      // Per product decision: refunds immediately revoke entitlement.
      updates.status = SUBSCRIPTION_STATUS.CANCELED;
      updates.plan = SUBSCRIPTION_PLAN.FREE;
      updates.canceledAt = new Date();
      return updates;
    }

    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: {
      // subtype is AUTO_RENEW_ENABLED or AUTO_RENEW_DISABLED
      updates.autoRenewing = subtype === 'AUTO_RENEW_ENABLED';
      return updates;
    }

    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF: {
      // Plan change scheduled — the actual plan switch lands on DID_RENEW.
      // Nothing to persist here.
      return updates;
    }

    case NotificationTypeV2.PRICE_INCREASE: {
      // subtype is PENDING (user not yet consented) or ACCEPTED.
      // If the user doesn't accept, Apple will cancel at period end —
      // we mark autoRenewing false now as a pessimistic defensive move.
      // When/if they accept, DID_RENEW will restore active state.
      if (subtype !== 'ACCEPTED') {
        updates.autoRenewing = false;
      }
      return updates;
    }

    case NotificationTypeV2.OFFER_REDEEMED: {
      // User redeemed a promotional offer (free trial, discount).
      // The transaction contains the new productId (may differ from current).
      // Update plan + period end to reflect the offer terms.
      updates.status = SUBSCRIPTION_STATUS.ACTIVE;
      if (decodedTransaction.productId) {
        updates.plan = mapAppleProductToPlan(decodedTransaction.productId);
      }
      if (decodedTransaction.expiresDate) {
        updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
      }
      if (decodedTransaction.transactionId) {
        updates.appleLatestTransactionId = decodedTransaction.transactionId;
      }
      return updates;
    }

    default:
      return updates;
  }
};

export const handleAppleNotification = async (
  signedPayload: string
): Promise<AppleWebhookResult> => {
  if (!signedPayload || typeof signedPayload !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'signedPayload is required');
  }

  const verifier = getAppleVerifier();

  let notification;
  try {
    notification = await verifier.verifyAndDecodeNotification(signedPayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Apple notification verification failed: ${message}`
    );
  }

  const notificationType = String(notification.notificationType || '');
  const subtype =
    notification.subtype !== undefined ? String(notification.subtype) : undefined;
  const notificationUUID = notification.notificationUUID;

  // Apple uses TEST notifications for webhook configuration validation.
  if (notificationType === NotificationTypeV2.TEST) {
    logger.info('Apple TEST notification received — webhook reachable');
    return { processed: true, notificationType, subtype };
  }

  // Decode the nested signedTransactionInfo to find the subscription.
  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    logger.warn(
      `Apple notification ${notificationType} has no signedTransactionInfo, skipping`
    );
    return {
      processed: false,
      notificationType,
      subtype,
      reason: 'no_transaction_info',
    };
  }

  let decodedTransaction;
  try {
    decodedTransaction = await verifier.verifyAndDecodeTransaction(
      signedTransactionInfo
    );
  } catch (err) {
    errorLogger.error(
      'Failed to decode signedTransactionInfo in Apple notification',
      err as Error
    );
    return {
      processed: false,
      notificationType,
      subtype,
      reason: 'no_transaction_info',
    };
  }

  const originalTransactionId = decodedTransaction.originalTransactionId;
  if (!originalTransactionId) {
    return {
      processed: false,
      notificationType,
      subtype,
      reason: 'no_transaction_info',
    };
  }

  const existing = await SubscriptionModel.findOne({
    appleOriginalTransactionId: originalTransactionId,
  });

  if (!existing) {
    // 🟠 5 Fix: Store the orphan webhook in the queue for later re-processing.
    await PendingWebhook.create({
      externalPurchaseId: originalTransactionId,
      provider: 'apple',
      payload: signedPayload,
    });

    logger.warn(
      `Queued orphan Apple notification ${notificationType} for originalTransactionId=${originalTransactionId}`
    );
    return {
      processed: false,
      notificationType,
      subtype,
      reason: 'queued_as_orphan',
    };
  }

  // ✅ Idempotency — Write-first pattern eliminates TOCTOU race.
  // Two concurrent deliveries of the same notificationUUID could both pass
  // a findOne() check before either writes. We attempt the DB insert first
  // and rely on the unique index to reject the second atomically.
  if (notificationUUID) {
    try {
      await ProcessedWebhook.create({
        webhookId: notificationUUID,
        provider: 'apple',
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key → already processed.
        return {
          processed: false,
          notificationType,
          subtype,
          reason: 'duplicate',
        };
      }
      throw err; // unexpected DB error — bubble up
    }
  }

  const updates = buildUpdatesForNotification(notificationType, subtype, {
    productId: decodedTransaction.productId,
    expiresDate: decodedTransaction.expiresDate,
    transactionId: decodedTransaction.transactionId,
  });

  const newMetadata: Record<string, unknown> = {
    ...(existing.metadata || {}),
    lastAppleNotificationUUID: notificationUUID,
    lastAppleNotificationType: notificationType,
    lastAppleNotificationSubtype: subtype,
    lastAppleNotificationAt: new Date().toISOString(),
  };

  await SubscriptionModel.upsertForUser(existing.userId, {
    ...updates,
    metadata: newMetadata,
  });

  logger.info(
    `Apple notification ${notificationType}${subtype ? `/${subtype}` : ''} applied to subscription ${existing._id}`
  );

  return {
    processed: true,
    notificationType,
    subtype,
    reason: 'applied',
  };
};
