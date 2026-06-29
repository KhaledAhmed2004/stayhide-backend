"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = void 0;
const mongoose_1 = require("mongoose");
const subscription_interface_1 = require("./subscription.interface");
const subscription_event_model_1 = require("./subscription-event.model");
const subscriptionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
        unique: true,
    },
    plan: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_PLAN),
        default: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
    },
    // NOTE: `status` is intentionally NOT defaulted. A subscription record
    // only transitions to `active` after a verified purchase (Apple/Google
    // verify call or explicit admin grant). Defaulting to `active` would
    // hand out paid access to any row that got inserted without hitting the
    // verification code path.
    status: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_STATUS),
        required: true,
    },
    platform: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_PLATFORM),
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
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
subscriptionSchema.statics.findByUser = function (userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return this.findOne({ userId });
    });
};
/**
 * Upserts the current-state `subscriptions` row for a user AND appends an
 * entry to `subscription_events` capturing what changed. The events
 * collection is the durable audit trail — the `subscriptions` row is the
 * single "current state" view.
 */
subscriptionSchema.statics.upsertForUser = function (userId, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // 1. Atomically perform the update and capture the state BEFORE the change.
        // { new: false } returns the document as it was before the update.
        // If the document is newly inserted via upsert, `before` will be null.
        const before = yield this.findOneAndUpdate({ userId }, { $set: Object.assign(Object.assign({}, payload), { userId }) }, { new: false, upsert: true, setDefaultsOnInsert: true });
        // 2. Fetch the state AFTER the change to return to the caller and log the diff.
        const next = yield this.findOne({ userId });
        if (!next) {
            throw new Error('Failed to retrieve subscription after upsert');
        }
        // Diff and log only the meaningful transitions.
        const beforePlan = before === null || before === void 0 ? void 0 : before.plan;
        const afterPlan = next.plan;
        const beforeStatus = before === null || before === void 0 ? void 0 : before.status;
        const afterStatus = next.status;
        const beforeEnd = before === null || before === void 0 ? void 0 : before.currentPeriodEnd;
        const afterEnd = next.currentPeriodEnd;
        const eventTypes = [];
        if (!before) {
            eventTypes.push('CREATED');
        }
        else {
            // 1. Detect Plan Changes (Upgrade/Downgrade)
            if (beforePlan !== afterPlan) {
                const rankBefore = (_a = subscription_interface_1.PLAN_RANK[beforePlan]) !== null && _a !== void 0 ? _a : 0;
                const rankAfter = (_b = subscription_interface_1.PLAN_RANK[afterPlan]) !== null && _b !== void 0 ? _b : 0;
                if (rankAfter > rankBefore) {
                    eventTypes.push('UPGRADED');
                }
                else if (rankAfter < rankBefore) {
                    eventTypes.push('DOWNGRADED');
                }
                else {
                    eventTypes.push('PLAN_CHANGED');
                }
            }
            // 2. Detect Renewals (Period extended without plan change)
            if (beforePlan === afterPlan &&
                beforeEnd &&
                afterEnd &&
                afterEnd.getTime() > beforeEnd.getTime() &&
                afterStatus === subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE) {
                eventTypes.push('RENEWED');
            }
            // 3. Detect Status Transitions
            if (beforeStatus !== afterStatus) {
                if (afterStatus === subscription_interface_1.SUBSCRIPTION_STATUS.CANCELED) {
                    eventTypes.push('CANCELED');
                }
                else if (afterStatus === subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE) {
                    eventTypes.push('EXPIRED');
                }
                else if (afterStatus === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE) {
                    eventTypes.push('GRACE_STARTED');
                }
                else if (beforeStatus === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE &&
                    afterStatus === subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE) {
                    eventTypes.push('GRACE_RESOLVED');
                }
                else {
                    eventTypes.push('STATUS_CHANGED');
                }
            }
        }
        for (const type of eventTypes) {
            try {
                yield subscription_event_model_1.SubscriptionEvent.create({
                    userId,
                    subscriptionId: next._id,
                    eventType: type,
                    previousPlan: beforePlan,
                    nextPlan: afterPlan,
                    previousStatus: beforeStatus,
                    nextStatus: afterStatus,
                    platform: next.platform,
                    productId: next.productId,
                    externalTransactionId: next.appleLatestTransactionId ||
                        next.appleOriginalTransactionId ||
                        next.googleOrderId ||
                        next.googlePurchaseToken,
                    occurredAt: new Date(),
                });
            }
            catch (err) {
                console.error('Failed to write SubscriptionEvent:', err);
            }
        }
        // Synchronize the core subscription state onto the User model directly.
        try {
            yield (0, mongoose_1.model)('User').findByIdAndUpdate(userId, {
                $set: {
                    subscriptionTier: next.plan,
                    subscriptionStatus: next.status,
                    subscriptionExpiryDate: next.currentPeriodEnd,
                    appleOriginalTransactionId: next.appleOriginalTransactionId,
                    googlePurchaseToken: next.googlePurchaseToken,
                },
            });
        }
        catch (err) {
            console.error('Failed to sync subscription to User model:', err);
        }
        return next;
    });
};
exports.Subscription = (0, mongoose_1.model)('Subscription', subscriptionSchema);
