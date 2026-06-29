# Subscription Module

> Apple In-App Purchase (StoreKit 2) + Google Play Billing integration
> for mobile-only app. Both providers fully implemented.

---

## Overview — কী এটা?

Ei module ti user subscriptions manage kore — **direct Apple StoreKit 2** ar **direct Google Play Billing** integration use kore, kono third-party middleman chara.

- **iOS users** subscribe korle Apple er **JWS signed transaction** backend e ashe, backend cryptographically verify kore DB te save kore, tarpor Apple er **App Store Server Notifications V2** webhook diye lifecycle events (renewal, cancel, refund, expire) real-time e track kore.
- **Android users** subscribe korle backend Google er **Android Publisher API** (`purchases.subscriptionsv2.get`) call kore authoritative state ane, tarpor **Real-Time Developer Notifications (RTDN)** Cloud Pub/Sub push diye lifecycle events real-time e track kore.

Dui platform er state machine same `Subscription` doc e converge kore — same `plan`, `status`, `currentPeriodEnd` field, sudhu `platform` field e `apple` / `google` distinguish kora hoy.

**Keno ei approach:**
- **Free forever** — kono recurring third-party fee nai (RevenueCat-er moto MTR % nai)
- **Full control** — verification + state machine logic tor hater e
- **No third-party dependency** — Apple SDK + Google SDK + tor backend, bas
- **Zero vendor lock-in**

**Cons je thakte pare:**
- Apple + Google alada API — dui ta provider alada maintain korte hobe (eta kora ache)
- Apple/Google er policy/library updates track korte hobe
- Built-in analytics/dashboard nai — nije query likhte hobe

---

## Current Implementation Status

| Feature | Status |
|---|---|
| Apple StoreKit 2 verification | ✅ Complete |
| Apple Server Notifications V2 webhook | ✅ Complete |
| Google Play subscriptionsv2 verification | ✅ Complete |
| Google Play RTDN (Pub/Sub) webhook | ✅ Complete |
| Pub/Sub JWT verification | ✅ Complete |
| Subscription lifecycle state machine | ✅ Complete (Robust) |
| Idempotent webhook handling | ✅ Complete (DB-backed) |
| Fraud prevention (unique indexes) | ✅ Complete |
| Grace period support | ✅ Complete |
| Refund immediate revoke | ✅ Complete |
| Access gating helpers (`getUserEntitlement`) | ✅ Complete |
| Enterprise tier via store purchase | ✅ Complete |
| Upgrade/Downgrade migration | ✅ Complete (Token migration) |

---

## Architecture

### File tree

```
src/app/modules/subscription/
├── README.md                           ← this file
├── FLUTTER_IMPLEMENTATION_GUIDE.md     ← Guide for Flutter developers
│
├── providers/
│   ├── apple/
│   │   ├── apple.types.ts              ← local type aliases (narrow shape)
│   │   ├── apple.client.ts             ← SignedDataVerifier lazy singleton
│   │   ├── apple.verify.ts             ← verifyAppleTransaction() — JWS verify
│   │   └── apple.webhook.ts            ← handleAppleNotification() — state machine
│   └── google/
│       ├── google.types.ts             ← local type aliases for Google Play
│       ├── google.client.ts            ← Android Publisher + Pub/Sub verifier singletons
│       ├── google.verify.ts            ← verifyGoogleSubscription() — API call
│       └── google.webhook.ts           ← handleGoogleNotification() — Pub/Sub + RTDN state machine
│
├── helpers/
│   ├── plan.mapper.ts                  ← productId → SUBSCRIPTION_PLAN lookup table
│   └── entitlement.ts                  ← isUserPremium, getUserEntitlement, etc.
│
├── subscription.interface.ts           ← types, enums
├── subscription.model.ts               ← Mongoose schema with unique indexes
├── subscription.service.ts             ← business logic
├── subscription.controller.ts          ← HTTP handlers
├── subscription.route.ts               ← routes
└── subscription.validation.ts          ← Zod schemas
```

### Request flow (initial purchase)

```
┌─────────────────┐
│  Flutter app    │  User taps "Subscribe"
│   (StoreKit 2)  │
└────────┬────────┘
         │
         │ 1. StoreKit presents Apple purchase sheet
         │ 2. User confirms → Apple processes payment
         │ 3. Apple returns signedTransactionInfo (JWS)
         ▼
┌─────────────────┐
│  Flutter app    │  POST /api/v1/subscription/apple/verify
└────────┬────────┘  Headers: Authorization: Bearer <JWT>
         │            Body: { signedTransactionInfo: "eyJhbGc..." }
         ▼
┌────────────────────────────────────────┐
│  Express route                         │
│  - auth() middleware (JWT validation)  │
│  - rateLimit (30/min)                  │
│  - validateRequest (Zod)               │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  verifyApplePurchaseController         │
│  (catchAsync wrapper)                  │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  SubscriptionService.verifyApplePurchase│
│  1. verifyAppleTransaction()            │  ← cryptographic check
│  2. Fraud check (existing txn → other user?)
│  3. mapAppleProductToPlan()             │
│  4. Upsert subscription doc             │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  MongoDB                               │
│  Subscription doc upserted with:       │
│  - plan: PREMIUM                       │
│  - status: active                      │
│  - platform: apple                     │
│  - appleOriginalTransactionId (unique) │
│  - currentPeriodEnd, etc.              │
└────────────────────────────────────────┘
```

### Webhook flow (lifecycle events)

```
┌──────────────────────┐
│  Apple Server        │  Event happens (renewal, cancel, refund, etc.)
└────────┬─────────────┘
         │
         │ POST /api/v1/subscription/apple/webhook
         │ Body: { signedPayload: "eyJhbGc..." } (V2 JWS)
         ▼
┌────────────────────────────────────────┐
│  Express raw body middleware           │
│  (no express.json — raw Buffer)        │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  appleWebhookController                │
│  - Parse Buffer → JSON                 │
│  - Extract signedPayload               │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  handleAppleNotification()             │
│  1. verifyAndDecodeNotification (JWS)  │
│  2. Check if TEST notification         │
│  3. Decode nested signedTransactionInfo│
│  4. Find subscription by originalTxnId │
│  5. Idempotency check (notificationUUID)│
│  6. Run state machine (switch on type) │
│  7. Update subscription doc            │
└────────────────────────────────────────┘
```

---

## Files Explained

### New files (6)

#### 1. `providers/apple/apple.types.ts`
Local TypeScript type aliases. Wraps `@apple/app-store-server-library` types into a narrower, safer shape so the rest of the module doesn't depend directly on library internals. If the Apple library changes its type shapes in a future version, only this file needs to adapt.

**Exports:**
- `AppleEnvironment` = `'sandbox' | 'production'`
- `DecodedAppleTransaction` — normalized transaction shape
- `AppleWebhookResult` — webhook processing result

#### 2. `providers/apple/apple.client.ts`
Lazy-initialized `SignedDataVerifier` singleton.

**Why lazy:** Server boot never touches Apple credentials. Only when a verify/webhook endpoint is actually hit does the client load certificates and initialize. This means the server can start even if Apple keys aren't configured yet — you only get an error when trying to verify.

**Exports:**
- `getAppleVerifier()` — returns cached singleton, loads certs on first call
- `resetAppleVerifierForTests()` — for test isolation

**Loads from:**
- `config.apple.rootCertsDir` → reads all `.cer` / `.der` files as `Buffer[]`
- `config.apple.bundleId` → passed to verifier
- `config.apple.environment` → maps to `Environment.SANDBOX` or `Environment.PRODUCTION`

#### 3. `providers/apple/apple.verify.ts`
Handles the initial purchase verification when a client sends a fresh StoreKit 2 transaction.

**Main export:** `verifyAppleTransaction(signedTransactionInfo: string)`

**What it does:**
1. Cryptographically verifies the JWS via `SignedDataVerifier.verifyAndDecodeTransaction()`
2. Guards all required fields (transactionId, originalTransactionId, productId, bundleId)
3. Checks `bundleId` matches configured bundle (cross-app replay protection)
4. Rejects if `revocationDate` is set (already refunded/revoked)
5. Rejects if `expiresDate` is in the past
6. Returns normalized `DecodedAppleTransaction`

**Throws:**
- `ApiError(400)` — invalid JWS, missing fields, expired, revoked, bundle mismatch

#### 4. `providers/apple/apple.webhook.ts`
Handles Apple App Store Server Notifications V2 events.

**Main export:** `handleAppleNotification(signedPayload: string)`

**State machine logic** (`buildUpdatesForNotification`):

| Apple event | Local action |
|---|---|
| `SUBSCRIBED` (initial) | `status: ACTIVE`, set plan + `currentPeriodEnd`, clear cancel/grace fields |
| `DID_RENEW` | Extend `currentPeriodEnd`, keep `ACTIVE`, clear grace |
| `DID_FAIL_TO_RENEW` | Set `PAST_DUE` (grace period active — user keeps access) |
| `GRACE_PERIOD_EXPIRED` | Set `INACTIVE`, plan → `FREE` |
| `EXPIRED` | Set `INACTIVE`, plan → `FREE` |
| `REFUND` | Set `CANCELED`, plan → `FREE`, immediate revoke |
| `REVOKE` (family sharing) | Set `CANCELED`, plan → `FREE`, immediate revoke |
| `DID_CHANGE_RENEWAL_STATUS` | Update `autoRenewing` flag |
| `DID_CHANGE_RENEWAL_PREF` | Plan change scheduled — no immediate action (applied on next renewal) |
| `TEST` | Log only, return 200 |
| Others | Log, no state change |

