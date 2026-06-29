"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessedWebhook = void 0;
const mongoose_1 = require("mongoose");
/**
 * Tracks processed webhook event IDs (notificationUUID for Apple, messageId for Google)
 * to ensure idempotency. Events are automatically pruned after 30 days via TTL index.
 */
const processedWebhookSchema = new mongoose_1.Schema({
    webhookId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    provider: {
        type: String,
        enum: ['apple', 'google'],
        required: true,
    },
    // The `expires` option on a Date field creates a TTL index in MongoDB.
    // The document will be automatically deleted 30 days after `processedAt`.
    processedAt: {
        type: Date,
        default: Date.now,
        index: { expires: '30d' },
    },
}, { timestamps: true });
exports.ProcessedWebhook = (0, mongoose_1.model)('ProcessedWebhook', processedWebhookSchema);
