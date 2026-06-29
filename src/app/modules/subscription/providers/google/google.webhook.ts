import httpStatus from 'http-status';
import ApiError from '../../../../../errors/ApiError';
import config from '../../../../../config';
import { logger, errorLogger } from '../../../../../shared/logger';
import { Subscription as SubscriptionModel } from '../../subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '../../subscription.interface';
import { mapGoogleProductToPlan } from '../../helpers/plan.mapper';
import { getPubsubVerifier } from './google.client';
import { verifyGoogleSubscription } from './google.verify';
import { GoogleWebhookResult } from './google.types';
import { ProcessedWebhook } from '../../processed-webhook.model';
import { PendingWebhook } from '../../pending-webhook.model';

// Google RTDN notification type codes (V1).
// https://developer.android.com/google/play/billing/rtdn-reference
export const GOOGLE_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};

type PubSubMessage = {
  message?: {
    data?: string; // base64
    messageId?: string;
    message_id?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
};

type RTDNPayload = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string; // productId
  };
  testNotification?: {
    version?: string;
  };
  oneTimeProductNotification?: unknown;
};

// Verify the Pub/Sub push request actually came from Google by validating
// the bearer JWT against the configured audience. If no audience is set
// (dev), we skip — but log a warning so it's visible.
export const verifyPubsubJwt = async (
  authorizationHeader: string | undefined
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const audience = config.googlePlay.pubsubAudience;
  if (!audience) {
    logger.warn(
      'GOOGLE_PLAY_PUBSUB_AUDIENCE not set — skipping Pub/Sub JWT verification (dev only)'
    );
    return { ok: true };
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing bearer token' };
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const verifier = getPubsubVerifier();

  try {
    const ticket = await verifier.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload) return { ok: false, reason: 'empty token payload' };

    const expectedEmail = config.googlePlay.pubsubServiceAccountEmail;
    if (expectedEmail && payload.email !== expectedEmail) {
      return {
        ok: false,
        reason: `unexpected token email: ${payload.email}`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: `jwt verification failed: ${message}` };
  }
};

const decodePubsubBody = (rawBody: Buffer | string): PubSubMessage => {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  try {
    return JSON.parse(text) as PubSubMessage;
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Pub/Sub body JSON');
  }
};

const decodeRTDNData = (base64Data: string | undefined): RTDNPayload => {
  if (!base64Data) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Pub/Sub message has no data');
  }
  const json = Buffer.from(base64Data, 'base64').toString('utf8');
  try {
    return JSON.parse(json) as RTDNPayload;
  } catch {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Failed to decode RTDN payload JSON'
    );
  }
};

// State machine for Google RTDN subscription notifications. Returns the
// update delta to persist on the existing subscription document. The latest
// authoritative state is also re-fetched from Google before this is called,
// so we can trust expiryTime / autoRenewing on the decoded subscription.
const buildUpdatesForGoogleNotification = (
  notificationTypeCode: number,
  decodedProductId: string | undefined,
  expiryTime: string | undefined,
  autoRenewing: boolean | undefined
): Partial<ISubscription> => {
  const updates: Partial<ISubscription> = {};
  const expiry = expiryTime ? new Date(expiryTime) : null;

  switch (notificationTypeCode) {
    case 4: // SUBSCRIPTION_PURCHASED
    case 1: // SUBSCRIPTION_RECOVERED
    case 2: // SUBSCRIPTION_RENEWED
    case 7: // SUBSCRIPTION_RESTARTED
      updates.status = SUBSCRIPTION_STATUS.ACTIVE;
      if (decodedProductId) {
        updates.plan = mapGoogleProductToPlan(decodedProductId);
      }
      if (expiry) updates.currentPeriodEnd = expiry;
      updates.gracePeriodEndsAt = null;
      updates.canceledAt = null;
      if (typeof autoRenewing === 'boolean') updates.autoRenewing = autoRenewing;
      return updates;

    case 6: // SUBSCRIPTION_IN_GRACE_PERIOD — billing retry, keep access
      updates.status = SUBSCRIPTION_STATUS.PAST_DUE;
      if (expiry) updates.gracePeriodEndsAt = expiry;
      return updates;

    case 5: // SUBSCRIPTION_ON_HOLD — Grace period expired, payment still failed → NO access.
      // ⚠️ Do NOT map to PAST_DUE. PAST_DUE is in ACTIVE_STATUSES (grace period, keeps access).
      // Account hold is a harder state: billing retries failed, access is suspended.
      updates.status = SUBSCRIPTION_STATUS.INACTIVE;
      return updates;

    case 3: // SUBSCRIPTION_CANCELED — user canceled but keeps access until expiry
      updates.autoRenewing = false;
      updates.canceledAt = new Date();
      return updates;

    case 13: // SUBSCRIPTION_EXPIRED
      updates.status = SUBSCRIPTION_STATUS.INACTIVE;
      updates.plan = SUBSCRIPTION_PLAN.FREE;
      updates.gracePeriodEndsAt = null;
      return updates;

    case 12: // SUBSCRIPTION_REVOKED — refund / chargeback, immediate revoke
      updates.status = SUBSCRIPTION_STATUS.CANCELED;
      updates.plan = SUBSCRIPTION_PLAN.FREE;
      updates.canceledAt = new Date();
      return updates;

    case 10: // SUBSCRIPTION_PAUSED
      updates.status = SUBSCRIPTION_STATUS.INACTIVE;
      return updates;

    case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
    case 9: // SUBSCRIPTION_DEFERRED
    case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
    case 20: // SUBSCRIPTION_PENDING_PURCHASE_CANCELED
    default:
      return updates;
  }
};