**Idempotency:**
- Apple can retry webhooks on failure
- We store `metadata.lastAppleNotificationUUID` on the subscription doc
- Duplicate notifications (same UUID) are detected and skipped

**Orphan handling:**
- If webhook arrives for a subscription we don't have in DB yet, we log and skip
- The client's `/apple/verify` call will eventually create the record

#### 5. `helpers/plan.mapper.ts`
Explicit `productId → SUBSCRIPTION_PLAN` lookup table. Replaces the old brittle string-matching approach (`productId.includes('premium')`).

**Current mapping:**
```typescript
{
  premium_monthly:     PREMIUM,    // $5.99/mo
  premium_yearly:      PREMIUM,    // $3.99/mo billed yearly
  enterprise_monthly:  ENTERPRISE, // $9.99/mo
  enterprise_yearly:   ENTERPRISE, // $5.99/mo billed yearly
}
```

**Pricing tiers:**
| Plan | Monthly | Yearly (per month) |
|---|---|---|
| FREE | $0 | — |
| PREMIUM | $5.99/mo | $3.99/mo billed yearly |
| ENTERPRISE | $9.99/mo | $5.99/mo billed yearly |

**When adding a new product** in App Store Connect / Play Console, add the exact product identifier here. Unknown product IDs resolve to `FREE` so verification code can detect and reject them cleanly.

**Exports:**
- `mapAppleProductToPlan(productId)`
- `mapGoogleProductToPlan(productId)` (same table, ready for Google phase)
- `isKnownProductId(productId)`
- `getKnownProductIds()`

#### 6. `helpers/entitlement.ts`
Access gating helpers. Use these throughout the app to check if a user has premium access.

**Exports:**
- `getUserEntitlement(userId)` — returns full entitlement object
- `isUserPremium(userId)` — boolean
- `isUserEnterprise(userId)` — boolean

**Critical logic:**
- `ACTIVE_STATUSES` set includes `ACTIVE`, `TRIALING`, **and `PAST_DUE`**
- This means users in the **grace period** (billing retry phase) **keep their access** — this matches Apple/Google's user-friendly behavior and is the industry standard
- `isPremium = isActive && plan !== FREE`
- `isEnterprise = isActive && plan === ENTERPRISE`

**Usage example** in another module:
```typescript
import { isUserPremium } from '../subscription/helpers/entitlement';

// In a feature controller:
if (!(await isUserPremium(req.user.id))) {
  throw new ApiError(403, 'Premium subscription required');
}
```

---

### Edited files (8)

#### 7. `subscription.interface.ts`

**Exports:**
- Enums: `SUBSCRIPTION_PLAN` (`FREE`/`PREMIUM`/`ENTERPRISE`), `SUBSCRIPTION_STATUS` (`active`/`trialing`/`past_due`/`canceled`/`inactive`), `SUBSCRIPTION_PLATFORM` (`apple`/`google`/`admin`)
- Type: `ISubscription` — full subscription document shape
- Type: `SubscriptionModel` — Mongoose model interface with static methods

**Key fields on ISubscription:**
```typescript
{
  userId: Types.ObjectId,
  plan: SubscriptionPlanType,
  status: SubscriptionStatusType,
  platform?: 'apple' | 'google' | 'admin',
  environment?: 'sandbox' | 'production',
  productId?: string,
  autoRenewing?: boolean,

  // Apple-specific
  appleOriginalTransactionId?: string,  // unique index
  appleLatestTransactionId?: string,

  // Google-specific (for phase 2)
  googlePurchaseToken?: string,         // unique index
  googleOrderId?: string,

  // Lifecycle
  startedAt?: Date | null,
  currentPeriodEnd?: Date | null,
  gracePeriodEndsAt?: Date | null,
  canceledAt?: Date | null,

  metadata?: Record<string, any>,
}
```

#### 8. `subscription.model.ts`

Mongoose schema with critical constraints:

- `userId: unique` — one subscription doc per user (upsert pattern)
- `appleOriginalTransactionId: { unique: true, sparse: true }` — **fraud prevention**: same Apple transaction cannot be linked to two different user accounts
- `googlePurchaseToken: { unique: true, sparse: true }` — same for Google
- `platform`, `productId` — indexed for queries
- Timestamps enabled

**Static methods:**
- `findByUser(userId)` — lookup by user
- `upsertForUser(userId, payload)` — create or update atomically

#### 9. `subscription.service.ts`

Thin orchestration layer — delegates to providers + helpers.

**Exports:**
- `getMySubscription(userId)` — returns user's subscription (creates FREE default if none exists)
- `setFreePlan(userId)` — manual switch to FREE
- `verifyApplePurchase(userId, signedTransactionInfo)` — Apple initial purchase flow
- `processAppleWebhook(signedPayload)` — passthrough to `handleAppleNotification`
- `verifyGooglePurchase(userId, purchaseToken, productId)` — Google initial purchase flow
- `processGoogleWebhook(rawBody, authorizationHeader)` — passthrough to `handleGoogleNotification`

**`verifyApplePurchase` flow:**
1. Call `verifyAppleTransaction(signedTransactionInfo)` — cryptographic verification
2. **Fraud check:** query `SubscriptionModel.findOne({ appleOriginalTransactionId })`. If exists and `userId` is different → throw `409 Conflict`
3. Map `decoded.productId` → `SubscriptionPlan` via `mapAppleProductToPlan()`
4. Reject unknown productIds with `400 Bad Request`
5. `SubscriptionModel.upsertForUser()` with all fields populated
6. Return updated subscription doc

**`verifyGooglePurchase` flow:**
1. Call `verifyGoogleSubscription(purchaseToken, productId)` — Android Publisher API call
2. **Fraud check:** query `SubscriptionModel.findOne({ googlePurchaseToken })`. If exists and `userId` is different → throw `409 Conflict`
3. Map `decoded.productId` → `SubscriptionPlan` via `mapGoogleProductToPlan()`
4. Reject unknown productIds with `400 Bad Request`
5. Translate Google's `subscriptionState` to local status (`ACTIVE` or `PAST_DUE`)
6. Reject if subscription is not active or in grace period
7. `SubscriptionModel.upsertForUser()` with all fields populated
8. Return updated subscription doc

**Removed from previous version:**
- `verifyIapSubscription()` — the old fake verification that accepted any receipt string. Replaced by the new crypto-verified flow.
- `mapIapProductToPlan()` — replaced by `plan.mapper.ts`

#### 10. `subscription.validation.ts`

Zod schemas for request validation.

**Exports:**
- `SubscriptionValidation.appleVerifySchema` — requires `body.signedTransactionInfo: string`
- `SubscriptionValidation.googleVerifySchema` — requires `body.purchaseToken: string` and `body.productId: string`

The old `verifyIapSubscriptionSchema` is removed (the endpoint it validated is gone).

#### 11. `subscription.controller.ts`

HTTP handlers using project conventions (`catchAsync`, `sendResponse`, `ApiError`).

**Exports:**
- `getMySubscriptionController` — `GET /me`
- `verifyApplePurchaseController` — `POST /apple/verify`
- `appleWebhookController` — `POST /apple/webhook` (special: handles raw Buffer body)
- `verifyGooglePurchaseController` — `POST /google/verify`
- `googleWebhookController` — `POST /google/webhook` (special: handles raw Buffer body + Pub/Sub JWT verification)
- `chooseFreePlanController` — `POST /choose/free`

**Webhook controller special handling:**
- Both `/apple/webhook` and `/google/webhook` routes use `express.raw()` middleware, so `req.body` is a `Buffer`, not a parsed object
- Apple: Manually `JSON.parse(req.body.toString('utf8'))` to extract `signedPayload`
- Google: Passes raw body + `Authorization` header to `processGoogleWebhook()` for Pub/Sub JWT verification + RTDN decode
- Validates presence, then calls the respective service method

#### 12. `subscription.route.ts`

Routes with middleware chain (rate limit → auth → validate → controller):

```
GET  /api/v1/subscription/me               auth required
POST /api/v1/subscription/apple/verify     auth + rate limit + validation
POST /api/v1/subscription/apple/webhook    no auth (JWS self-verifies)
POST /api/v1/subscription/google/verify    auth + rate limit + validation
POST /api/v1/subscription/google/webhook   no auth (Pub/Sub JWT self-verifies)
POST /api/v1/subscription/choose/free      auth required
```

**Removed:** old `POST /iap/verify` route (the fake-verification endpoint).

#### 13. `src/config/index.ts`

Added `apple` and `googlePlay` config sections:

```typescript
apple: {
  bundleId: process.env.APPLE_BUNDLE_ID || '',
  appAppleId: process.env.APPLE_APP_APPLE_ID,
  keyId: process.env.APPLE_KEY_ID,
  issuerId: process.env.APPLE_ISSUER_ID,
  privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH,
  environment: (process.env.APPLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  rootCertsDir: process.env.APPLE_ROOT_CERTS_DIR || './secrets/apple-root-certs',
}

googlePlay: {
  packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || '',
  serviceAccountPath: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH || './secrets/google-service-account.json',
  pubsubAudience: process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE || '',
  pubsubServiceAccountEmail: process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL || '',
}
```

#### 14. `src/app.ts`

