# 16. Get User (Admin Only)

```http
GET /users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Retrieves full user details by ID. This endpoint is strictly for Administrators. Regular users should use `/users/:userId/public` or `/users/me`.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserById`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserByIdFromDB`

### Business Logic
1. **Retrieval**: Fetches all user fields except highly sensitive security tokens (`password`, `authentication`, `tokenVersion`, etc.).
2. **Access Control**: Restricted to `SUPER_ADMIN` in the route layer.
3. **Data Flattening**: Flattens `location` object into top-level fields for dashboard consistency.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User data retrieved",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "BROTHER",
    "revertDate": "2026-05-19T23:41:20.521Z",
    "dateOfBirth": "1990-01-01T00:00:00.000Z",
    "profileImage": "/default-avatar.svg",
    "verificationImage": "https://example.com/img.jpg",
    "verificationVideo": "https://example.com/vid.mp4",
    "interests": [],
    "status": "ACTIVE",
    "isVerified": true,
    "subscriptionTier": "FREE",
    "subscriptionStatus": "NONE",
    "createdAt": "2026-05-19T23:41:20.522Z",
    "updatedAt": "2026-05-19T23:41:20.522Z"
  }
}
```
