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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGoogleWebhook = exports.verifyGooglePurchase = exports.processAppleWebhook = exports.verifyApplePurchase = exports.setFreePlan = exports.getMySubscription = exports.adminResetPlan = exports.adminGrantPlan = exports.getSubscriptionEvents = exports.getSubscriptionById = exports.getPendingWebhooks = exports.getSubscriptionAnalytics = exports.getAllSubscriptions = void 0;
const mongoose_1 = require("mongoose");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const subscription_model_1 = require("./subscription.model");
const subscription_interface_1 = require("./subscription.interface");
const apple_verify_1 = require("./providers/apple/apple.verify");
const apple_webhook_1 = require("./providers/apple/apple.webhook");
const google_verify_1 = require("./providers/google/google.verify");
const google_webhook_1 = require("./providers/google/google.webhook");
const plan_mapper_1 = require("./helpers/plan.mapper");
const pending_webhook_model_1 = require("./pending-webhook.model");
const subscription_event_model_1 = require("./subscription-event.model");
// --- Admin Service Methods ---
const getAllSubscriptions = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = 1, limit = 10, plan, status, platform } = query;
    const filter = {};
    if (plan)
        filter.plan = plan;
    if (status)
        filter.status = status;
    if (platform)
        filter.platform = platform;
    const [data, total] = yield Promise.all([
        subscription_model_1.Subscription.find(filter)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .sort({ updatedAt: -1 })
            .populate('userId', 'name email'),
        subscription_model_1.Subscription.countDocuments(filter),
    ]);
    return { data, total };
});
exports.getAllSubscriptions = getAllSubscriptions;
const getSubscriptionAnalytics = () => __awaiter(void 0, void 0, void 0, function* () {
    const planDistribution = yield subscription_model_1.Subscription.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);
    const platformDistribution = yield subscription_model_1.Subscription.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } },
    ]);
    const activeCount = yield subscription_model_1.Subscription.countDocuments({
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
    });
    return {
        planDistribution,
        platformDistribution,
        activeCount,
    };
});
exports.getSubscriptionAnalytics = getSubscriptionAnalytics;
const getPendingWebhooks = () => __awaiter(void 0, void 0, void 0, function* () {
    return pending_webhook_model_1.PendingWebhook.find().sort({ receivedAt: -1 }).limit(100);
});
exports.getPendingWebhooks = getPendingWebhooks;
const getSubscriptionById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return subscription_model_1.Subscription.findById(id).populate('userId', 'name email');
});
exports.getSubscriptionById = getSubscriptionById;
const getSubscriptionEvents = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return subscription_event_model_1.SubscriptionEvent.find({ userId: new mongoose_1.Types.ObjectId(userId) }).sort({
        occurredAt: -1,
    });
});
exports.getSubscriptionEvents = getSubscriptionEvents;
const adminGrantPlan = (userId, plan) => __awaiter(void 0, void 0, void 0, function* () {
    const uId = new mongoose_1.Types.ObjectId(userId);
    return subscription_model_1.Subscription.upsertForUser(uId, {
        plan,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN,
        productId: `admin_granted_${plan.toLowerCase()}`,
        currentPeriodEnd: null, // Admin grants are usually perpetual unless managed manually
    });
});
exports.adminGrantPlan = adminGrantPlan;
const adminResetPlan = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const uId = new mongoose_1.Types.ObjectId(userId);
    return subscription_model_1.Subscription.upsertForUser(uId, {
        plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN,
        productId: undefined,
        currentPeriodEnd: null,
        canceledAt: new Date(),
    });
});
exports.adminResetPlan = adminResetPlan;
// --- End Admin Service Methods ---
const ensureSubscriptionDoc = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const id = new mongoose_1.Types.ObjectId(userId);
    const doc = yield subscription_model_1.Subscription.findByUser(id);
    if (doc)
        return doc;
    // We use findOneAndUpdate directly here instead of upsertForUser to avoid
    // writing a 'CREATED' event to the audit log for every first-time profile view.
    // The zero-state FREE record is not a meaningful subscription event.
    return (yield subscription_model_1.Subscription.findOneAndUpdate({ userId: id }, {
        $set: {
            plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
            status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        },
    }, { new: true, upsert: true }));
});
const getMySubscription = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return ensureSubscriptionDoc(userId);
});
exports.getMySubscription = getMySubscription;
const setFreePlan = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const uId = new mongoose_1.Types.ObjectId(userId);
    const existing = yield subscription_model_1.Subscription.findByUser(uId);
    // C2 Fix: Guard against active store subscriptions.
    // If a user has an active Apple/Google subscription, we cannot unilaterally
    // downgrade them to FREE, as the store remains the source of truth.
    if (existing &&
        existing.platform !== subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN &&
        (existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE ||
            existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.TRIALING ||
            existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE) &&
        existing.currentPeriodEnd &&
        existing.currentPeriodEnd > new Date()) {
        throw new ApiError_1.default(http_status_1.default.CONFLICT, 'You have an active store subscription. Please cancel it through the App Store or Play Store first.');
    }
    return subscription_model_1.Subscription.upsertForUser(uId, {
        plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN, // Mark as admin-reset
    });
});
exports.setFreePlan = setFreePlan;
const verifyApplePurchase = (userId, signedTransactionInfo) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Cryptographically verify the JWS with Apple's library.
    const decoded = yield (0, apple_verify_1.verifyAppleTransaction)(signedTransactionInfo);
    // C3 Fix: Reject if this transaction has been superseded by an upgrade.
    if (decoded.isUpgraded) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'This transaction has been superseded by an upgrade. Please verify the latest transaction.');
    }
    // 2. Fraud guard: reject if this transaction is already bound to a
    //    different user account.
    const existingByTx = yield subscription_model_1.Subscription.findOne({
        appleOriginalTransactionId: decoded.originalTransactionId,
    });
    if (existingByTx && existingByTx.userId.toString() !== userId) {
        throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Apple transaction is already linked to another account');
    }
    // 3. Map the store-side productId to a local plan.
    const plan = (0, plan_mapper_1.mapAppleProductToPlan)(decoded.productId);
    if (plan === subscription_interface_1.SUBSCRIPTION_PLAN.FREE) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Unknown or unsupported productId: ${decoded.productId}`);
    }
    // 4. Persist the subscription for this user.
    const updated = yield subscription_model_1.Subscription.upsertForUser(new mongoose_1.Types.ObjectId(userId), {
        plan,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.APPLE,
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
    });
    // 5. Re-process any orphan webhooks that arrived before this verify call.
    // We don't await this so the user gets their response immediately.
    reprocessPendingWebhooks(decoded.originalTransactionId, 'apple').catch(err => {
        console.error('Failed to re-process pending Apple webhooks:', err);
    });
    return updated;
});
exports.verifyApplePurchase = verifyApplePurchase;
const processAppleWebhook = (signedPayload) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, apple_webhook_1.handleAppleNotification)(signedPayload);
});
exports.processAppleWebhook = processAppleWebhook;
const verifyGooglePurchase = (userId, purchaseToken, productId) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Pull the authoritative subscription state from Google.
    const decoded = yield (0, google_verify_1.verifyGoogleSubscription)(purchaseToken, productId);
    // 2. Fraud guard: a purchase token must not be linked to a different user.
    // C1 Fix: Handle linkedPurchaseToken (upgrades/downgrades).
    // If the user upgraded, the new token is in purchaseToken, and the old token
    // is in linkedPurchaseToken. We should check both to find the existing row.
    const existingByToken = yield subscription_model_1.Subscription.findOne({
        $or: [
            { googlePurchaseToken: decoded.purchaseToken },
            ...(decoded.linkedPurchaseToken
                ? [{ googlePurchaseToken: decoded.linkedPurchaseToken }]
                : []),
        ],
    });
    if (existingByToken && existingByToken.userId.toString() !== userId) {
        throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Google purchase is already linked to another account');
    }
    // 3. Map productId → local plan.
    const plan = (0, plan_mapper_1.mapGoogleProductToPlan)(decoded.productId);
    if (plan === subscription_interface_1.SUBSCRIPTION_PLAN.FREE) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Unknown or unsupported productId: ${decoded.productId}`);
    }
    // 4. Translate Google's subscriptionState into our local status.
    const isActiveState = decoded.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
        decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
    if (!isActiveState) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Google subscription is not active (state: ${decoded.subscriptionState})`);
    }
    const localStatus = decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
        ? subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE
        : subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
    // 5. Persist for this user.
    const updated = yield subscription_model_1.Subscription.upsertForUser(new mongoose_1.Types.ObjectId(userId), {
        plan,
        status: localStatus,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.GOOGLE,
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
        gracePeriodEndsAt: localStatus === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE && decoded.expiryTime
            ? new Date(decoded.expiryTime)
            : null,
        metadata: {
            acknowledgementState: decoded.acknowledgementState,
            linkedPurchaseToken: decoded.linkedPurchaseToken,
            testPurchase: decoded.testPurchase,
        },
    });
    // 6. Re-process any orphan webhooks.
    reprocessPendingWebhooks(decoded.purchaseToken, 'google').catch(err => {
        console.error('Failed to re-process pending Google webhooks:', err);
    });
    return updated;
});
exports.verifyGooglePurchase = verifyGooglePurchase;
const processGoogleWebhook = (rawBody, authorizationHeader) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, google_webhook_1.handleGoogleNotification)(rawBody, authorizationHeader);
});
exports.processGoogleWebhook = processGoogleWebhook;
const reprocessPendingWebhooks = (externalPurchaseId, provider) => __awaiter(void 0, void 0, void 0, function* () {
    const pending = yield pending_webhook_model_1.PendingWebhook.find({
        externalPurchaseId,
        provider,
    }).sort({ receivedAt: 1 });
    if (pending.length === 0)
        return;
    for (const item of pending) {
        try {
            if (provider === 'apple') {
                yield (0, apple_webhook_1.handleAppleNotification)(item.payload);
            }
            else {
                yield (0, google_webhook_1.handleGoogleNotification)(item.payload, undefined, true);
            }
            // Delete after successful processing
            yield pending_webhook_model_1.PendingWebhook.findByIdAndDelete(item._id);
        }
        catch (err) {
            console.error(`Failed to re-process pending ${provider} webhook ${item._id}:`, err);
        }
    }
});
const SubscriptionService = {
    getMySubscription: exports.getMySubscription,
    setFreePlan: exports.setFreePlan,
    verifyApplePurchase: exports.verifyApplePurchase,
    processAppleWebhook: exports.processAppleWebhook,
    verifyGooglePurchase: exports.verifyGooglePurchase,
    processGoogleWebhook: exports.processGoogleWebhook,
    getAllSubscriptions: exports.getAllSubscriptions,
    getSubscriptionAnalytics: exports.getSubscriptionAnalytics,
    getPendingWebhooks: exports.getPendingWebhooks,
    getSubscriptionById: exports.getSubscriptionById,
    getSubscriptionEvents: exports.getSubscriptionEvents,
    adminGrantPlan: exports.adminGrantPlan,
    adminResetPlan: exports.adminResetPlan,
};
exports.default = SubscriptionService;