Added raw body middleware for both webhook routes **before** the generic `express.json()`:

```typescript
app.use(
  '/api/v1/subscription/apple/webhook',
  express.raw({ type: 'application/json' })
);
app.use(
  '/api/v1/subscription/google/webhook',
  express.raw({ type: 'application/json' })
);
app.use(express.json());
```

**Why:** Apple's JWS signature is computed over the **original raw bytes** of the request body. Google's Pub/Sub push also delivers raw JSON that needs to be parsed manually after JWT verification. If `express.json()` parses the body first, the bytes mutate (whitespace changes, field reordering, etc.) and signature verification fails. The raw parser preserves bytes as-is for the controllers to JSON.parse manually.

---

## NPM Packages

```bash
npm install @apple/app-store-server-library
npm install googleapis google-auth-library
```

**Apple — `@apple/app-store-server-library`** (`^3.0.0`)
- `SignedDataVerifier` — JWS verification
- `AppStoreServerAPIClient` — for calling App Store Server API endpoints
- Type definitions for all Apple data shapes
- `NotificationTypeV2` enum, `Environment` enum

**Google — `googleapis` + `google-auth-library`**
- `google.androidpublisher({ version: 'v3' })` — Android Publisher API client
- `google.auth.GoogleAuth` — service-account-based auth
- `OAuth2Client.verifyIdToken` — verify Pub/Sub push bearer JWTs

---

## API Endpoints

### `GET /api/v1/subscription/me`

Get the current user's subscription.

**Auth:** Bearer JWT required
**Rate limit:** None
**Body:** None

**Response 200:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Subscription retrieved successfully",
  "data": {
    "_id": "6712abc...",
    "userId": "6712xyz...",
    "plan": "PREMIUM",
    "status": "active",
    "platform": "apple",
    "environment": "sandbox",
    "productId": "premium_monthly",
    "autoRenewing": true,
    "appleOriginalTransactionId": "2000000123456789",
    "startedAt": "2026-04-10T12:00:00Z",
    "currentPeriodEnd": "2026-05-10T12:00:00Z",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

If user has no subscription yet, a FREE/active default is created and returned.

---

### `POST /api/v1/subscription/apple/verify`

Verify an Apple IAP initial purchase. Called by the Flutter client after StoreKit 2 completes a purchase.

**Auth:** Bearer JWT required
**Rate limit:** 30 requests per minute per route
**Validation:** Zod schema — `signedTransactionInfo` required string

**Request body:**
```json
{
  "signedTransactionInfo": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Apple subscription verified successfully",
  "data": {
    "_id": "...",
    "userId": "...",
    "plan": "PREMIUM",
    "status": "active",
    "platform": "apple",
    "productId": "premium_monthly",
    "currentPeriodEnd": "2026-05-10T12:00:00Z",
    ...
  }
}
```

**Error responses:**
- `400` — Invalid JWS, missing fields, expired transaction, revoked, bundle mismatch, unknown productId
- `401` — Missing/invalid JWT
- `409` — Transaction already linked to another user account (fraud prevention)
- `429` — Rate limit exceeded
- `500` — Apple credentials not configured (on first call when certs/keys missing)

---

### `POST /api/v1/subscription/apple/webhook`

Apple App Store Server Notifications V2 webhook. Called by Apple's servers when subscription lifecycle events happen.

**Auth:** None — JWS signature verification replaces caller trust
**Body:** Raw JSON (not parsed by express.json — see raw body middleware note)

**Expected body shape:**
```json
{
  "signedPayload": "eyJhbGciOiJFUzI1NiIs..."
}
```

**Response 200:**
```http
HTTP/1.1 200 OK
Content-Length: 0
```
*(No body is returned to avoid leaking internal processing state to Apple servers)*

**Error responses:**
- `400` — Invalid JWS or malformed body
- `500` — Credentials not configured

**Configuration required in App Store Connect:**
- App Information → App Store Server Notifications
- Production Server URL: `https://<your-domain>/api/v1/subscription/apple/webhook`
- Sandbox Server URL: same
- Version: Version 2 Notifications (JWS format)

---

### `POST /api/v1/subscription/google/verify`

Verify a Google Play subscription purchase. Called by the Android client after `BillingClient` completes a purchase.

**Auth:** Bearer JWT required
**Rate limit:** 30 requests per minute per route
**Validation:** Zod schema — `purchaseToken` and `productId` required

**Request body:**
```json
{
  "purchaseToken": "abc123...",
  "productId": "premium_monthly"
}
```

**Response 200:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Google subscription verified successfully",
  "data": {
    "_id": "...",
    "userId": "...",
    "plan": "PREMIUM",
    "status": "active",
    "platform": "google",
    "productId": "premium_monthly",
    "googlePurchaseToken": "abc123...",
    "googleOrderId": "GPA.1234-5678-9012-34567",
    "currentPeriodEnd": "2026-05-10T12:00:00Z"
  }
}
```

**Error responses:**
- `400` — Google API error, expired subscription, inactive state, unknown productId
- `401` — Missing/invalid JWT
- `409` — Purchase token already linked to another user
- `429` — Rate limit exceeded
- `500` — Google credentials not configured

---

### `POST /api/v1/subscription/google/webhook`

Google Play Real-Time Developer Notifications webhook (Pub/Sub push). Called by Google Cloud Pub/Sub when subscription lifecycle events happen.

**Auth:** None at the app layer — the service verifies the bearer JWT from Pub/Sub against the configured audience
**Body:** Raw JSON Pub/Sub envelope (not parsed by `express.json` — see raw body middleware note)

**Expected body shape:**
```json
{
  "message": {
    "data": "<base64-encoded RTDN JSON>",
    "messageId": "1234567890",
    "publishTime": "2026-04-10T12:00:00Z"
  },
  "subscription": "projects/your-project/subscriptions/play-rtdn-push"
}
```

**Decoded RTDN payload (after base64 decode of `message.data`):**
```json
{
  "version": "1.0",
  "packageName": "com.yourcompany.tbsosick",
  "eventTimeMillis": "1712750400000",
  "subscriptionNotification": {
    "version": "1.0",
    "notificationType": 2,
    "purchaseToken": "abc123...",
    "subscriptionId": "premium_monthly"
  }
}
```

**Response 200:**
```http
HTTP/1.1 200 OK
Content-Length: 0
```
*(No body is returned to avoid leaking internal processing state to Google servers)*

**Error responses:**
- `400` — Invalid Pub/Sub JWT verification failed
- `500` — Google credentials not configured

**Configuration required:**
- GCP Pub/Sub topic + push subscription pointing here
- Play Console → Monetization → Real-time developer notifications → topic configured
- `GOOGLE_PLAY_PUBSUB_AUDIENCE` env var set to this URL

---

### `POST /api/v1/subscription/choose/free`

Manually switch user to FREE plan.

**Auth:** Bearer JWT required

**Business Logic:**
- **Active Store Guard**: Jodi user-er active Apple ba Google subscription thake, tobe request **409 Conflict** return korbe. User-ke age store theke cancel korte hobe.
- **Audit Log**: Transition track kora hoy `SubscriptionEvent` collections e.

**Response 200:**
```json
{
  "success": true,
  "message": "Switched to Free plan successfully",
  "data": { ...subscriptionDoc }
}
```

---

## Environment Variables

Add to `.env`:

```bash
# Apple IAP — required for Apple side of subscription module
APPLE_BUNDLE_ID=com.yourcompany.tbsosick          # from App Store Connect
APPLE_APP_APPLE_ID=1234567890                     # numeric App ID from App Store Connect
APPLE_KEY_ID=ABC1234DEF                           # 10-char Key ID from API key generation
APPLE_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # UUID from App Store Connect
APPLE_PRIVATE_KEY_PATH=./secrets/apple-key.p8     # path to .p8 private key file
APPLE_ENVIRONMENT=sandbox                         # 'sandbox' or 'production'
APPLE_ROOT_CERTS_DIR=./secrets/apple-root-certs   # directory containing Apple root CAs

