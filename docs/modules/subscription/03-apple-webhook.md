# 03. Apple Webhook
 
```http
POST /subscriptions/apple/webhook
Content-Type: application/json
Auth: None (Verified by Apple Signature)
```
 
> Apple App Store Server Notifications V2 handle korar jonno endpoint. Subscription renewal, cancellation, grace period ityadi events Apple theke direct ei endpoint-e ashe.
 
## Request Body
 
Apple pathano specific JWS payload ashe body-te.
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `appleWebhookController`
- **Service**: `subscription.service.ts` — `processAppleWebhook`
 
## Responses
 
### Scenario: Success (200)
 
`HTTP 200 OK` (Apple response paye acknowledges message received)
