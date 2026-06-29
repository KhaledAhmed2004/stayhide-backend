import { Schema, model } from 'mongoose';

/**
 * Stores webhook payloads that arrived before the user's subscription record
 * was created (orphan webhooks). These are re-processed once the user calls
 * /verify and creates their subscription record.
 */
const pendingWebhookSchema = new Schema(
  {
    // appleOriginalTransactionId or googlePurchaseToken
    externalPurchaseId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['apple', 'google'],
      required: true,
    },
    // The raw webhook payload (signedPayload for Apple, raw PubSub for Google)
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    // TTL of 7 days. If the user doesn't verify their purchase within a week,
    // we drop the orphan webhooks.
    receivedAt: {
      type: Date,
      default: Date.now,
      index: { expires: '7d' },
    },
  },
  { timestamps: true }
);

export const PendingWebhook = model('PendingWebhook', pendingWebhookSchema);