# Google Play Billing — required for Google side of subscription module
GOOGLE_PLAY_PACKAGE_NAME=com.yourcompany.tbsosick
GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=./secrets/google-service-account.json
GOOGLE_PLAY_PUBSUB_AUDIENCE=https://your-domain.com/api/v1/subscription/google/webhook
GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL=your-pubsub-pusher@your-project.iam.gserviceaccount.com
```

**IMPORTANT:**
- Add `secrets/` to `.gitignore` — never commit these files
- The `.p8` file can only be downloaded once from App Store Connect
- Sandbox and production environments use different URLs; the library auto-detects based on the transaction environment

---

## External Setup (Apple Developer Account)

### Step 1 — Apple Developer Program

1. Visit https://developer.apple.com/programs/enroll/
2. Enroll for $99/year (Individual or Organization)
3. Wait 24-48 hours for approval

### Step 2 — Create app in App Store Connect

1. https://appstoreconnect.apple.com/ → My Apps → `+` → New App
2. Platforms: iOS
3. Bundle ID: create if needed (must have "In-App Purchase" capability enabled)
4. SKU: internal identifier

### Step 3 — Create Subscription Group + Products

**⚠️ Navigation path update:** Purano path chilo "Features → In-App Purchases → Subscriptions" — eita ekhon change hoyeche.

#### Part A — Subscription Group banao

1. App Store Connect → **My Apps** → tomar app select koro
2. Left sidebar e **"Monetization"** section khujho → click **"Subscriptions"**
   - (Purano "Features → In-App Purchases" path e jeo na — subscriptions ekhon "Monetization" er under e)
3. **"Subscription Groups"** heading er pashe **"+"** button click koro
4. **Reference Name**: `Premium Membership` (internal name — users dekhbe na)
5. Click **"Create"** — group er detail page e land korba

#### Part B — Premium Monthly subscription banao

6. Group er detail page e **"Subscriptions"** section e **"+"** click koro
7. Fill in:
   - **Reference Name**: `Premium Monthly` (internal — users dekhbe na)
   - **Product ID**: `premium_monthly`
     - ⚠️ Eta **change ba reuse kora jay na** — ekbar create korle forever locked, delete korleo reuse hobe na
8. Click **"Create"** — subscription detail page e land korba

#### Part C — Duration set koro

9. **"Subscription Duration"** dropdown theke select koro: **1 Month**

#### Part D — Price set koro

10. **"Subscription Pricing"** section e **"+"** ba **"Add Subscription Price"** click koro
11. Base country select koro: **United States** (ba tomar primary market)
12. Price select koro: **$5.99**
    - Apple ekhon **900+ price points** support kore — purano Tier 1/2/3 system nai
    - Prices $0.29 theke $10,000 porjonto set kora jay
13. Confirm koro — Apple automatically baki shob country er price generate kore dibe
    - Individual country er price manually override o korte paro
14. Click **"Save"** ba **"Confirm"**

#### Part E — Localization add koro (REQUIRED)

15. **"App Store Localization"** section e **"+"** click koro
16. Language select koro: **English (U.S.)**
17. **Display Name**: `Premium Monthly` (eta users dekhbe App Store e)
18. **Description**: `Unlimited access to all premium features. Billed monthly.`
19. Click **"Save"**

⚠️ Minimum 1 localization na dile subscription review te submit korte parba na.

#### Part F — Review Information add koro (REQUIRED for submission)

20. **"Review Information"** section e:
    - **Screenshot**: Tomar app er paywall/subscription UI er ekta screenshot upload koro (REQUIRED)
    - **Review Notes**: Optional but recommended — reviewer ke bolte paro kivabe test korbe
21. Click **"Save"**

#### Part G — Status check koro

22. Shob field fill korar por subscription er status dekhabe: **"Ready to Submit"**
    - **"Missing Metadata"** dekhale — kono required field miss hoyeche, check koro
    - Sandbox testing er jonno **"Ready to Submit"** status e thakle-i cholbe — review submit korar dorkar nai

#### Part H — Baki 3ta subscription banao

23. Steps 6-22 repeat koro baki 3ta product er jonno:

| Reference Name | Product ID | Duration | Price |
|---|---|---|---|
| Premium Yearly | `premium_yearly` | 1 Year | $3.99/mo billed yearly ($47.88/yr) |
| Enterprise Monthly | `enterprise_monthly` | 1 Month | $9.99/mo |
| Enterprise Yearly | `enterprise_yearly` | 1 Year | $5.99/mo billed yearly ($71.88/yr) |

24. **Product IDs must match exactly** with `helpers/plan.mapper.ts`

#### Part I — Billing Grace Period (recommended)

25. Subscription group er detail page e fire jao
26. Group settings e **"Billing Grace Period"** option khujho
27. Enable koro — eta subscribers ke billing retry period e access dite dey (card expire hole immediately cancel hobe na)
28. Tomar backend e `PAST_DUE` status eta handle kore — `entitlement.ts` e `ACTIVE_STATUSES` set e `PAST_DUE` include ache

### Step 4 — Generate API Key (`.p8`) + Find Key ID & Issuer ID

Ei step e tumi 3 ta jinish pabe: **`.p8` file**, **Key ID** (10 char), **Issuer ID** (UUID). Tinta-i `.env` e lagbe.

#### Part A — API Key Generate koro

1. https://appstoreconnect.apple.com/ e login koro
2. Top right e **"Users and Access"** click koro
3. Top tab e **"Integrations"** click koro
4. Left sidebar theke select koro:
   - **"In-App Purchase"** — jodi shudhu IAP API access dorkar (recommended for this module)
   - **"App Store Connect API"** — jodi pura App Store Connect API access dorkar (Team Key)
5. **"Generate API Key"** ba **"+"** button click koro
6. **Name** dao (e.g. `tbsosick-iap-key`) — internal reference
7. **Access** select koro: **In-App Purchase** (minimum dorkari)
8. **"Generate"** click koro
9. Notun row create hobe — **"Download API Key"** link click kore `.p8` file download koro
   - ⚠️ **Eta shudhu ek baar download hoy.** Lose korle abar generate korte hobe.
10. Download kora file ti rename kore project e save koro: `./secrets/apple-key.p8`

#### Part B — Key ID copy koro

11. Same page e (Users and Access → Integrations → In-App Purchase) tomar key er row te **"Key ID"** column dekhbe
12. Eta 10 character er code (e.g. `ABC1234DEF`) — copy koro
13. Eta hobe tomar `.env` er **`APPLE_KEY_ID`** value

#### Part C — Issuer ID copy koro

14. Same page er **upore** (key list er ageeee) **"Issuer ID"** label diye ekta UUID dekhbe
    - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
    - Pashe ekta **"Copy"** button thake
15. Click kore copy koro
16. Eta hobe tomar `.env` er **`APPLE_ISSUER_ID`** value

#### Part D — Bundle ID + Apple ID o note kore rakho

17. Top left **"Apps"** e jao → tomar app click koro
18. Left sidebar e **"App Information"** click koro
19. **"General Information"** section e ei duita field dekhbe:
    - **Bundle ID**: e.g. `com.tbsosick.app` → `.env` er **`APPLE_BUNDLE_ID`**
    - **Apple ID**: numeric (e.g. `1234567890`) → `.env` er **`APPLE_APP_APPLE_ID`** (optional but recommended)

#### Summary — Step 4 er por tomar ja thakbe

| Item | Value | `.env` variable |
|---|---|---|
| `.p8` file | `./secrets/apple-key.p8` | `APPLE_PRIVATE_KEY_PATH` |
| Key ID | 10 char (e.g. `ABC1234DEF`) | `APPLE_KEY_ID` |
| Issuer ID | UUID | `APPLE_ISSUER_ID` |
| Bundle ID | `com.tbsosick.app` | `APPLE_BUNDLE_ID` |
| Apple ID | numeric | `APPLE_APP_APPLE_ID` |

### Step 5 — Download Apple Root Certificates

1. Visit https://www.apple.com/certificateauthority/
2. Download:
   - `AppleRootCA-G3.cer`
   - `AppleIncRootCertificate.cer`
3. Place both files in `./secrets/apple-root-certs/`

### Step 6 — Configure Server Notifications V2

**Eta ki jinish?** — Shobar age concept bujhe nao:

Jokhon kono user tomar app e subscribe kore, ba cancel kore, ba renew hoy, ba refund hoy — **Apple tomar backend ke automatically janay** je "ei event hoyeche." Eita holo **Server Notification** (webhook). Tomar backend ei notification receive kore subscription state update kore.

Ei notifications **keno dorkar?**
- User Apple Settings theke cancel korlo → tomar backend janto na → ekhon Apple janay diye "ei user cancel korlo"
- Apple credit card charge korte parlo na → Apple janay "payment failed"
- Auto-renewal hoyeche → Apple janay "notun period start, expiry extend koro"
- User refund nilo → Apple janay "immediately access revoke koro"

**Apple ei notifications 2 ta environment er jonno alada pathay:**

| Environment | Kobe use hoy | URL dorkar? |
|---|---|---|
| **Sandbox** | Testing time e — sandbox tester account diye test purchase korle | Hae — development/staging URL |
| **Production** | Real users real money diye kinle — live app e | Hae — production domain URL |

**Eida keno alada?** Sandbox e fake purchase hoy (real taka charge hoy na) — tai Apple sandbox events ar production events ek jaygay mix korte cay na. Tumi chaile duitai same URL e pathate paro, ba alada URL e pathate paro.

#### Part A — App Store Connect e Notification URL set koro

1. App Store Connect → **My Apps** → tomar app select koro
2. Left sidebar e **"App Information"** click koro
3. Scroll down kore **"App Store Server Notifications"** section khujho
4. Duita URL field dekhbe:
   - **Production Server URL**
   - **Sandbox Server URL**
5. Duitai fill koro:
   - **Production Server URL**: `https://<your-production-domain>/api/v1/subscription/apple/webhook`
     - Example: `https://api.tbsosick.com/api/v1/subscription/apple/webhook`
     - Eta tomar LIVE server er URL hobe — jekhane real users real taka diye kinbe
   - **Sandbox Server URL**: `https://<your-staging-domain>/api/v1/subscription/apple/webhook`
     - Example: `https://staging-api.tbsosick.com/api/v1/subscription/apple/webhook`
     - Eta tomar TESTING/STAGING server er URL — jekhane sandbox testers fake purchase test korbe

6. **Version**: **Version 2 Notifications** select koro (purano V1 na, V2 tomar code e support kora ache)

7. Click **"Save"**

#### Part B — URL ekta-i thakle?

**Tomar ekhon jodi ektai server thake** (separate staging nai), tahole duita URL e same URL dite paro:
```
Production: https://api.tbsosick.com/api/v1/subscription/apple/webhook
Sandbox:    https://api.tbsosick.com/api/v1/subscription/apple/webhook
```

