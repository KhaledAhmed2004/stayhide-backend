"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const subscription_controller_1 = __importDefault(require("./subscription.controller"));
const subscription_validation_1 = require("./subscription.validation");
const rateLimit_1 = require("../../middlewares/rateLimit");
const router = express_1.default.Router();
// GET /subscriptions/me
// নিজের সাবস্ক্রিপশন স্ট্যাটাস/প্ল্যান দেখায়
router.get('/me', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getMySubscriptionController);
// POST /subscriptions/apple/verify
// iOS ক্লায়েন্ট StoreKit থেকে signedTransactionInfo পাঠায় — server verify করে
// DB-তে সাবস্ক্রিপশন তৈরি/আপডেট করে।
router.post('/apple/verify', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 30,
    routeName: 'subscription-apple-verify',
}), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.appleVerifySchema), subscription_controller_1.default.verifyApplePurchaseController);
// POST /subscriptions/apple/webhook
// Apple App Store Server Notifications V2 — no auth middleware because
// Apple's JWS signature is verified inside the controller/service.
// Raw body parsing for this route is configured in src/app.ts.
router.post('/apple/webhook', subscription_controller_1.default.appleWebhookController);
// POST /subscriptions/google/verify
// Android client passes the Google Play purchase token + productId from
// the BillingClient — server verifies via Android Publisher API and
// upserts the subscription record.
router.post('/google/verify', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 30,
    routeName: 'subscription-google-verify',
}), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.googleVerifySchema), subscription_controller_1.default.verifyGooglePurchaseController);
// POST /subscriptions/google/webhook
// Google Play Real-Time Developer Notifications — Pub/Sub push.
// No app-level auth: the service verifies the bearer JWT signed by
// Google Cloud Pub/Sub against the configured audience.
// Raw body parsing for this route is configured in src/app.ts.
router.post('/google/webhook', subscription_controller_1.default.googleWebhookController);
// POST /subscriptions/choose/free
// লোকালি Free প্ল্যানে সুইচ করে
router.post('/choose/free', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), subscription_controller_1.default.chooseFreePlanController);
// --- Admin Routes ---
router.get('/admin', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getAllSubscriptionsController);
router.get('/admin/analytics', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getSubscriptionAnalyticsController);
router.get('/admin/pending-webhooks', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getPendingWebhooksController);
router.get('/admin/:subscriptionId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getSubscriptionByIdController);
router.get('/admin/events/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), subscription_controller_1.default.getSubscriptionEventsController);
router.post('/admin/grant', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.adminGrantPlanSchema), subscription_controller_1.default.adminGrantPlanController);
router.post('/admin/reset/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.adminResetPlanSchema), subscription_controller_1.default.adminResetPlanController);
// --- End Admin Routes ---
exports.SubscriptionRoutes = router;
