# 05. Google Webhook
 
```http
POST /subscriptions/google/webhook
Content-Type: application/json
Auth: None (Verified by Pub/Sub JWT)
```
 
> Google Play Real-Time Developer Notifications (RTDN) handle korar jonno endpoint. Subscription renewal, cancellation ityadi events Google Pub/Sub theke push message hishebe ei endpoint-e ashe.
 
## Request Body
 
Google Pub/Sub specific JSON payload ashe body-te.
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `googleWebhookController`
- **Service**: `subscription.service.ts` — `processGoogleWebhook`
 
## Responses
 
### Scenario: Success (200)
 
`HTTP 200 OK` (Google acknowledge message received)