**Eita ki problem?** Na, kono problem nai — tomar backend er Apple library **automatically detect** kore kon environment theke notification ashche (sandbox vs production). `apple.verify.ts` e eita handle kora ache already.

But recommended holo — **sandbox ar production alada rakha**, karon:
- Sandbox e onek test data thakbe (accelerated renewals, test purchases)
- Production DB te test data mix hoye jabe na
- Debug korte easy

#### Part C — Local development e test korte chaile (ngrok)

Tomar local machine e dev server chalachcho (`npm run dev` → `http://localhost:5000`). Kintu Apple tomar localhost e notification pathate parbe na — public URL dorkar.

**Solution: ngrok** — eta tomar localhost ke public URL e expose kore dey.

1. Install ngrok: `npm install -g ngrok` ba https://ngrok.com/download theke download koro
2. Terminal e: `ngrok http 5000` (5000 = tomar backend port)
3. Ngrok ekta URL debe: `https://abc123.ngrok-free.app`
4. App Store Connect e **Sandbox Server URL** e paste koro: `https://abc123.ngrok-free.app/api/v1/subscription/apple/webhook`
5. Save koro
6. Ekhon tomar iPhone theke sandbox purchase korle — Apple notification tomar ngrok URL e pathabe → jeta tomar localhost e forward hobe

⚠️ ngrok URL restart korle change hoy (free plan e). Paid plan e static URL pawa jay.

#### Part D — Test Notification pathiye verify koro

> **IMPORTANT:** App Store Connect UI te kono `"Send Test Notification"` button **nai**. Apple ei feature ti shudhu **App Store Server API** er endpoint diye expose koreche:
> ```
> POST https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications/test   (sandbox)
> POST https://api.storekit.itunes.apple.com/inApps/v1/notifications/test            (production)
> ```
> Auth — `ES256` JWT (max 20 min lifetime), `.p8` key + `KEY_ID` + `ISSUER_ID` + `BUNDLE_ID` diye sign kora.

Ei project e amra `@apple/app-store-server-library` use kori jeta ei JWT generate ar API call internally handle kore. Tai tomar shudhu ekta chhoto script run korte hobe — ja ache: **`scripts/send-apple-test-notification.ts`**.

**Steps:**

1. Confirm koro tomar `.env` e ei value gulo set ache:
   - `APPLE_KEY_ID`
   - `APPLE_ISSUER_ID`
   - `APPLE_PRIVATE_KEY_PATH` (`./secrets/apple-key.p8`)
   - `APPLE_BUNDLE_ID`
   - `APPLE_ENVIRONMENT` (`sandbox` ba `production`)
   - `APPLE_ROOT_CERTS_DIR` (`./secrets/apple-root-certs`)

2. Confirm koro App Store Connect → tomar app → App Information → "App Store Server Notifications" section e **Sandbox Server URL** set up kora ache (ngrok URL + `/api/v1/subscription/apple/webhook`, Version 2)

3. Backend running rakho (`npm run dev`) ar ngrok up rakho

4. Script run koro:
   ```bash
   npx ts-node scripts/send-apple-test-notification.ts
   ```

5. Ki hobe:
   - Script Apple er API te `requestTestNotification()` call kore
   - Apple immediately tomar configured Sandbox Server URL e ekta JWS-signed `TEST` notification POST kore
   - Tomar `appleWebhookController` hit hobe → `handleAppleNotification()` chalbe
   - Backend log e dekhbe:
     ```
     Apple TEST notification received — webhook reachable
     ```
   - HTTP response shape:
     ```json
     {
       "success": true,
       "statusCode": 200,
       "message": "Apple webhook processed",
       "data": { "processed": true, "notificationType": "TEST", "subtype": null }
     }
     ```
   - Script terminal e `testNotificationToken` print korbe — ei token diye chaile pore Apple er kache delivery status check korte paro `getTestNotificationStatus(token)` diye

6. Jodi script error deye ba webhook hit na hoy:
   - **`401`/`403` from Apple:** JWT credentials wrong — `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, ba `.p8` file mismatch
   - **`URL not configured`:** App Store Connect e Sandbox Server URL save koro ni
   - **Backend log e kichu nai:** ngrok down, ngrok URL App Store Connect er save kora URL er sathe match korche na, ba raw body middleware order wrong (`express.raw()` `express.json()` er **age** thakte hobe, `src/app.ts` check koro)
   - **`Apple notification verification failed`:** Root certs missing — `./secrets/apple-root-certs/` e `AppleRootCA-G3.cer` ar `AppleIncRootCertificate.cer` ache ki check koro

**Test notification success mane — Apple tomar backend find korte parche ar tumi ready real events receive korar jonno.**

#### Summary

| Field | Ki dite hobe | Kobe use hobe |
|---|---|---|
| **Production Server URL** | Live production server URL | Real users real taka diye kinle |
| **Sandbox Server URL** | Staging/dev server URL (ba ngrok URL local test er jonno) | Sandbox testers fake purchase korle |
| **Version** | Version 2 Notifications | Always — V1 purano, V2 use korte hobe |

### Step 7 — Create Sandbox Tester (Fake Apple Account for Testing)

#### Eta ki ar keno dorkar?

**Sandbox Tester** holo Apple er deya ekta **fake Apple ID** — eita diye tomar app e fake purchase korte parba **kintu real taka kata hobe na**. Real Apple ID diye sandbox e purchase kora jay na — Apple eta block kore.

**Keno alada account?**
- Real Apple ID → real money charge → tumi nijer kena jiniser jonno taka diye fele dewar risk
- Sandbox Apple ID → fake transactions, free, auto-renewal accelerated (yearly = 1 hour, monthly = 5 min)
- Apple webhooks production environment ar sandbox environment alada vabe handle kore

#### Part A — App Store Connect e Sandbox Tester banao

1. https://appstoreconnect.apple.com/ e login koro
2. Top right e **"Users and Access"** click koro
3. Top tab e **"Sandbox"** select koro (Users / Integrations / Sandbox tab er moddhe)
4. Left sidebar e **"Test Accounts"** click koro
5. Top right e **"+"** button click koro
6. Form fill koro:
   - **First Name** / **Last Name**: jekono nam (e.g. `Test User`)
   - **Email**: ⚠️ **Eta ekta fake email diteo cholbe** (e.g. `test1@tbsosick.test`) — Apple verify korbe na, kintu eita tomar real Apple ID er email **na hote hobe**
   - **Password**: minimum 8 char, uppercase + number + special char (e.g. `Test@1234`)
   - **Country/Region**: **United States** (recommended — IAP product gulo $USD price e kora)
   - **Date of Birth**: jekono adult age (18+)
7. **"Create"** click koro
8. Account create hoye gele list e show korbe — email + password kothao note kore rakho

⚠️ **CRITICAL Warnings:**
- Ei email tumi **iCloud login e use korbe na, kothao kora jabe na** — sandbox tester shudhu **App Store sandbox** er jonno
- Ei email diye Apple ID password reset / 2FA setup **kichu korte cesta korbe na** — eita real account na
- Sandbox tester account **shudhu testing er jonno** — production e purchase korle reject hobe

#### Part B — Physical iPhone e Sign In koro

⚠️ **Simulator e IAP test kora JAY NA** — physical iPhone lagbe.

**iOS 12 ar newer e (recommended path):**

1. iPhone unlock koro
2. **Settings** app khulo
3. Scroll down → **"App Store"** tap koro
4. Scroll down → **"Sandbox Account"** section khujho (page er nicher dike)
   - ⚠️ **Eta tomar app theke purchase try korar age dekhabe na** — initially eita hidden thake
   - Jodi na dekho, age tomar app theke ekta purchase try koro (cancel korleo cholbe) — tarpor "Sandbox Account" appear korbe
5. **"Sign In"** tap koro
6. Sandbox tester er email + password type koro (Part A te ja banaiyecho)
7. Sign in hobe — ekhane real Apple ID password chai na

**Alternative path (jodi upor er ta kaj na kore):**
- Just tomar app khulo → purchase button tap koro → Apple er purchase sheet ashbe → ekhane sandbox tester credentials diye sign in koro
- Ei flow e Apple automatically sandbox account use korbe

#### Part C — Verify Setup

Sandbox account properly configured ki check korte:

1. iPhone Settings → App Store → niche scroll → "Sandbox Account" section e tomar tester email dekha jacche ki?
2. Tomar app khulo → ekta `premium_monthly` purchase try koro
3. Apple er purchase sheet er **niche** chhoto kore lekha thakbe: **`[Environment: Sandbox]`** ba **`Sandbox`** label
   - Eita dekha mane setup correct
   - Eita na dekha mane production environment use hocche → setup wrong

#### Part D — Sandbox Tester Reset (jodi atke jay)

Kokhono kokhono sandbox account stuck hoye jay (e.g. "subscription already active" error). Reset korar nyom:

1. App Store Connect → Users and Access → Sandbox → Test Accounts
2. Tomar tester er row e click koro
3. **"Edit Subscription Renewal Rate"** ba **"Clear Purchase History"** option khujho
4. Click kore reset koro
5. Backend e bhi tomar `Subscription` document ti delete kore dao (jodi orphan thake)

---

## Testing Guide

### Overview — testing flow ki rokom

```
[Sandbox Tester banao]  (Step 7)
        ↓
[Physical iPhone e sign in]  (Step 7 Part B)
        ↓
