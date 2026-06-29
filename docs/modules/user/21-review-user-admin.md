# 21. Review User (Admin)

```http
PATCH /users/:userId/review
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Unified endpoint for approving or rejecting a pending user account.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `updateUserReview`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `updateUserStatusInDB`

### Business Logic
1.  **Validation**: Ensures the user exists and is currently in `PENDING` status.
2.  **Verification Check**: Rejects the review if the user has not verified their email via OTP.
3.  **Approve (`status: ACTIVE`)**:
    - Updates user status to `ACTIVE`.
    - User can now log in.
4.  **Reject (`status: REJECTED`)**:
    - Updates user status to `REJECTED`.
    - Saves the `reason` to `rejectionReason`.
    - Generates a one-time `reverification.token`.
    - Sends an email to the user with the rejection reason and a link/token to re-submit documents.

## Request Body

```json
{
  "status": "REJECTED",
  "reason": "Profile image is not a clear photo of a person."
}
```

## Request Body Details (multipart/form-data)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | Yes | Either `ACTIVE` or `REJECTED`. |
| `reason` | `string` | Conditional | Required if `status` is `REJECTED`. |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User review status updated",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "status": "REJECTED",
    "rejectionReason": "Profile image is not a clear photo of a person."
  }
}
```

### Scenario: Missing Reason for Rejection (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Reason is required when status is REJECTED"
}
```

### Scenario: Not Verified (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User must verify OTP before admin approval"
}
```
