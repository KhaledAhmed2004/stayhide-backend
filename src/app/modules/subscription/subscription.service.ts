import { Types } from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { Subscription as SubscriptionModel } from './subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLATFORM,
  SUBSCRIPTION_STATUS,
} from './subscription.interface';
import { verifyAppleTransaction } from './providers/apple/apple.verify';
import { handleAppleNotification } from './providers/apple/apple.webhook';
import { AppleWebhookResult } from './providers/apple/apple.types';
import { verifyGoogleSubscription } from './providers/google/google.verify';
import { handleGoogleNotification } from './providers/google/google.webhook';
import { GoogleWebhookResult } from './providers/google/google.types';
import {
  mapAppleProductToPlan,
  mapGoogleProductToPlan,
} from './helpers/plan.mapper';
import { PendingWebhook } from './pending-webhook.model';
import { SubscriptionEvent } from './subscription-event.model';
import { ISubscriptionEvent } from './subscription-event.interface';
import { ProcessedWebhook } from './processed-webhook.model';

// --- Admin Service Methods ---

export const getAllSubscriptions = async (
  query: Record<string, any>
): Promise<{ data: ISubscription[]; total: number }> => {
  const { page = 1, limit = 10, plan, status, platform } = query;
  const filter: any = {};
  if (plan) filter.plan = plan;
  if (status) filter.status = status;
  if (platform) filter.platform = platform;

  const [data, total] = await Promise.all([
    SubscriptionModel.find(filter)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ updatedAt: -1 })
      .populate('userId', 'name email'),
    SubscriptionModel.countDocuments(filter),
  ]);

  return { data, total };
};

export const getSubscriptionAnalytics = async () => {
  const planDistribution = await SubscriptionModel.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
  ]);

  const platformDistribution = await SubscriptionModel.aggregate([
    { $group: { _id: '$platform', count: { $sum: 1 } } },
  ]);

  const activeCount = await SubscriptionModel.countDocuments({
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });

  return {
    planDistribution,
    platformDistribution,
    activeCount,
  };
};

export const getPendingWebhooks = async () => {
  return PendingWebhook.find().sort({ receivedAt: -1 }).limit(100);
};

export const getSubscriptionById = async (
  id: string
): Promise<ISubscription | null> => {
  return SubscriptionModel.findById(id).populate('userId', 'name email');
};

export const getSubscriptionEvents = async (
  userId: string
): Promise<ISubscriptionEvent[]> => {
  return SubscriptionEvent.find({ userId: new Types.ObjectId(userId) }).sort({
    occurredAt: -1,
  });
};

export const adminGrantPlan = async (
  userId: string,
  plan: SUBSCRIPTION_PLAN
): Promise<ISubscription> => {
  const uId = new Types.ObjectId(userId);
  return SubscriptionModel.upsertForUser(uId, {
    plan,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN,
    productId: `admin_granted_${plan.toLowerCase()}`,
    currentPeriodEnd: null, // Admin grants are usually perpetual unless managed manually
  });
};

export const adminResetPlan = async (userId: string): Promise<ISubscription> => {
  const uId = new Types.ObjectId(userId);
  return SubscriptionModel.upsertForUser(uId, {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN,
    productId: undefined,
    currentPeriodEnd: null,
    canceledAt: new Date(),
  });
};

// --- End Admin Service Methods ---


const ensureSubscriptionDoc = async (
  userId: string
): Promise<ISubscription> => {
  const id = new Types.ObjectId(userId);
  const doc = await SubscriptionModel.findByUser(id);
  if (doc) return doc;

  // We use findOneAndUpdate directly here instead of upsertForUser to avoid
  // writing a 'CREATED' event to the audit log for every first-time profile view.
  // The zero-state FREE record is not a meaningful subscription event.
  return (await SubscriptionModel.findOneAndUpdate(
    { userId: id },
    {
      $set: {
        plan: SUBSCRIPTION_PLAN.FREE,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      },
    },
    { new: true, upsert: true }
  )) as ISubscription;
};

