# 02. Verify Apple Subscription
 
```http
POST /subscriptions/apple/verify
Content-Type: application/json
Auth: BROTHER, SISTER, ADMIN, SUPER_ADMIN
```
 
> iOS app theke purchase transaction verify korar jonno ei endpoint use kora hoy. Apple StoreKit theke pawa `signedTransactionInfo` pathate hobe.
 
## Request Body
 
| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `signedTransactionInfo` | `string` | ✅ | Apple's JWS signed transaction info | `eyJhbGciOiJFUzI1NiIs...` |
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `verifyApplePurchaseController`
- **Service**: `subscription.service.ts` — `verifyApplePurchase`
 
## Responses
 
### Scenario: Success (200)
 
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Apple subscription verified successfully",
  "data": {
    "plan": "PREMIUM",
    "status": "active",
    "platform": "apple",
    "currentPeriodEnd": "2026-06-12T10:00:00.000Z"
  }
}
```
