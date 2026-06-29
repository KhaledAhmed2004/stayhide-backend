# 18. Delete User (Admin)

```http
DELETE /users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Permanent hard removal of a user account.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `deleteUser`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `deleteUserPermanentlyFromDB`

### Business Logic (`deleteUserPermanentlyFromDB`)
1. **Lookup**: Finds the user by ID.
2. **Deletion**: Performs a `findByIdAndDelete`.
3. **Response**: Returns the deleted user's ID.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User deleted permanently",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e"
  }
}
```
