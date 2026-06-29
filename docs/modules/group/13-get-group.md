# 13. Get Group Details

```http
GET /groups/:groupId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Fetches metadata for a single group, including a flag indicating if the requesting user is a member.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group to fetch |

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Group fetched successfully",
  "data": {
    "_id": "65f...",
    "name": "Group Name",
    "description": "...",
    "userType": "BROTHER",
    "category": "Education",
    "memberCount": 150,
    "isMember": true
  }
}
```
