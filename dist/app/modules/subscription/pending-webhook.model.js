"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingWebhook = void 0;
const mongoose_1 = require("mongoose");
/**
 * Stores webhook payloads that arrived before the user's subscription record
 * was created (orphan webhooks). These are re-processed once the user calls
 * /verify and creates their subscription record.
 */
const pendingWebhookSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    // TTL of 7 days. If the user doesn't verify their purchase within a week,
    // we drop the orphan webhooks.
    receivedAt: {
        type: Date,
        default: Date.now,
        index: { expires: '7d' },
    },
}, { timestamps: true });
exports.PendingWebhook = (0, mongoose_1.model)('PendingWebhook', pendingWebhookSchema);