export const handleGoogleNotification = async (
  rawBody: Buffer | string,
  authorizationHeader: string | undefined,
  skipAuth = false
): Promise<GoogleWebhookResult> => {
  // 1. Trust check — the request must come from Google Pub/Sub.
  if (!skipAuth) {
    const auth = await verifyPubsubJwt(authorizationHeader);
    if (!auth.ok) {
      logger.warn(`Google webhook rejected: ${auth.reason}`);
      return { processed: false, reason: 'unauthorized' };
    }
  }

  // 2. Parse the Pub/Sub envelope and decode the inner RTDN payload.
  const envelope = decodePubsubBody(rawBody);
  const messageId =
    envelope.message?.messageId || envelope.message?.message_id || '';
  const rtdn = decodeRTDNData(envelope.message?.data);

  // 3. Test notification — Google sends these from the Play Console to
  //    validate the webhook is reachable. Just acknowledge.
  if (rtdn.testNotification) {
    logger.info('Google Play TEST RTDN notification received');
    return { processed: true, reason: 'test' };
  }

  // 4. Only subscription notifications are handled here. One-time product
  //    purchases would need a separate code path.
  const subNotif = rtdn.subscriptionNotification;
  if (!subNotif || !subNotif.purchaseToken) {
    return { processed: false, reason: 'no_subscription_notification' };
  }

  const purchaseToken = subNotif.purchaseToken;
  const notificationTypeCode = subNotif.notificationType ?? -1;
  const notificationType =
    GOOGLE_NOTIFICATION_TYPES[notificationTypeCode] || `UNKNOWN_${notificationTypeCode}`;

  // 5. Find the subscription doc by purchase token.
  const existing = await SubscriptionModel.findOne({
    googlePurchaseToken: purchaseToken,
  });

  if (!existing) {
    // H1 Fix: If not found, it might be an upgrade/downgrade where we only know
    // the old token. Fetch latest state to see if there's a linkedPurchaseToken.
    try {
      const decoded = await verifyGoogleSubscription(
        purchaseToken,
        subNotif.subscriptionId
      );

      if (decoded.linkedPurchaseToken) {
        const linked = await SubscriptionModel.findOne({
          googlePurchaseToken: decoded.linkedPurchaseToken,
        });
        if (linked) {
          // Found it via the linked token! Continue with this record.
          return await processValidatedGoogleNotification(
            linked,
            decoded,
            notificationTypeCode,
            notificationType,
            messageId
          );
        }
      }
    } catch (err) {
      // If verify fails here, we can't do much. Fall through to orphan warning.
    }

    // 🟠 5 Fix: Store the orphan webhook in the queue for later re-processing.
    await PendingWebhook.create({
      externalPurchaseId: purchaseToken,
      provider: 'google',
      payload: rawBody,
    });

    logger.warn(
      `Queued orphan Google RTDN ${notificationType} for purchaseToken=${purchaseToken.slice(0, 12)}...`
    );
    return {
      processed: false,
      notificationType,
      rawNotificationType: notificationTypeCode,
      reason: 'queued_as_orphan',
    };
  }

  // 7. Fetch authoritative state from Google so the local doc reflects
  //    reality (Google docs explicitly recommend this rather than trusting
  //    the notification body alone).
  let decoded;
  try {
    decoded = await verifyGoogleSubscription(
      purchaseToken,
      subNotif.subscriptionId
    );
  } catch (err) {
    errorLogger.error(
      'Failed to fetch latest Google subscription state during RTDN',
      err as Error
    );
    return {
      processed: false,
      notificationType,
      rawNotificationType: notificationTypeCode,
      reason: 'google_api_error', // M5 Fix: Correct reason string
    };
  }

  return await processValidatedGoogleNotification(
    existing,
    decoded,
    notificationTypeCode,
    notificationType,
    messageId
  );
};

/**
 * Shared logic to apply updates once both the DB record and Google state are resolved.
 */
const processValidatedGoogleNotification = async (
  existing: ISubscription,
  decoded: any,
  notificationTypeCode: number,
  notificationType: string,
  messageId: string
): Promise<GoogleWebhookResult> => {
  // ✅ Idempotency — Write-first pattern eliminates TOCTOU race.
  // Two concurrent deliveries of the same messageId could both pass a
  // findOne() check before either writes. Instead we attempt the insert
  // immediately and let the unique index reject the second one atomically.
  if (messageId) {
    try {
      await ProcessedWebhook.create({
        webhookId: messageId,
        provider: 'google',
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key → already processed, safe to acknowledge and ignore.
        return {
          processed: false,
          notificationType,
          rawNotificationType: notificationTypeCode,
          reason: 'duplicate',
        };
      }
      throw err; // unexpected DB error — bubble up so webhook is not 200'd
    }
  }

  const updates = buildUpdatesForGoogleNotification(
    notificationTypeCode,
    decoded.productId,
    decoded.expiryTime,
    decoded.autoRenewing
  );

  const newMetadata: Record<string, unknown> = {
    ...(existing.metadata || {}),
    lastGoogleMessageId: messageId || undefined,
    lastGoogleNotificationType: notificationType,
    lastGoogleNotificationCode: notificationTypeCode,
    lastGoogleNotificationAt: new Date().toISOString(),
  };

  await SubscriptionModel.upsertForUser(existing.userId, {
    ...updates,
    googlePurchaseToken: decoded.purchaseToken, // Migrate to latest token on upgrade
    googleOrderId: decoded.orderId || existing.googleOrderId,
    metadata: newMetadata,
  });

  logger.info(
    `Google RTDN ${notificationType} applied to subscription ${existing._id}`
  );

  return {
    processed: true,
    notificationType,
    rawNotificationType: notificationTypeCode,
    reason: 'applied',
  };
};
