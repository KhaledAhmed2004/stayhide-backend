import { Model, Types } from 'mongoose';

/**
 * SubscriptionEvent — append-only audit log for subscription state changes.
 *
 * Why a separate collection?
 *   `subscriptions.userId` is `unique: true`, so `subscriptions` holds only
 *   the *current* state for each user. Every upgrade, downgrade, renewal,
 *   cancel, refund, or status flip overwrites the previous record and loses
 *   history. This collection preserves each transition so refund disputes,
 *   abuse detection, churn analytics, and forensic debugging have something
 *   to read.
 */

export const SUBSCRIPTION_EVENT_TYPES = [
  'CREATED',
  'UPGRADED',
  'DOWNGRADED',
  'RENEWED',
  'CANCELED',
  'EXPIRED',
  'REFUNDED',
  'GRACE_STARTED',
  'GRACE_RESOLVED',
  'STATUS_CHANGED',
  'PLAN_CHANGED',
] as const;

export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

export type ISubscriptionEvent = {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  eventType: SubscriptionEventType;

  // Snapshot of the plan / status before and after the change.
  previousPlan?: string;
  nextPlan?: string;
  previousStatus?: string;
  nextStatus?: string;

  platform?: 'apple' | 'google' | 'admin';
  productId?: string;

  // External id from the store (Apple transaction, Google order, etc.) — lets
  // us correlate an event back to a webhook / verify call for replay safety.
  externalTransactionId?: string;

  metadata?: Record<string, unknown>;
  occurredAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SubscriptionEventModelType = Model<ISubscriptionEvent>;
