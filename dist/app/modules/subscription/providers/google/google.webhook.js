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
exports.handleGoogleNotification = exports.verifyPubsubJwt = exports.GOOGLE_NOTIFICATION_TYPES = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
const config_1 = __importDefault(require("../../../../../config"));
const logger_1 = require("../../../../../shared/logger");
const subscription_model_1 = require("../../subscription.model");
const subscription_interface_1 = require("../../subscription.interface");
const plan_mapper_1 = require("../../helpers/plan.mapper");
const google_client_1 = require("./google.client");
const google_verify_1 = require("./google.verify");
const processed_webhook_model_1 = require("../../processed-webhook.model");
const pending_webhook_model_1 = require("../../pending-webhook.model");
// Google RTDN notification type codes (V1).
// https://developer.android.com/google/play/billing/rtdn-reference
exports.GOOGLE_NOTIFICATION_TYPES = {
    1: 'SUBSCRIPTION_RECOVERED',
    2: 'SUBSCRIPTION_RENEWED',
    3: 'SUBSCRIPTION_CANCELED',
    4: 'SUBSCRIPTION_PURCHASED',
    5: 'SUBSCRIPTION_ON_HOLD',
    6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
    7: 'SUBSCRIPTION_RESTARTED',
    8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
    9: 'SUBSCRIPTION_DEFERRED',
    10: 'SUBSCRIPTION_PAUSED',
    11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
    12: 'SUBSCRIPTION_REVOKED',
    13: 'SUBSCRIPTION_EXPIRED',
    20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};
