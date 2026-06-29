# 17. Update User & Status (Admin)

```http
PATCH /users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Update any user field, including their account status (ACTIVE, SUSPENDED, etc.).

## Request Body
```json
{
  "name": "Updated Name",
  "status": "SUSPENDED",
  "role": "BROTHER"
}
```

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `adminUpdateUser`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `updateUserByAdminInDB`

### Business Logic (`updateUserByAdminInDB`)
1. **Validation**: Uses `adminUpdateUserZodSchema` to validate the input body.
2. **Merging Logic**: Unified Update endpoint. Handles partial updates of profile data and state transitions (status, role).
3. **Database Update**: Performs a `findByIdAndUpdate` or `.save()` with side-effects for status flips.

## Field Reference (Admin Specific)
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | The user's full legal name. |
| `email` | `string` | Primary contact and login email. Must be globally unique. |
| `dateOfBirth` | `string` | User's birth date in Full ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`). |
| `revertDate` | `string` | The date the user converted to Islam in Full ISO 8601 format. |
| `status` | `string` | Account lifecycle state. Possible values: `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `INACTIVE`, `RESTRICTED`, `DELETED`. |
| `role` | `string` | Access level. Possible values: `SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`. |
| `rejectionReason` | `string` | Required if setting status to `REJECTED`. This reason is sent to the user via email. |
| `aboutMe` | `string` | A short professional or personal biography. |
| `revertStory` | `string` | The user's personal story of converting to Islam. |
| `interests` | `array` | Array of strings representing user interests (tags). |
| `location` | `object` | Nested object with `country`, `city`, `latitude`, and `longitude`. |

## Side Effects on `status` Transitions
The system applies status-flip side effects (e.g., bumping `tokenVersion` for lockouts, issuing re-verify tokens for `REJECTED`). See [system-concepts.md](../../system-concepts.md) for policy details.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "updatedAt": "2026-05-05T10:00:00.000Z"
  }
}
```