export const getMySubscription = async (
  userId: string
): Promise<ISubscription> => {
  return ensureSubscriptionDoc(userId);
};

export const setFreePlan = async (userId: string): Promise<ISubscription> => {
  const uId = new Types.ObjectId(userId);
  const existing = await SubscriptionModel.findByUser(uId);

  // C2 Fix: Guard against active store subscriptions.
  // If a user has an active Apple/Google subscription, we cannot unilaterally
  // downgrade them to FREE, as the store remains the source of truth.
  if (
    existing &&
    existing.platform !== SUBSCRIPTION_PLATFORM.ADMIN &&
    (existing.status === SUBSCRIPTION_STATUS.ACTIVE ||
      existing.status === SUBSCRIPTION_STATUS.TRIALING ||
      existing.status === SUBSCRIPTION_STATUS.PAST_DUE) &&
    existing.currentPeriodEnd &&
    existing.currentPeriodEnd > new Date()
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'You have an active store subscription. Please cancel it through the App Store or Play Store first.'
    );
  }

  return SubscriptionModel.upsertForUser(uId, {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN, // Mark as admin-reset
  });
};

export const verifyApplePurchase = async (
  userId: string,
  signedTransactionInfo: string
): Promise<ISubscription> => {
  // 1. Cryptographically verify the JWS with Apple's library.
  const decoded = await verifyAppleTransaction(signedTransactionInfo);

  // C3 Fix: Reject if this transaction has been superseded by an upgrade.
  if (decoded.isUpgraded) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This transaction has been superseded by an upgrade. Please verify the latest transaction.'
    );
  }

  // 2. Fraud guard: reject if this transaction is already bound to a
  //    different user account.
  const existingByTx = await SubscriptionModel.findOne({
    appleOriginalTransactionId: decoded.originalTransactionId,
  });
  if (existingByTx && existingByTx.userId.toString() !== userId) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This Apple transaction is already linked to another account'
    );
  }

  // 3. Map the store-side productId to a local plan.
  const plan = mapAppleProductToPlan(decoded.productId);
  if (plan === SUBSCRIPTION_PLAN.FREE) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unknown or unsupported productId: ${decoded.productId}`
    );
  }

  // 4. Persist the subscription for this user.
  const updated = await SubscriptionModel.upsertForUser(
    new Types.ObjectId(userId),
    {
      plan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      platform: SUBSCRIPTION_PLATFORM.APPLE,
      environment: decoded.environment,
      productId: decoded.productId,
      appleOriginalTransactionId: decoded.originalTransactionId,
      appleLatestTransactionId: decoded.transactionId,
      startedAt: new Date(decoded.purchaseDate),
      currentPeriodEnd: decoded.expiresDate
        ? new Date(decoded.expiresDate)
        : null,
      canceledAt: null,
      gracePeriodEndsAt: null,
      metadata: {
        appAccountToken: decoded.appAccountToken,
        bundleId: decoded.bundleId,
      },
    }
  );

  // 5. Re-process any orphan webhooks that arrived before this verify call.
  // We don't await this so the user gets their response immediately.
  reprocessPendingWebhooks(decoded.originalTransactionId, 'apple').catch(
    err => {
      console.error('Failed to re-process pending Apple webhooks:', err);
    }
  );

  return updated;
};

export const processAppleWebhook = async (
  signedPayload: string
): Promise<AppleWebhookResult> => {
  return handleAppleNotification(signedPayload);
};

export const verifyGooglePurchase = async (
  userId: string,
  purchaseToken: string,
  productId: string
): Promise<ISubscription> => {
  // 1. Pull the authoritative subscription state from Google.
  const decoded = await verifyGoogleSubscription(purchaseToken, productId);

  // 2. Fraud guard: a purchase token must not be linked to a different user.
  // C1 Fix: Handle linkedPurchaseToken (upgrades/downgrades).
  // If the user upgraded, the new token is in purchaseToken, and the old token
  // is in linkedPurchaseToken. We should check both to find the existing row.
  const existingByToken = await SubscriptionModel.findOne({
    $or: [
      { googlePurchaseToken: decoded.purchaseToken },
      ...(decoded.linkedPurchaseToken
        ? [{ googlePurchaseToken: decoded.linkedPurchaseToken }]
        : []),
    ],
  });

  if (existingByToken && existingByToken.userId.toString() !== userId) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This Google purchase is already linked to another account'
    );
  }

  // 3. Map productId → local plan.
  const plan = mapGoogleProductToPlan(decoded.productId);
  if (plan === SUBSCRIPTION_PLAN.FREE) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unknown or unsupported productId: ${decoded.productId}`
    );
  }

  // 4. Translate Google's subscriptionState into our local status.
  const isActiveState =
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  if (!isActiveState) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Google subscription is not active (state: ${decoded.subscriptionState})`
    );
  }
  const localStatus =
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
      ? SUBSCRIPTION_STATUS.PAST_DUE
      : SUBSCRIPTION_STATUS.ACTIVE;

  // 5. Persist for this user.
  const updated = await SubscriptionModel.upsertForUser(
    new Types.ObjectId(userId),
    {
      plan,
      status: localStatus,
      platform: SUBSCRIPTION_PLATFORM.GOOGLE,
      environment: decoded.environment,
      productId: decoded.productId,
      autoRenewing: decoded.autoRenewing,
      googlePurchaseToken: decoded.purchaseToken,
      googleOrderId: decoded.orderId,
      startedAt: decoded.startTime ? new Date(decoded.startTime) : null,
      currentPeriodEnd: decoded.expiryTime
        ? new Date(decoded.expiryTime)
        : null,
      canceledAt: null,
      gracePeriodEndsAt:
        localStatus === SUBSCRIPTION_STATUS.PAST_DUE && decoded.expiryTime
          ? new Date(decoded.expiryTime)
          : null,
      metadata: {
        acknowledgementState: decoded.acknowledgementState,
        linkedPurchaseToken: decoded.linkedPurchaseToken,
        testPurchase: decoded.testPurchase,
      },
    }
  );

  // 6. Re-process any orphan webhooks.
  reprocessPendingWebhooks(decoded.purchaseToken, 'google').catch(err => {
    console.error('Failed to re-process pending Google webhooks:', err);
  });

  return updated;
};

export const processGoogleWebhook = async (
  rawBody: Buffer | string,
  authorizationHeader: string | undefined
): Promise<GoogleWebhookResult> => {
  return handleGoogleNotification(rawBody, authorizationHeader);
};

const reprocessPendingWebhooks = async (
  externalPurchaseId: string,
  provider: 'apple' | 'google'
) => {
  const pending = await PendingWebhook.find({
    externalPurchaseId,
    provider,
  }).sort({ receivedAt: 1 });

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      if (provider === 'apple') {
        await handleAppleNotification(item.payload as string);
      } else {
        await handleGoogleNotification(item.payload as Buffer, undefined, true);
      }
      // Delete after successful processing
      await PendingWebhook.findByIdAndDelete(item._id);
    } catch (err) {
      console.error(
        `Failed to re-process pending ${provider} webhook ${item._id}:`,
        err
      );
    }
  }
};

const SubscriptionService = {
  getMySubscription,
  setFreePlan,
  verifyApplePurchase,
  processAppleWebhook,
  verifyGooglePurchase,
  processGoogleWebhook,
  getAllSubscriptions,
  getSubscriptionAnalytics,
  getPendingWebhooks,
  getSubscriptionById,
  getSubscriptionEvents,
  adminGrantPlan,
  adminResetPlan,
};

export default SubscriptionService;