// Verify the Pub/Sub push request actually came from Google by validating
// the bearer JWT against the configured audience. If no audience is set
// (dev), we skip — but log a warning so it's visible.
const verifyPubsubJwt = (authorizationHeader) => __awaiter(void 0, void 0, void 0, function* () {
    const audience = config_1.default.googlePlay.pubsubAudience;
    if (!audience) {
        logger_1.logger.warn('GOOGLE_PLAY_PUBSUB_AUDIENCE not set — skipping Pub/Sub JWT verification (dev only)');
        return { ok: true };
    }
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { ok: false, reason: 'missing bearer token' };
    }
    const token = authorizationHeader.slice('Bearer '.length).trim();
    const verifier = (0, google_client_1.getPubsubVerifier)();
    try {
        const ticket = yield verifier.verifyIdToken({ idToken: token, audience });
        const payload = ticket.getPayload();
        if (!payload)
            return { ok: false, reason: 'empty token payload' };
        const expectedEmail = config_1.default.googlePlay.pubsubServiceAccountEmail;
        if (expectedEmail && payload.email !== expectedEmail) {
            return {
                ok: false,
                reason: `unexpected token email: ${payload.email}`,
            };
        }
        return { ok: true };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        return { ok: false, reason: `jwt verification failed: ${message}` };
    }
});
exports.verifyPubsubJwt = verifyPubsubJwt;
const decodePubsubBody = (rawBody) => {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    try {
        return JSON.parse(text);
    }
    catch (_a) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid Pub/Sub body JSON');
    }
};
const decodeRTDNData = (base64Data) => {
    if (!base64Data) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Pub/Sub message has no data');
    }
    const json = Buffer.from(base64Data, 'base64').toString('utf8');
    try {
        return JSON.parse(json);
    }
    catch (_a) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to decode RTDN payload JSON');
    }
};
// State machine for Google RTDN subscription notifications. Returns the
// update delta to persist on the existing subscription document. The latest
// authoritative state is also re-fetched from Google before this is called,
// so we can trust expiryTime / autoRenewing on the decoded subscription.
const buildUpdatesForGoogleNotification = (notificationTypeCode, decodedProductId, expiryTime, autoRenewing) => {
    const updates = {};
    const expiry = expiryTime ? new Date(expiryTime) : null;
    switch (notificationTypeCode) {
        case 4: // SUBSCRIPTION_PURCHASED
        case 1: // SUBSCRIPTION_RECOVERED
        case 2: // SUBSCRIPTION_RENEWED
        case 7: // SUBSCRIPTION_RESTARTED
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
            if (decodedProductId) {
                updates.plan = (0, plan_mapper_1.mapGoogleProductToPlan)(decodedProductId);
            }
            if (expiry)
                updates.currentPeriodEnd = expiry;
            updates.gracePeriodEndsAt = null;
            updates.canceledAt = null;
            if (typeof autoRenewing === 'boolean')
                updates.autoRenewing = autoRenewing;
            return updates;
        case 6: // SUBSCRIPTION_IN_GRACE_PERIOD — billing retry, keep access
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE;
            if (expiry)
                updates.gracePeriodEndsAt = expiry;
            return updates;
        case 5: // SUBSCRIPTION_ON_HOLD — Grace period expired, payment still failed → NO access.
            // ⚠️ Do NOT map to PAST_DUE. PAST_DUE is in ACTIVE_STATUSES (grace period, keeps access).
            // Account hold is a harder state: billing retries failed, access is suspended.
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE;
            return updates;
        case 3: // SUBSCRIPTION_CANCELED — user canceled but keeps access until expiry
            updates.autoRenewing = false;
            updates.canceledAt = new Date();
            return updates;
        case 13: // SUBSCRIPTION_EXPIRED
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE;
            updates.plan = subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
            updates.gracePeriodEndsAt = null;
            return updates;
        case 12: // SUBSCRIPTION_REVOKED — refund / chargeback, immediate revoke
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.CANCELED;
            updates.plan = subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
            updates.canceledAt = new Date();
            return updates;
        case 10: // SUBSCRIPTION_PAUSED
            updates.status = subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE;
            return updates;
        case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
        case 9: // SUBSCRIPTION_DEFERRED
        case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
        case 20: // SUBSCRIPTION_PENDING_PURCHASE_CANCELED
        default:
            return updates;
    }
};
const handleGoogleNotification = (rawBody_1, authorizationHeader_1, ...args_1) => __awaiter(void 0, [rawBody_1, authorizationHeader_1, ...args_1], void 0, function* (rawBody, authorizationHeader, skipAuth = false) {
    var _a, _b, _c, _d;
    // 1. Trust check — the request must come from Google Pub/Sub.
    if (!skipAuth) {
        const auth = yield (0, exports.verifyPubsubJwt)(authorizationHeader);
        if (!auth.ok) {
            logger_1.logger.warn(`Google webhook rejected: ${auth.reason}`);
            return { processed: false, reason: 'unauthorized' };
        }
    }
    // 2. Parse the Pub/Sub envelope and decode the inner RTDN payload.
    const envelope = decodePubsubBody(rawBody);
    const messageId = ((_a = envelope.message) === null || _a === void 0 ? void 0 : _a.messageId) || ((_b = envelope.message) === null || _b === void 0 ? void 0 : _b.message_id) || '';
    const rtdn = decodeRTDNData((_c = envelope.message) === null || _c === void 0 ? void 0 : _c.data);
    // 3. Test notification — Google sends these from the Play Console to
    //    validate the webhook is reachable. Just acknowledge.
    if (rtdn.testNotification) {
        logger_1.logger.info('Google Play TEST RTDN notification received');
        return { processed: true, reason: 'test' };
    }
    // 4. Only subscription notifications are handled here. One-time product
    //    purchases would need a separate code path.
    const subNotif = rtdn.subscriptionNotification;
    if (!subNotif || !subNotif.purchaseToken) {
        return { processed: false, reason: 'no_subscription_notification' };
    }
    const purchaseToken = subNotif.purchaseToken;
    const notificationTypeCode = (_d = subNotif.notificationType) !== null && _d !== void 0 ? _d : -1;
    const notificationType = exports.GOOGLE_NOTIFICATION_TYPES[notificationTypeCode] || `UNKNOWN_${notificationTypeCode}`;
    // 5. Find the subscription doc by purchase token.
    const existing = yield subscription_model_1.Subscription.findOne({
        googlePurchaseToken: purchaseToken,
    });
    if (!existing) {
        // H1 Fix: If not found, it might be an upgrade/downgrade where we only know
        // the old token. Fetch latest state to see if there's a linkedPurchaseToken.
        try {
            const decoded = yield (0, google_verify_1.verifyGoogleSubscription)(purchaseToken, subNotif.subscriptionId);
            if (decoded.linkedPurchaseToken) {
                const linked = yield subscription_model_1.Subscription.findOne({
                    googlePurchaseToken: decoded.linkedPurchaseToken,
                });
                if (linked) {
                    // Found it via the linked token! Continue with this record.
                    return yield processValidatedGoogleNotification(linked, decoded, notificationTypeCode, notificationType, messageId);
                }
            }
        }
        catch (err) {
            // If verify fails here, we can't do much. Fall through to orphan warning.
        }
        // 🟠 5 Fix: Store the orphan webhook in the queue for later re-processing.
        yield pending_webhook_model_1.PendingWebhook.create({
            externalPurchaseId: purchaseToken,
            provider: 'google',
            payload: rawBody,
        });
        logger_1.logger.warn(`Queued orphan Google RTDN ${notificationType} for purchaseToken=${purchaseToken.slice(0, 12)}...`);
        return {
            processed: false,
            notificationType,
            rawNotificationType: notificationTypeCode,
            reason: 'queued_as_orphan',
        };
    }
    // 7. Fetch authoritative state from Google so the local doc reflects
    //    reality (Google docs explicitly recommend this rather than trusting
    //    the notification body alone).
    let decoded;
    try {
        decoded = yield (0, google_verify_1.verifyGoogleSubscription)(purchaseToken, subNotif.subscriptionId);
    }
    catch (err) {
        logger_1.errorLogger.error('Failed to fetch latest Google subscription state during RTDN', err);
        return {
            processed: false,
            notificationType,
            rawNotificationType: notificationTypeCode,
            reason: 'google_api_error', // M5 Fix: Correct reason string
        };
    }
    return yield processValidatedGoogleNotification(existing, decoded, notificationTypeCode, notificationType, messageId);
});
exports.handleGoogleNotification = handleGoogleNotification;
/**
 * Shared logic to apply updates once both the DB record and Google state are resolved.
 */
