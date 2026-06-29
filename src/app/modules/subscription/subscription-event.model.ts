import { Schema, model } from 'mongoose';
import {
  ISubscriptionEvent,
  SUBSCRIPTION_EVENT_TYPES,
  SubscriptionEventModelType,
} from './subscription-event.interface';

const subscriptionEventSchema = new Schema<ISubscriptionEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: SUBSCRIPTION_EVENT_TYPES,
      required: true,
      index: true,
    },

    previousPlan: { type: String },
    nextPlan: { type: String },
    previousStatus: { type: String },
    nextStatus: { type: String },

    platform: { type: String, enum: ['apple', 'google', 'admin'] },
    productId: { type: String },
    externalTransactionId: { type: String, index: true },

    metadata: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

// Compound index for "show me this user's subscription history in order".
subscriptionEventSchema.index({ userId: 1, occurredAt: -1 });

export const SubscriptionEvent = model<ISubscriptionEvent, SubscriptionEventModelType>(
  'SubscriptionEvent',
  subscriptionEventSchema,
);
