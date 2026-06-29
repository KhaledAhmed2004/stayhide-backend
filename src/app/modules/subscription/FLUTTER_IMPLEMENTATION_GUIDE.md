# Flutter Implementation Guide: Subscriptions

This guide provides the necessary technical details for the Flutter developer to integrate Apple In-App Purchases (StoreKit 2) and Google Play Billing with the backend.

---

## 1. Overview

The backend uses a **server-side verification** model. The Flutter app is responsible for:
1.  Initiating the purchase flow using the store's native UI.
2.  Capturing the raw purchase data (JWS for Apple, Purchase Token for Google).
3.  Sending that data to the backend for cryptographic verification and entitlement granting.
4.  Checking the backend for the user's current subscription status.

---

## 2. Base Configuration

- **Base URL:** `/api/v1/subscription`
- **Authentication:** All client-side endpoints (except webhooks) require the standard `Authorization: Bearer <JWT>` header.

---

## 3. iOS Implementation (Apple StoreKit 2)

When a purchase is completed on iOS, StoreKit 2 returns a `signedTransactionInfo`. This is a JWS (JSON Web Signature) string.

### Endpoint: Verify Apple Purchase
`POST /apple/verify`

**Request Body:**
```json
{
  "signedTransactionInfo": "eyJhbG..." 
}
```

**Flutter Example (using `in_app_purchase`):**
```dart
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';

// Inside your purchase listener
if (purchaseDetails is AppStorePurchaseDetails) {
  final String signedTransactionInfo = purchaseDetails.verificationData.serverVerificationData;
  
  // Call Backend
  final response = await http.post(
    Uri.parse('$baseUrl/subscription/apple/verify'),
    headers: {
      'Authorization': 'Bearer $userJwt',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'signedTransactionInfo': signedTransactionInfo,
    }),
  );
  
  if (response.statusCode == 200) {
    // Success: Refresh local user state
  }
}
```

---

## 4. Android Implementation (Google Play Billing)

When a purchase is completed on Android, you get a `purchaseToken` and a `productId`.

### Endpoint: Verify Google Purchase
`POST /google/verify`

**Request Body:**
```json
{
  "purchaseToken": "gplay_token_abc123...",
  "productId": "premium_monthly"
}
```

**Flutter Example (using `in_app_purchase`):**
```dart
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

// Inside your purchase listener
if (purchaseDetails is GooglePlayPurchaseDetails) {
  final String purchaseToken = purchaseDetails.verificationData.serverVerificationData;
  final String productId = purchaseDetails.productID;

  // Call Backend
  final response = await http.post(
    Uri.parse('$baseUrl/subscription/google/verify'),
    headers: {
      'Authorization': 'Bearer $userJwt',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'purchaseToken': purchaseToken,
      'productId': productId,
    }),
  );

  if (response.statusCode == 200) {
    // Success: Refresh local user state
  }
}
```

---

## 5. Checking Subscription Status

The Flutter app should check the subscription status on **app launch** and after every **successful verification**.

### Endpoint: Get My Subscription
`GET /me`

**Response Body (Success):**
```json
{
  "success": true,
  "data": {
    "plan": "PREMIUM", // "FREE" | "PREMIUM" | "ENTERPRISE"
    "status": "active", // "active" | "trialing" | "past_due" | "canceled" | "inactive"
    "platform": "apple", // "apple" | "google" | "admin"
    "currentPeriodEnd": "2024-06-07T10:00:00.000Z",
    "autoRenewing": true
  }
}
```

**Logic Note:** 
- If `plan == "FREE"`, the user is not a subscriber.
- If `plan != "FREE"` AND `status == "active"` (or `trialing`), the user is a subscriber.

---

## 6. Known Product IDs

Use these IDs in your `StoreConfig` or equivalent:

- **Premium Monthly:** `premium_monthly`
- **Premium Yearly:** `premium_yearly`
- **Enterprise Monthly:** `enterprise_monthly`

---

## 7. Best Practices for Flutter

1.  **Pending Purchases:** Always handle `PurchaseStatus.pending`. Do not call the backend until the status is `PurchaseStatus.purchased`.
2.  **Restore Purchases:** If a user taps "Restore Purchases", iterate through the `restored` transactions and send each one to the `/verify` endpoint. The backend handles idempotency automatically.
3.  **App Launch:** Always call `GET /me` when the app starts to ensure the local UI reflects the latest state (especially if a subscription expired or was refunded while the app was closed).
4.  **Error Handling:**
    - `409 Conflict`: This transaction is already linked to another account. Show a message to the user.
    - `400 Bad Request`: Invalid transaction/token or expired.