const processValidatedGoogleNotification = (existing, decoded, notificationTypeCode, notificationType, messageId) => __awaiter(void 0, void 0, void 0, function* () {
    // ✅ Idempotency — Write-first pattern eliminates TOCTOU race.
    // Two concurrent deliveries of the same messageId could both pass a
    // findOne() check before either writes. Instead we attempt the insert
    // immediately and let the unique index reject the second one atomically.
    if (messageId) {
        try {
            yield processed_webhook_model_1.ProcessedWebhook.create({
                webhookId: messageId,
                provider: 'google',
            });
        }
        catch (err) {
            if (err.code === 11000) {
                // Duplicate key → already processed, safe to acknowledge and ignore.
                return {
                    processed: false,
                    notificationType,
                    rawNotificationType: notificationTypeCode,
                    reason: 'duplicate',
                };
            }
            throw err; // unexpected DB error — bubble up so webhook is not 200'd
        }
    }
    const updates = buildUpdatesForGoogleNotification(notificationTypeCode, decoded.productId, decoded.expiryTime, decoded.autoRenewing);
    const newMetadata = Object.assign(Object.assign({}, (existing.metadata || {})), { lastGoogleMessageId: messageId || undefined, lastGoogleNotificationType: notificationType, lastGoogleNotificationCode: notificationTypeCode, lastGoogleNotificationAt: new Date().toISOString() });
    yield subscription_model_1.Subscription.upsertForUser(existing.userId, Object.assign(Object.assign({}, updates), { googlePurchaseToken: decoded.purchaseToken, googleOrderId: decoded.orderId || existing.googleOrderId, metadata: newMetadata }));
    logger_1.logger.info(`Google RTDN ${notificationType} applied to subscription ${existing._id}`);
    return {
        processed: true,
        notificationType,
        rawNotificationType: notificationTypeCode,
        reason: 'applied',
    };
});
