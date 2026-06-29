# 06. Choose Free Plan
 
```http
POST /subscriptions/choose/free
Auth: BROTHER, SISTER, ADMIN, SUPER_ADMIN
```
 
> User manually FREE plan-e switch korar jonno ei endpoint use korbe (jodi tar kono active store subscription na thake).
 
## Implementation
 
- **Route**: `subscription.route.ts`
- **Controller**: `subscription.controller.ts` — `chooseFreePlanController`
- **Service**: `subscription.service.ts` — `setFreePlan`
 
## Responses
 
### Scenario: Success (200)
 
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Switched to Free plan successfully",
  "data": {
    "plan": "FREE",
    "status": "active",
    "platform": "admin"
  }
}
```
 
### Scenario: Conflict (409)
 
User-er jodi kono active store (Apple/Google) subscription thake.
 
```json
{
  "success": false,
  "statusCode": 409,
  "message": "You have an active store subscription. Please cancel it through the App Store or Play Store first."
}
```