[ngrok up rakho + backend run koro]
        ↓
[App theke purchase test koro]
        ↓
[Backend log + DB verify koro]
        ↓
[Each lifecycle event test koro: renewal, cancel, expire, refund]
```

### Pre-flight Checklist (test shuru korar age)

| Check | Verify by |
|---|---|
| Backend running | `npm run dev` — log e "Server is listening" |
| MongoDB connected | Startup log e "MongoDB connected successfully" |
| ngrok up | `ngrok http <PORT>` chalano ache, https URL show korche |
| Sandbox Server URL set | App Store Connect → App Information → App Store Server Notifications → Sandbox URL = `<ngrok-url>/api/v1/subscription/apple/webhook`, Version 2 |
| Sandbox tester logged in | iPhone Settings → App Store → Sandbox Account section e tester email |
| Subscription products created | App Store Connect → Monetization → Subscriptions → 4 products **"Ready to Submit"** status |
| Test notification baseline kora | `npx ts-node scripts/send-apple-test-notification.ts` chalanor por backend log e "Apple TEST notification received — webhook reachable" deya jay |

Sob green hole tarpor real testing shuru koro.

### Sandbox Accelerated Timing — eta jana joruri

Apple sandbox e timing **drastically accelerated** — production er moto wait korte hobe na:

| Production timing | Sandbox timing |
|---|---|
| 1 month subscription | **5 minutes** |
| 1 year subscription | **1 hour** |
| 3 day trial | **2 minutes** |
| 1 week | **3 minutes** |
| Grace period (16 days) | **~16 minutes** |

**Auto-renewal max 6 times** — 6 ta renewal er por sandbox automatic stop hoy. Manei monthly subscription test korle ~30 minute e shob 6 ta renewal cycle dekhte parba.

### Test Scenarios — step by step

#### Scenario 1: Initial Purchase (most important)

**Goal:** User app e subscribe korle backend properly create kore subscription doc, plan upgrade hoy.

**Steps:**
1. iPhone e tomar app khulo
2. Subscribe button tap koro (jeta `premium_monthly` product trigger kore)
3. Apple er purchase sheet ashbe — bottom e "Sandbox" label confirm koro
4. Face ID / passcode diye confirm koro
5. Apple "Purchase Successful" dekhabe

**Backend e ki hoye expect korba:**
1. Flutter app `POST /api/v1/subscription/apple/verify` call korbe `signedTransactionInfo` body diye
2. Backend log e dekhbe:
   ```
   POST /api/v1/subscription/apple/verify 200
   ```
3. MongoDB `subscriptions` collection e notun document create hobe:
   - `userId`: tomar user
   - `platform`: `"apple"`
   - `plan`: `"PREMIUM"`
   - `status`: `"active"`
   - `appleOriginalTransactionId`: numeric string
   - `currentPeriodEnd`: ~5 min future (sandbox accelerated)
4. **Sathe sathe** Apple ekta webhook o pathate pare (`SUBSCRIBED` notification) — backend log e dekhbe:
   ```
   Apple notification SUBSCRIBED applied to subscription <id>
   ```

**Verify:**
- `GET /api/v1/me` (ba je endpoint user info return kore) → user er `plan` field `PREMIUM` show korche ki?
- MongoDB e document ache ki: `db.subscriptions.findOne({ userId: <id> })`

**Common issues:**
| Issue | Cause |
|---|---|
| `409 Conflict` "already linked to another account" | Same sandbox tester diye age onno user account theke purchase kora hoyechilo. Sandbox tester reset koro (Step 7 Part D). |
| Verify endpoint hit hocche na | Flutter app side — Apple `signedTransactionInfo` backend e pathay ki check koro |
| `verifyAppleTransaction` fail | Bundle ID mismatch — `.env` `APPLE_BUNDLE_ID` ar app er bundle ID same ki |

---

#### Scenario 2: Auto-Renewal (5 min wait)

**Goal:** Subscription period shesh hole Apple automatically renew kore — backend `currentPeriodEnd` extend kore, plan active thake.

**Steps:**
1. Scenario 1 successful purchase er por **5 minutes wait koro** (sandbox monthly = 5 min)
2. Phone e kichu korar dorkar nai — Apple background e renew korbe
3. Apple webhook pathabe tomar backend e

**Backend e expected log:**
```
Apple notification DID_RENEW applied to subscription <id>
```

**Verify in MongoDB:**
- `currentPeriodEnd` ekhon **purono value er theke 5 min agee** (notun period start)
- `status` = `"active"` (unchanged)
- `appleLatestTransactionId` notun transactionId e update hoye geche
- `metadata.lastAppleNotificationType` = `"DID_RENEW"`
- `metadata.lastAppleNotificationAt` recent timestamp

---

#### Scenario 3: Cancel (subscription stop, but keep access until period ends)

**Goal:** User cancel korle immediately access lose **na**, period end porjonto access thake (industry standard behavior)

**Steps:**
1. iPhone e: **Settings** → **[Tomar Apple Account name top]** → **Subscriptions**
2. Tomar app er subscription khujho → tap koro
3. **"Cancel Subscription"** tap koro → confirm koro

**Backend e expected log:**
```
Apple notification DID_CHANGE_RENEWAL_STATUS/AUTO_RENEW_DISABLED applied to subscription <id>
```

**Verify in MongoDB:**
- `autoRenewing` = `false` (changed)
- `status` = `"active"` (**unchanged** — user still has access)
- `plan` = `"PREMIUM"` (**unchanged**)
- `currentPeriodEnd`: same hisabe future date

⚠️ **Important:** Status `canceled` **na** ekhon — user period end porjonto premium feature use korte parbe. Eta correct industry standard behavior.

---

#### Scenario 4: Expire (period shesh, no renewal)

**Goal:** Cancel korar por period shesh holo — ekhon access revoke hobe.

**Steps:**
1. Scenario 3 (cancel) er por **`currentPeriodEnd` porjonto wait koro** (max 5 min)
2. Apple automatically `EXPIRED` notification pathabe

**Backend e expected log:**
```
Apple notification EXPIRED applied to subscription <id>
```

**Verify in MongoDB:**
- `status` = `"inactive"` (changed)
- `plan` = `"FREE"` (downgraded)
- `gracePeriodEndsAt` = `null`

User ekhon FREE plan e — premium feature lock hoye gelo.

---

#### Scenario 5: Refund (immediate revoke)

**Goal:** User refund nile **shongey shongey** access revoke hobe (cancel er moto wait kora hoy na — refund mane intentional reversal)

**Steps:**

Sandbox e refund test kora ektu trickier. Duita way ache:

**Option A — Apple's official Sandbox refund tool:**
1. Apple er sandbox refund test page e jao: https://developer.apple.com/help/app-store-connect/test-in-app-purchases-with-sandbox/test-refund-requests-in-the-sandbox/
2. Sandbox tester credentials diye login koro
3. Tomar transaction khujho → "Request Refund" click koro

**Option B — TestFlight build e StoreKit refund API:**
- Tomar Flutter app e StoreKit `requestRefund()` API call koro (iOS 15+)

**Backend e expected log:**
```
Apple notification REFUND applied to subscription <id>
```

**Verify in MongoDB:**
- `status` = `"canceled"` (immediate)
- `plan` = `"FREE"` (downgraded immediately)
- `canceledAt` = current timestamp
- User immediately premium feature lose korbe

---

#### Scenario 6: Restore Purchases (cross-device)

**Goal:** Same Apple ID e onno device e login korle subscription restore hoye jabe.

**Steps:**
1. Onno ekta iPhone e tomar app install koro
2. Same sandbox tester account diye sign in koro (App Store)
3. App er "Restore Purchases" button tap koro (Flutter side e implement kora thakbe)
4. StoreKit Apple er kache jay → existing subscription er signed transaction return kore
5. Flutter app abar `POST /api/v1/subscription/apple/verify` call kore

**Backend e expected:**
- Same `appleOriginalTransactionId` ashbe
- Backend dekhbe ei transaction tomar same user er sathe linked
- Subscription doc unchanged thakbe (idempotent — duplicate create hobe na)

---

### Webhook Testing (Production e jawar age)

**Sob test successful holey** ei verify koro:

| Verify | How |
|---|---|
| TEST notification end-to-end works | `npx ts-node scripts/send-apple-test-notification.ts` (already done ✅) |
| Real purchase verify works | Scenario 1 |
| Auto-renewal webhook handling | Scenario 2 |
| Cancel webhook handling | Scenario 3 |
| Expire webhook handling | Scenario 4 |
| Refund webhook handling | Scenario 5 |
| Restore (multi-device) | Scenario 6 |

**Important notes:**
- Apple library `SignedDataVerifier` real Apple-signed payload chai — locally hand-crafted fake webhook send kora jay na
- Tai actual sandbox purchases-i tomar real testing tool
- Each scenario er por ngrok URL e dekho POST request ashche ki na (`http://localhost:4040` ngrok inspector)

### Local Dev with ngrok — quick reference

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 5009    # tomar PORT

# Copy https URL → App Store Connect Sandbox Server URL e save koro
# (URL ngrok restart korle change hoy — paid plan e static URL pawa jay)

