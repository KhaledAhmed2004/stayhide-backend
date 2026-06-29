import { Schema, model, Types } from 'mongoose';
import {
  ISubscription,
  SubscriptionModel,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLATFORM,
  PLAN_RANK,
} from './subscription.interface';
import { SubscriptionEvent } from './subscription-event.model';
import { SubscriptionEventType } from './subscription-event.interface';

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN),
      default: SUBSCRIPTION_PLAN.FREE,
    },
    // NOTE: `status` is intentionally NOT defaulted. A subscription record
    // only transitions to `active` after a verified purchase (Apple/Google
    // verify call or explicit admin grant). Defaulting to `active` would
    // hand out paid access to any row that got inserted without hitting the
    // verification code path.
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      required: true,
    },
    platform: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLATFORM),
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
    },
    productId: { type: String, index: true },
    autoRenewing: { type: Boolean },

    // Apple-specific — unique per originalTransactionId prevents the same
    // Apple purchase from being linked to multiple users (fraud prevention).
    appleOriginalTransactionId: {
      type: String,
      index: true,
      sparse: true,
      unique: true,
    },
    appleLatestTransactionId: { type: String },

    // Google-specific — populated in the next phase.
    googlePurchaseToken: {
      type: String,
      index: true,
      sparse: true,
      unique: true,
    },
    googleOrderId: { type: String },

    // Lifecycle timestamps
    startedAt: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

subscriptionSchema.statics.findByUser = async function (userId: Types.ObjectId) {
  return this.findOne({ userId });
};

/**
 * Upserts the current-state `subscriptions` row for a user AND appends an
 * entry to `subscription_events` capturing what changed. The events
 * collection is the durable audit trail — the `subscriptions` row is the
 * single "current state" view.
 */
subscriptionSchema.statics.upsertForUser = async function (
  userId: Types.ObjectId,
  payload: Partial<ISubscription>
) {
  // 1. Atomically perform the update and capture the state BEFORE the change.
  // { new: false } returns the document as it was before the update.
  // If the document is newly inserted via upsert, `before` will be null.
  const before = await this.findOneAndUpdate(
    { userId },
    { $set: { ...payload, userId } },
    { new: false, upsert: true, setDefaultsOnInsert: true }
  );

  // 2. Fetch the state AFTER the change to return to the caller and log the diff.
  const next = await this.findOne({ userId });
  if (!next) {
    throw new Error('Failed to retrieve subscription after upsert');
  }

  // Diff and log only the meaningful transitions.
  const beforePlan = before?.plan;
  const afterPlan = next.plan;
  const beforeStatus = before?.status;
  const afterStatus = next.status;
  const beforeEnd = before?.currentPeriodEnd;
  const afterEnd = next.currentPeriodEnd;

  const eventTypes: SubscriptionEventType[] = [];

  if (!before) {
    eventTypes.push('CREATED');
  } else {
    // 1. Detect Plan Changes (Upgrade/Downgrade)
    if (beforePlan !== afterPlan) {
      const rankBefore = PLAN_RANK[beforePlan as SUBSCRIPTION_PLAN] ?? 0;
      const rankAfter = PLAN_RANK[afterPlan as SUBSCRIPTION_PLAN] ?? 0;

      if (rankAfter > rankBefore) {
        eventTypes.push('UPGRADED');
      } else if (rankAfter < rankBefore) {
        eventTypes.push('DOWNGRADED');
      } else {
        eventTypes.push('PLAN_CHANGED');
      }
    }

    // 2. Detect Renewals (Period extended without plan change)
    if (
      beforePlan === afterPlan &&
      beforeEnd &&
      afterEnd &&
      afterEnd.getTime() > beforeEnd.getTime() &&
      afterStatus === SUBSCRIPTION_STATUS.ACTIVE
    ) {
      eventTypes.push('RENEWED');
    }

    // 3. Detect Status Transitions
    if (beforeStatus !== afterStatus) {
      if (afterStatus === SUBSCRIPTION_STATUS.CANCELED) {
        eventTypes.push('CANCELED');
      } else if (afterStatus === SUBSCRIPTION_STATUS.INACTIVE) {
        eventTypes.push('EXPIRED');
      } else if (afterStatus === SUBSCRIPTION_STATUS.PAST_DUE) {
        eventTypes.push('GRACE_STARTED');
      } else if (
        beforeStatus === SUBSCRIPTION_STATUS.PAST_DUE &&
        afterStatus === SUBSCRIPTION_STATUS.ACTIVE
      ) {
        eventTypes.push('GRACE_RESOLVED');
      } else {
        eventTypes.push('STATUS_CHANGED');
      }
    }
  }

  for (const type of eventTypes) {
    try {
      await SubscriptionEvent.create({
        userId,
        subscriptionId: next._id,
        eventType: type,
        previousPlan: beforePlan,
        nextPlan: afterPlan,
        previousStatus: beforeStatus,
        nextStatus: afterStatus,
        platform: next.platform,
        productId: next.productId,
        externalTransactionId:
          next.appleLatestTransactionId ||
          next.appleOriginalTransactionId ||
          next.googleOrderId ||
          next.googlePurchaseToken,
        occurredAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to write SubscriptionEvent:', err);
    }
  }

  // Synchronize the core subscription state onto the User model directly.
  try {
    await model('User').findByIdAndUpdate(userId, {
      $set: {
        subscriptionTier: next.plan,
        subscriptionStatus: next.status,
        subscriptionExpiryDate: next.currentPeriodEnd,
        appleOriginalTransactionId: next.appleOriginalTransactionId,
        googlePurchaseToken: next.googlePurchaseToken,
      },
    });
  } catch (err) {
    console.error('Failed to sync subscription to User model:', err);
  }

  return next;
};

export const Subscription = model<ISubscription, SubscriptionModel>(
  'Subscription',
  subscriptionSchema
);
