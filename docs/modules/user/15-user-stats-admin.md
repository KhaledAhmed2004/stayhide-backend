# 15. User Metrics (Admin)

```http
GET /users/metrics
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Aggregated growth metrics for the admin dashboard.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserMetrics`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserMetricsFromDB`

### Business Logic (`getUserMetricsFromDB`)
1. **Metric Calculation**: Calculates current month's totals for users (excluding `SUPER_ADMIN` role):
    - `totalUsers`: All non-admin users.
    - `activeUsers`: Non-admin users with status `ACTIVE`.
    - `pendingUsers`: Non-admin users with status `PENDING`.
    - `suspendedUsers`: Non-admin users with status `SUSPENDED`.
2. **Growth Analysis**: Uses [AggregationBuilder.calculateGrowth()](file:///src/app/modules/builder/AggregationBuilder.ts) to compare current month data with the previous month.
3. **Trend Detection**: Determines `direction` (`up`, `down`, or `neutral`) based on the calculated percentage change.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User metrics retrieved",
  "data": {
    "meta": { "comparisonPeriod": "month" },
    "totalUsers": { "value": 250, "changePct": 25, "direction": "up" },
    "activeUsers": { "value": 198, "changePct": 10, "direction": "up" },
    "pendingUsers": { "value": 32, "changePct": 5, "direction": "down" },
    "suspendedUsers": { "value": 20, "changePct": 0, "direction": "neutral" }
  }
}
```
