import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import SubscriptionController from './subscription.controller';
import { SubscriptionValidation } from './subscription.validation';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';

const router = express.Router();

// GET /subscriptions/me
// নিজের সাবস্ক্রিপশন স্ট্যাটাস/প্ল্যান দেখায়
router.get(
  '/me',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  SubscriptionController.getMySubscriptionController
);

// POST /subscriptions/apple/verify
// iOS ক্লায়েন্ট StoreKit থেকে signedTransactionInfo পাঠায় — server verify করে
// DB-তে সাবস্ক্রিপশন তৈরি/আপডেট করে।
router.post(
  '/apple/verify',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 30,
    routeName: 'subscription-apple-verify',
  }),
  validateRequest(SubscriptionValidation.appleVerifySchema),
  SubscriptionController.verifyApplePurchaseController
);

// POST /subscriptions/apple/webhook
// Apple App Store Server Notifications V2 — no auth middleware because
// Apple's JWS signature is verified inside the controller/service.
// Raw body parsing for this route is configured in src/app.ts.
router.post(
  '/apple/webhook',
  SubscriptionController.appleWebhookController
);

// POST /subscriptions/google/verify
// Android client passes the Google Play purchase token + productId from
// the BillingClient — server verifies via Android Publisher API and
// upserts the subscription record.
router.post(
  '/google/verify',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 30,
    routeName: 'subscription-google-verify',
  }),
  validateRequest(SubscriptionValidation.googleVerifySchema),
  SubscriptionController.verifyGooglePurchaseController
);

// POST /subscriptions/google/webhook
// Google Play Real-Time Developer Notifications — Pub/Sub push.
// No app-level auth: the service verifies the bearer JWT signed by
// Google Cloud Pub/Sub against the configured audience.
// Raw body parsing for this route is configured in src/app.ts.
router.post(
  '/google/webhook',
  SubscriptionController.googleWebhookController
);

// POST /subscriptions/choose/free
// লোকালি Free প্ল্যানে সুইচ করে
router.post(
  '/choose/free',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  SubscriptionController.chooseFreePlanController
);

// --- Admin Routes ---

router.get(
  '/admin',
  auth(USER_ROLES.ADMIN),
  SubscriptionController.getAllSubscriptionsController
);

router.get(
  '/admin/analytics',
  auth(USER_ROLES.ADMIN),
  SubscriptionController.getSubscriptionAnalyticsController
);

router.get(
  '/admin/pending-webhooks',
  auth(USER_ROLES.ADMIN),
  SubscriptionController.getPendingWebhooksController
);

router.get(
  '/admin/:subscriptionId',
  auth(USER_ROLES.ADMIN),
  SubscriptionController.getSubscriptionByIdController
);

router.get(
  '/admin/events/:userId',
  auth(USER_ROLES.ADMIN),
  SubscriptionController.getSubscriptionEventsController
);

router.post(
  '/admin/grant',
  auth(USER_ROLES.ADMIN),
  validateRequest(SubscriptionValidation.adminGrantPlanSchema),
  SubscriptionController.adminGrantPlanController
);

router.post(
  '/admin/reset/:userId',
  auth(USER_ROLES.ADMIN),
  validateRequest(SubscriptionValidation.adminResetPlanSchema),
  SubscriptionController.adminResetPlanController
);

// --- End Admin Routes ---

export const SubscriptionRoutes = router;