# Terminal 3 — anytime trigger
npx ts-node scripts/send-apple-test-notification.ts
```

⚠️ **ngrok free tier:** URL restart korle change hoy. Manei prottek bar ngrok restart korar por App Store Connect e new URL save korte hobe. Paid ngrok plan e static subdomain pawa jay — production-like testing easier.

---

## Security Features

| Attack surface | Protection |
|---|---|
| **Fake receipt injection** | JWS cryptographic signature verification via `SignedDataVerifier` |
| **Same receipt used by multiple accounts** | Unique sparse index on `appleOriginalTransactionId` |
| **Tampered transaction data** | JWS signature includes all fields; any modification invalidates |
| **Expired transaction replay** | `expiresDate` check rejects past-expiry transactions |
| **Revoked transaction replay** | `revocationDate` check rejects revoked transactions |
| **Cross-bundle receipt injection** | `bundleId` match check against `config.apple.bundleId` |
| **Duplicate webhook processing** | `notificationUUID` idempotency check in `metadata` |
| **Unknown product IDs** | Explicit lookup in `plan.mapper.ts`; unknown IDs rejected 400 |
| **Rate limiting** | 30 requests/minute on `/apple/verify` |
| **Missing JWT auth** | `auth()` middleware on verify endpoint |
| **Webhook spoofing** | JWS signature verification; no auth middleware needed |

---

## Troubleshooting

### Error: "Apple root certificates directory not found"

**Cause:** `APPLE_ROOT_CERTS_DIR` doesn't exist or has no `.cer` files.

**Fix:**
1. Download Apple root CAs from https://www.apple.com/certificateauthority/
2. Place `.cer` files in the configured directory (default `./secrets/apple-root-certs/`)
3. Make sure files have `.cer` or `.der` extension

### Error: "APPLE_BUNDLE_ID environment variable is not configured"

**Cause:** `.env` missing `APPLE_BUNDLE_ID`.

**Fix:** Add the bundle ID from App Store Connect to `.env`.

### Error: "Bundle ID mismatch: expected X, received Y"

**Cause:** The transaction was made by a different app (bundle), or the env var is wrong.

**Fix:** Verify `APPLE_BUNDLE_ID` in `.env` matches the actual bundle ID registered in App Store Connect AND embedded in the iOS app build.

### Error: "This Apple transaction is already linked to another account" (409)

**Cause:** The `originalTransactionId` is already associated with a different user in the DB.

**Fix:** This is fraud prevention working correctly. A user cannot buy one subscription and share it across multiple accounts. If a legitimate case (e.g., user created a new account), admin should manually clean up the old subscription record.

### Error: "Unknown or unsupported productId: X"

**Cause:** The productId returned from Apple doesn't exist in `helpers/plan.mapper.ts`.

**Fix:** Add the productId to the `PRODUCT_ID_TO_PLAN` lookup table. Make sure the ID matches exactly what was configured in App Store Connect.

### Webhook returns 200 but subscription doesn't update

**Possible causes:**
1. **Orphan notification** — client hasn't called `/verify` yet, so no subscription doc exists. Log message: "Orphan Apple notification ..."
2. **Duplicate** — notificationUUID matches existing `metadata.lastAppleNotificationUUID`. Log message: check response `reason: 'duplicate'`
3. **Unhandled notification type** — falls through the switch statement. Log message: "Apple notification X — no state change"

**Fix:** Check server logs for the specific reason.

### "Apple notification verification failed"

**Cause:** Could be:
- JWS signature invalid (malformed payload)
- Root certs wrong version
- Clock skew

**Fix:**
1. Verify root certs are downloaded from the official Apple URL
2. Check server clock is accurate (NTP)
3. If testing, make sure you're using real Apple-signed payloads, not hand-crafted fakes

---

## Google Play Integration

### Architecture differences vs Apple

| Concern | Apple | Google Play |
|---|---|---|
| **Initial verify input** | JWS-signed transaction string | `purchaseToken` + `productId` (opaque) |
| **Verification mechanism** | Local JWS signature check (offline crypto) | Server-to-server API call to Android Publisher |
| **Webhook transport** | Direct HTTPS POST from Apple | Google Cloud Pub/Sub push delivery |
| **Webhook auth** | JWS signature on payload | OAuth bearer JWT signed by Pub/Sub |
| **Notification body** | Decoded JWS with signed transaction | Base64-encoded RTDN payload inside Pub/Sub envelope |

### Google API endpoints used

- `purchases.subscriptionsv2.get(packageName, token)` — fetches the latest subscription state
- Real-Time Developer Notifications (RTDN) via Cloud Pub/Sub Push subscription

### Google Play Console + GCP setup

#### Step 1 — Google Play Console signup
1. Go to https://play.google.com/console
2. Pay $25 one-time registration fee
3. Complete identity verification (takes 1-2 days)

#### Step 2 — Create subscription products in Play Console

**Google Play er subscription model ta 3-tier hierarchy:**
```
Subscription (product — just a container, NO price here)
  └── Base Plan (actual pricing + duration lives HERE)
        └── Offer (optional — free trial, intro discount, etc.)
```
- **Subscription** = container with a Product ID + name. Price set kora jay NA directly.
- **Base Plan** = price, duration, grace period — shob ekhane. Ekta subscription e multiple base plan thakte pare (e.g., monthly + yearly).
- **Offer** = optional promotional discount attached to a base plan.

**Base Plan types:**
| Type | Description |
|---|---|
| **Auto-renewing** | Monthly/yearly charge, auto-renews until cancel. Most common. |
| **Prepaid** | One-time payment, NO auto-renew. User manually top-up kore extend korte hoy. |
| **Installments** | Commitment-based (e.g., 12 monthly payments). Select countries only. |

**Now create the products:**

1. Play Console → select your app
2. Left sidebar: **Monetize with Play** → **Products** → **Subscriptions**
3. Click **"Create subscription"** button (top-right)
4. Fill in:
   - Product ID: `premium_monthly`
   - Name: "Premium Monthly"
5. Click **"Create"** — you land on the **subscription detail page**

6. Scroll to the **"Base plans and offers"** section (this is INSIDE the subscription detail page, not a separate tab)
7. Click **"Add base plan"**
8. Fill in:
   - Base Plan ID: e.g. `monthly-autorenew` (monthly er jonno) or `yearly-autorenew` (yearly er jonno)
   - Type: **Auto-renewing**
   - Billing period: **1 month** (monthly) or **1 year** (yearly)
   - Grace period: **7 days** (recommended — retry failed payments before cancelling)
   - Account hold: enable if you want (user loses access but subscription isn't fully cancelled)
   - Resubscribe: enable (let cancelled users resubscribe from Play Store)
9. Click **"Set prices"** → enter price in your default currency (e.g. $5.99 USD)
   - Google auto-generates converted prices for all other countries
   - You can manually override individual country prices
   - Click **"Update"** to confirm
10. Click **"Save"** on the base plan
11. **IMPORTANT:** Base plan starts in **Draft** status — click **"Activate"** to make it live

12. Repeat steps 3-11 for the remaining 3 products:

    | Product ID | Base Plan ID | Name | Duration | Price |
    |---|---|---|---|---|
    | `premium_yearly` | `yearly-autorenew` | Premium Yearly | 1 year | $3.99/mo billed yearly ($47.88/yr) |
    | `enterprise_monthly` | `monthly-autorenew` | Enterprise Monthly | 1 month | $9.99/mo |
    | `enterprise_yearly` | `yearly-autorenew` | Enterprise Yearly | 1 year | $5.99/mo billed yearly ($71.88/yr) |

13. Product IDs must match exactly with `helpers/plan.mapper.ts`

**Common confusion points:**
- "Subscription create korlam but price field nai!" → Price subscription e na, **base plan e** set hoy. "Add base plan" click koro.
- "Base plan kothay?" → Subscription er detail page er vitore **"Base plans and offers"** section e. Alada tab/page na.
- "Subscription app e dekhachhe na!" → Base plan probably still **Draft** — **"Activate"** click koro.

#### Step 3 — Create a GCP project
1. Go to https://console.cloud.google.com/
2. Click project dropdown (top bar) → **New Project**
3. Name it (e.g. `tbsosick-backend`) → **Create**

#### Step 4 — Enable Google Play Android Developer API
1. GCP Console → left sidebar: **APIs & Services** → **Library**
2. Search for **"Google Play Android Developer API"**
3. Click it → click **Enable**

#### Step 5 — Create a Service Account + download key
1. GCP Console → left sidebar: **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name: e.g. `play-billing-service` → click **Create and Continue**
4. Skip role assignment (not needed here) → **Done**
5. Click the service account you just created → **Keys** tab → **Add Key** → **Create new key** → JSON → **Create**
6. A `.json` file downloads — save it as `./secrets/google-service-account.json` in your project

> **Tip:** Downloaded JSON er `client_email` field e service account er email already ache. Jodi Pub/Sub push subscription (Step 9) same service account diye sign kora hoy, tahole `GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL` env var e ei `client_email` er value ta bosao — notun kichu banate hobe na.
>
> ```bash
> # Example JSON field:
> "client_email": "play-billing-service@your-project.iam.gserviceaccount.com"
> ```

#### Step 6 — Link service account in Play Console

**Important:** Ei step er jonno tomar Play Console er **Account Owner** hote hobe. Owner chara "API access" menu dekhabe na.

**Part A — GCP project link koro:**

1. Play Console → left sidebar e niche **Setup** section khujho → click **"API access"**
2. Page er upore **"Link a Google Cloud project"** section thakbe
3. Du ta option dekhbe:
   - **"Create a new Google Cloud project"** — Play Console nije ekta banabe
   - **"Link an existing Google Cloud project"** — dropdown theke tomar Step 3 er project select koro
4. Tomar existing project select koro dropdown theke → click **"Link"**
5. Confirmation dialog asle confirm koro

**Project dropdown e tomar project dekhachhe na?** Tomar Google account er oi GCP project e **Owner** ba **Editor** role thakte hobe. GCP Console → IAM → check koro.

**Part B — Service account automatically appear hobe:**

6. Link korar por page refresh hobe — niche **"Service accounts"** section e tomar GCP project er shob service account dekhabe
7. Tomar `play-billing-service@your-project.iam.gserviceaccount.com` email ta ekhane dekhte pabe
8. Service account er row er right side e **"Grant access"** ba **"Manage permissions"** link/button thakbe — click koro

**Service account dekhachhe na?** Wrong GCP project link kora hoye thakte pare. Page refresh koro, ba 1-2 minute wait koro.

**Part C — Permissions set koro:**

9. Click korar por permissions page khulbe — dui level er permission thake:

   **Account permissions (shob app er jonno):**
   - "Financial data" section e 2ta checkbox khujho:
     - ✅ **"View financial data, orders, and cancellation survey responses"** — purchase/subscription data read korar jonno
     - ✅ **"Manage orders and subscriptions"** — purchase acknowledge, refund, subscription manage korar jonno
   - Baki checkboxes (App information, Store presence, etc.) dorkar nai — uncheck rekho

   **App permissions (specific app er jonno — optional):**
   - Niche **"Add app"** section thakbe — chaile specific app select kore only sei app er jonno permission dite paro
   - Shob app e access dite chaile account-level permission e enough, app-level skip koro

10. Click **"Invite user"** ba **"Save changes"**
11. Service account er jonno kono email accept step nai — instantly effect hobe

**Part D — Verify koro:**

12. **Setup** → **API access** page e fire gele service account ta "Access granted" dekhabe
13. **Users and permissions** page e o service account email ta user list e dekhbe

**⚠️ CRITICAL: 24-48 hour wait!**
Permissions grant korar por API call immediately kaj na-o korte pare. Google er system e propagation delay ache — **24-48 hours wait koro** tarpor API test koro. Ei delay ta well-known issue, Google er documentation e o mention ache.

#### Step 7 — Enable Cloud Pub/Sub API + create topic
1. GCP Console → **APIs & Services** → **Library** → search **"Cloud Pub/Sub API"** → **Enable** (if not already)
2. GCP Console → left sidebar: **Pub/Sub** → **Topics** (or search "Pub/Sub" in top bar)
3. Click **Create topic**
4. Topic ID: `play-rtdn` → **Create**

#### Step 8 — Grant publish permission to Google Play
1. GCP Console → **Pub/Sub** → **Topics** → click your `play-rtdn` topic
2. In the info panel, click **Permissions** tab → **Add Principal**
3. New principal: `google-play-developer-notifications@system.gserviceaccount.com`
4. Role: **Pub/Sub Publisher**
5. Click **Save**

#### Step 9 — Create a Push subscription
1. GCP Console → **Pub/Sub** → **Subscriptions** → **Create subscription**
2. Subscription ID: e.g. `play-rtdn-push`
3. Select topic: `play-rtdn`
4. Delivery type: **Push**
5. Endpoint URL: `https://<your-domain>/api/v1/subscription/google/webhook`
6. Check **Enable authentication**
7. Select a service account for signing push JWTs (can be the same service account from Step 5)
8. Audience: paste the same webhook URL
9. Click **Create**

