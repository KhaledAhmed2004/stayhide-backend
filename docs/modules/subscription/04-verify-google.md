# 04. Verify Google Subscription
 
```http
POST /subscriptions/google/verify
Content-Type: application/json
Auth: BROTHER, SISTER, ADMIN, SUPER_ADMIN
```
 
> Android app theke purchase verify korar jonno ei endpoint use kora hoy. Google Play Billing Client theke pawa `purchaseToken` ebong `productId` pathate hobe.
 
## Request Body
 
| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `purchaseToken` | `string` | ✅ | Google Play purchase token | `gpk_...` |
| `productId` | `string` | ✅ | Product identifier | `premium_monthly` |
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `verifyGooglePurchaseController`
- **Service**: `subscription.service.ts` — `verifyGooglePurchase`
 
## Responses
 
### Scenario: Success (200)
 
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Google subscription verified successfully",
  "data": {
    "plan": "PREMIUM",
    "status": "active",
    "platform": "google",
    "currentPeriodEnd": "2026-06-12T10:00:00.000Z"
  }
}
```
