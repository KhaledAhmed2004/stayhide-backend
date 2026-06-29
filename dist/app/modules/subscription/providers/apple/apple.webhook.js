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
exports.handleAppleNotification = void 0;
const http_status_1 = __importDefault(require("http-status"));
const app_store_server_library_1 = require("@apple/app-store-server-library");
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
const logger_1 = require("../../../../../shared/logger");
const apple_client_1 = require("./apple.client");
const subscription_model_1 = require("../../subscription.model");
const subscription_interface_1 = require("../../subscription.interface");
const plan_mapper_1 = require("../../helpers/plan.mapper");
const processed_webhook_model_1 = require("../../processed-webhook.model");
const pending_webhook_model_1 = require("../../pending-webhook.model");
// Apply the Apple webhook state-machine to an existing subscription document.
// Returns the update delta to persist. All logic is expressed here so the
// caller only has to persist and log — no business logic at the edges.
const buildUpdatesForNotification = (notificationType, subtype, decodedTransaction) => {
    const updates = {};
    switch (notificationType) {
        case app_store_server_library_1.NotificationTypeV2.SUBSCRIBED: {
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
            if (decodedTransaction.productId) {
                updates.plan = (0, plan_mapper_1.mapAppleProductToPlan)(decodedTransaction.productId);
            }
            if (decodedTransaction.expiresDate) {
                updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
            }
            if (decodedTransaction.transactionId) {
                updates.appleLatestTransactionId = decodedTransaction.transactionId;
            }
            updates.canceledAt = null;
            updates.gracePeriodEndsAt = null;
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.DID_RENEW: {
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
            if (decodedTransaction.productId) {
                updates.plan = (0, plan_mapper_1.mapAppleProductToPlan)(decodedTransaction.productId);
            }
            if (decodedTransaction.expiresDate) {
                updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
            }
            if (decodedTransaction.transactionId) {
                updates.appleLatestTransactionId = decodedTransaction.transactionId;
            }
            updates.gracePeriodEndsAt = null;
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.DID_FAIL_TO_RENEW: {
            // Billing retry phase — keep entitlement during grace period.
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE;
            if (decodedTransaction.expiresDate) {
                updates.gracePeriodEndsAt = new Date(decodedTransaction.expiresDate);
            }
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.GRACE_PERIOD_EXPIRED:
        case app_store_server_library_1.NotificationTypeV2.EXPIRED: {
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE;
            updates.plan = subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
            updates.gracePeriodEndsAt = null;
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.REFUND:
        case app_store_server_library_1.NotificationTypeV2.REVOKE: {
            // Per product decision: refunds immediately revoke entitlement.
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.CANCELED;
            updates.plan = subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
            updates.canceledAt = new Date();
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: {
            // subtype is AUTO_RENEW_ENABLED or AUTO_RENEW_DISABLED
            updates.autoRenewing = subtype === 'AUTO_RENEW_ENABLED';
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.DID_CHANGE_RENEWAL_PREF: {
            // Plan change scheduled — the actual plan switch lands on DID_RENEW.
            // Nothing to persist here.
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.PRICE_INCREASE: {
            // subtype is PENDING (user not yet consented) or ACCEPTED.
            // If the user doesn't accept, Apple will cancel at period end —
            // we mark autoRenewing false now as a pessimistic defensive move.
            // When/if they accept, DID_RENEW will restore active state.
            if (subtype !== 'ACCEPTED') {
                updates.autoRenewing = false;
            }
            return updates;
        }
        case app_store_server_library_1.NotificationTypeV2.OFFER_REDEEMED: {
            // User redeemed a promotional offer (free trial, discount).
            // The transaction contains the new productId (may differ from current).
            // Update plan + period end to reflect the offer terms.
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
            if (decodedTransaction.productId) {
                updates.plan = (0, plan_mapper_1.mapAppleProductToPlan)(decodedTransaction.productId);
            }
            if (decodedTransaction.expiresDate) {
                updates.currentPeriodEnd = new Date(decodedTransaction.expiresDate);
            }
            if (decodedTransaction.transactionId) {
                updates.appleLatestTransactionId = decodedTransaction.transactionId;
            }
            return updates;
        }
        default:
            return updates;
    }
};
const handleAppleNotification = (signedPayload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!signedPayload || typeof signedPayload !== 'string') {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'signedPayload is required');
    }
    const verifier = (0, apple_client_1.getAppleVerifier)();
    let notification;
    try {
        notification = yield verifier.verifyAndDecodeNotification(signedPayload);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Apple notification verification failed: ${message}`);
    }
    const notificationType = String(notification.notificationType || '');
    const subtype = notification.subtype !== undefined ? String(notification.subtype) : undefined;
    const notificationUUID = notification.notificationUUID;
    // Apple uses TEST notifications for webhook configuration validation.
    if (notificationType === app_store_server_library_1.NotificationTypeV2.TEST) {
        logger_1.logger.info('Apple TEST notification received — webhook reachable');
        return { processed: true, notificationType, subtype };
    }
    // Decode the nested signedTransactionInfo to find the subscription.
    const signedTransactionInfo = (_a = notification.data) === null || _a === void 0 ? void 0 : _a.signedTransactionInfo;
    if (!signedTransactionInfo) {
        logger_1.logger.warn(`Apple notification ${notificationType} has no signedTransactionInfo, skipping`);
        return {
            processed: false,
            notificationType,
            subtype,
            reason: 'no_transaction_info',
        };
    }
    let decodedTransaction;
    try {
        decodedTransaction = yield verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    }
    catch (err) {
        logger_1.errorLogger.error('Failed to decode signedTransactionInfo in Apple notification', err);
        return {
            processed: false,
            notificationType,
            subtype,
            reason: 'no_transaction_info',
        };
    }
    const originalTransactionId = decodedTransaction.originalTransactionId;
    if (!originalTransactionId) {
        return {
            processed: false,
            notificationType,
            subtype,
            reason: 'no_transaction_info',
        };
    }
    const existing = yield subscription_model_1.Subscription.findOne({
        appleOriginalTransactionId: originalTransactionId,
    });
    if (!existing) {
        // 🟠 5 Fix: Store the orphan webhook in the queue for later re-processing.
        yield pending_webhook_model_1.PendingWebhook.create({
            externalPurchaseId: originalTransactionId,
            provider: 'apple',
            payload: signedPayload,
        });
        logger_1.logger.warn(`Queued orphan Apple notification ${notificationType} for originalTransactionId=${originalTransactionId}`);
        return {
            processed: false,
            notificationType,
            subtype,
            reason: 'queued_as_orphan',
        };
    }
    // ✅ Idempotency — Write-first pattern eliminates TOCTOU race.
    // Two concurrent deliveries of the same notificationUUID could both pass
    // a findOne() check before either writes. We attempt the DB insert first
    // and rely on the unique index to reject the second atomically.
    if (notificationUUID) {
        try {
            yield processed_webhook_model_1.ProcessedWebhook.create({
                webhookId: notificationUUID,
                provider: 'apple',
            });
        }
        catch (err) {
            if (err.code === 11000) {
                // Duplicate key → already processed.
                return {
                    processed: false,
                    notificationType,
                    subtype,
                    reason: 'duplicate',
                };
            }
            throw err; // unexpected DB error — bubble up
        }
    }
    const updates = buildUpdatesForNotification(notificationType, subtype, {
        productId: decodedTransaction.productId,
        expiresDate: decodedTransaction.expiresDate,
        transactionId: decodedTransaction.transactionId,
    });
    const newMetadata = Object.assign(Object.assign({}, (existing.metadata || {})), { lastAppleNotificationUUID: notificationUUID, lastAppleNotificationType: notificationType, lastAppleNotificationSubtype: subtype, lastAppleNotificationAt: new Date().toISOString() });
    yield subscription_model_1.Subscription.upsertForUser(existing.userId, Object.assign(Object.assign({}, updates), { metadata: newMetadata }));
    logger_1.logger.info(`Apple notification ${notificationType}${subtype ? `/${subtype}` : ''} applied to subscription ${existing._id}`);
    return {
        processed: true,
        notificationType,
        subtype,
        reason: 'applied',
    };
});
exports.handleAppleNotification = handleAppleNotification;