#### Step 10 — Configure RTDN in Play Console
1. Play Console → select your app
2. Left sidebar: **Monetize with Play** → **Monetization setup**
3. Scroll to **Real-time developer notifications** section
4. Enable notifications
5. Paste the full topic name: `projects/YOUR_PROJECT_ID/topics/play-rtdn`
6. Click **Save changes**
7. Click **Send test notification** — your server should respond 200

### Google environment variables

Add to `.env`:

```bash
GOOGLE_PLAY_PACKAGE_NAME=com.yourcompany.tbsosick
GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=./secrets/google-service-account.json

# Pub/Sub push verification (recommended in production)
GOOGLE_PLAY_PUBSUB_AUDIENCE=https://<your-domain>/api/v1/subscription/google/webhook
GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL=your-pubsub-pusher@your-project.iam.gserviceaccount.com
```

If `GOOGLE_PLAY_PUBSUB_AUDIENCE` is empty, JWT verification is **skipped** with a warning — only do this in dev.

### Notification type → local action

| RTDN code | Type | Local action |
|---|---|---|
| 1 | `SUBSCRIPTION_RECOVERED` | `ACTIVE`, refresh `currentPeriodEnd`, clear grace |
| 2 | `SUBSCRIPTION_RENEWED` | `ACTIVE`, extend `currentPeriodEnd` |
| 4 | `SUBSCRIPTION_PURCHASED` | `ACTIVE`, set plan + `currentPeriodEnd` |
| 7 | `SUBSCRIPTION_RESTARTED` | `ACTIVE`, clear cancel/grace |
| 6 | `SUBSCRIPTION_IN_GRACE_PERIOD` | `PAST_DUE` (keep access) |
| 5 | `SUBSCRIPTION_ON_HOLD` | `PAST_DUE` (Google account hold) |
| 3 | `SUBSCRIPTION_CANCELED` | `autoRenewing: false`, set `canceledAt` (user keeps access until expiry) |
| 13 | `SUBSCRIPTION_EXPIRED` | `INACTIVE`, plan → `FREE` |
| 12 | `SUBSCRIPTION_REVOKED` | `CANCELED`, plan → `FREE`, immediate revoke |
| 10 | `SUBSCRIPTION_PAUSED` | `INACTIVE` |
| Others (8/9/11/20) | Logged, no state change | |

After every notification, the webhook **re-fetches the authoritative state** from `subscriptionsv2.get()` rather than trusting the notification body alone — this matches Google's recommendation.

### Idempotency

Each Pub/Sub message has a unique `messageId`. We persist the latest seen ID under `metadata.lastGoogleMessageId` and skip duplicates.

---

## FAQ

### Why not use `verifyReceipt` (the legacy Apple endpoint)?

Apple officially deprecated `/verifyReceipt` in 2023. The modern approach is:
- StoreKit 2 on the client (iOS 15+)
- App Store Server API on the server
- JWS-signed transactions and notifications

Our implementation uses this modern stack. The legacy `receipt-data` format doesn't even exist in StoreKit 2.

### Why raw body for the webhook?

Apple's JWS signature is computed over the **original raw bytes** of the request body. Any parsing/reformatting (whitespace changes, field reordering) will invalidate the signature. The `express.raw()` middleware preserves bytes exactly as received, which the controller then JSON.parse manually to extract `signedPayload`.

### Why lazy-initialize the verifier?

So the server can boot even when Apple credentials are not yet configured. Useful during development and for graceful degradation. Only when an actual verify/webhook endpoint is hit do we require the certificates.

### Why grace period keeps access?

Apple's grace period (up to 16 days) is when Apple retries failed billing. The user is legitimate — just had a temporary card issue. Industry standard is to keep access during this time. Revoking immediately would create a poor user experience and confuse users whose cards just expired.

### Why refund immediately revokes?

Refunds are intentional actions (either by the user or by Apple support). Unlike grace period, there's no expectation of continued access. Per product decision in this project, refunds trigger immediate plan revocation (set to FREE).

### What about Enterprise tier?

Enterprise is the highest paid tier ($9.99/mo, $5.99/mo billed yearly), sold through Apple/Google stores like the Premium tier. It follows the same purchase → verify → webhook flow. The `plan.mapper.ts` already maps `enterprise_monthly` and `enterprise_yearly` product IDs to `SUBSCRIPTION_PLAN.ENTERPRISE`. No admin assignment needed — users purchase it directly from the store.

### How do I check if a user is premium in another module?

```typescript
import { isUserPremium } from '../subscription/helpers/entitlement';

// In your controller:
const hasPremium = await isUserPremium(req.user.id);
if (!hasPremium) {
  throw new ApiError(httpStatus.FORBIDDEN, 'Premium subscription required');
}
```

Or get the full entitlement object:
```typescript
import { getUserEntitlement } from '../subscription/helpers/entitlement';

const ent = await getUserEntitlement(userId);
// ent.plan, ent.status, ent.isActive, ent.isPremium, ent.isEnterprise,
// ent.currentPeriodEnd, ent.gracePeriodEndsAt
```

### How do I test locally without Apple sandbox?

You can't fully test without sandbox, because the `SignedDataVerifier` requires real Apple-signed payloads. Options:
1. Use a physical iPhone with sandbox account (recommended)
2. Unit test the state machine logic (`buildUpdatesForNotification`) with mock decoded transactions — bypasses crypto verification
3. Temporarily mock `getAppleVerifier()` in tests

---

## Summary

This module provides production-grade Apple IAP verification following Apple's current best practices (StoreKit 2, App Store Server API v2, Server Notifications V2). All security fundamentals are in place: cryptographic verification, fraud prevention via unique indexes, idempotent webhook handling, grace period support, and immediate refund revocation.

**Ready for:**
- Apple sandbox testing (once `.env` is filled and certs/keys are placed)
- Google Play sandbox testing (once service account + Pub/Sub are configured)
- Production deployment (once Apple Developer account + Google Play Console are set up and webhook URLs are configured)
