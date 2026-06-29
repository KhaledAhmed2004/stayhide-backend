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
exports.verifyGoogleSubscription = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
const config_1 = __importDefault(require("../../../../../config"));
const logger_1 = require("../../../../../shared/logger");
const google_client_1 = require("./google.client");
// Pulls the latest subscription state for a purchase token from the Google
// Play Developer API and normalizes it into our internal shape.
const verifyGoogleSubscription = (purchaseToken, productId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!purchaseToken || typeof purchaseToken !== 'string') {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'purchaseToken is required and must be a string');
    }
    const publisher = (0, google_client_1.getAndroidPublisher)();
    const packageName = config_1.default.googlePlay.packageName;
    let response;
    try {
        response = yield publisher.purchases.subscriptionsv2.get({
            packageName,
            token: purchaseToken,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Google purchase verification failed: ${message}`);
    }
    const data = response.data;
    if (!data) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Google API returned an empty subscription payload');
    }
    const subscriptionState = String(data.subscriptionState || '');
    if (!subscriptionState) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Decoded Google subscription is missing subscriptionState');
    }
    // Resolve the productId from lineItems[0] when not supplied by the caller.
    // Google's v2 API places the actual productId per line item.
    const lineItems = data.lineItems || [];
    const firstLine = lineItems[0];
    const resolvedProductId = productId || (firstLine === null || firstLine === void 0 ? void 0 : firstLine.productId) || (firstLine === null || firstLine === void 0 ? void 0 : firstLine.product_id) || '';
    if (!resolvedProductId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Decoded Google subscription is missing productId');
    }
    const expiryTime = (firstLine === null || firstLine === void 0 ? void 0 : firstLine.expiryTime) || undefined;
    const autoRenewing = Boolean((_a = firstLine === null || firstLine === void 0 ? void 0 : firstLine.autoRenewingPlan) === null || _a === void 0 ? void 0 : _a.autoRenewEnabled);
    // Reject if already expired (defensive — caller may also re-check).
    if (expiryTime && Date.now() > new Date(expiryTime).getTime()) {
        if (subscriptionState !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' &&
            subscriptionState !== 'SUBSCRIPTION_STATE_ON_HOLD') {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Google subscription has already expired');
        }
    }
    // testPurchase indicates a license-tester / sandbox transaction.
    const testPurchase = Boolean(data.testPurchase);
    const environment = testPurchase ? 'sandbox' : 'production';
    // ✅ Google Policy: purchases must be acknowledged within 72 hours or
    // Google automatically refunds the user. We acknowledge here (after confirming
    // the subscription is valid) using the Publisher API. We do NOT block the
    // verify response on a transient ack failure — the subscription IS valid at
    // this point, and the 72-hour window gives room for a retry.
    //
    // Note: acknowledgement uses `purchases.subscriptions.acknowledge` (v1 endpoint)
    // because `purchases.subscriptionsv2` has no separate acknowledge method.
    try {
        yield publisher.purchases.subscriptions.acknowledge({
            packageName,
            subscriptionId: resolvedProductId,
            token: purchaseToken,
            requestBody: {},
        });
    }
    catch (ackErr) {
        const msg = ackErr instanceof Error ? ackErr.message : 'unknown';
        // This is not fatal — the user gets access. Log so ops can monitor.
        logger_1.logger.warn(`[Google IAP] Purchase acknowledgement failed for token ${purchaseToken.slice(0, 12)}...: ${msg}. ` +
            'Will need manual re-acknowledgement within 72h to prevent auto-refund.');
    }
    return {
        purchaseToken,
        productId: resolvedProductId,
        orderId: data.latestOrderId || undefined,
        subscriptionState,
        startTime: data.startTime || undefined,
        expiryTime,
        autoRenewing,
        acknowledgementState: data.acknowledgementState || undefined,
        linkedPurchaseToken: data.linkedPurchaseToken || undefined,
        testPurchase,
        environment,
    };
});
exports.verifyGoogleSubscription = verifyGoogleSubscription;
