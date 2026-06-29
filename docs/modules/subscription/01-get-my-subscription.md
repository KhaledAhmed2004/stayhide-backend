# 01. Get My Subscription
 
```http
GET /subscriptions/me
Auth: BROTHER, SISTER, ADMIN, SUPER_ADMIN
```
 
> User tar nijer current subscription status, plan, expiry date ityadi dekhbar jonno ei endpoint call korbe.
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `getMySubscriptionController`
- **Service**: `subscription.service.ts` — `getMySubscription`
 
## Responses
 
### Scenario: Success (200)
 
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Subscription retrieved successfully",
  "data": {
    "_id": "60d5ecb86372ad46101f1930",
    "userId": "60d5ecb86372ad46101f1931",
    "plan": "PREMIUM",
    "status": "active",
    "platform": "apple",
    "currentPeriodEnd": "2026-06-12T10:00:00.000Z",
    "updatedAt": "2026-05-12T10:00:00.000Z"
  }
}
```
