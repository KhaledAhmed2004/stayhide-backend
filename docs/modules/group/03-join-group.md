# 03. Join Group

```http
POST /groups/:groupId/join
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Allows a user to join a group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group to join |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `joinGroup`
- **Service**: `group.service.ts` — `joinGroupInDB`

### Business Logic
1. **Transaction**: Uses a database session to atomically create the membership and increment the `memberCount` in the Group model.
2. **Validation**: Checks if the user is already a member.
3. **Role Restriction**:
    - `BROTHER` can only join `BROTHER` groups.
    - `SISTER` can only join `SISTER` groups.
    - **`SUPER_ADMIN`**: Can join any group (bypasses role check).

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Joined group successfully",
  "data": {
    "groupId": "60d5ecb86372ad46101f1929",
    "userId": "60d5ecb86372ad46101f1920",
    "role": "member",
    "joinedAt": "2026-05-09T10:30:00.000Z"
  }
}
```

### Scenario: Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "This group is only for BROTHERs. You are a SISTER."
}
```
