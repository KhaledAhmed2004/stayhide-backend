"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionEvent = void 0;
const mongoose_1 = require("mongoose");
const subscription_event_interface_1 = require("./subscription-event.interface");
const subscriptionEventSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Subscription',
        required: true,
        index: true,
    },
    eventType: {
        type: String,
        enum: subscription_event_interface_1.SUBSCRIPTION_EVENT_TYPES,
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
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    occurredAt: { type: Date, required: true, default: () => new Date() },
}, { timestamps: true });
// Compound index for "show me this user's subscription history in order".
subscriptionEventSchema.index({ userId: 1, occurredAt: -1 });
exports.SubscriptionEvent = (0, mongoose_1.model)('SubscriptionEvent', subscriptionEventSchema);
