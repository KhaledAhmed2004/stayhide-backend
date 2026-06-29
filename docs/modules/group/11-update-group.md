# 11. Update Group

```http
PATCH /groups/:groupId
Auth: Bearer {{accessToken}} (ADMIN, SUPER_ADMIN)
```

> Updates the metadata of an existing group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group to update |

## Request Body

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `name` | `string` | ❌ | New title of the group |
| `description` | `string` | ❌ | New short details |
| `userType` | `string` | ❌ | `BROTHER` or `SISTER` |
| `category` | `string` | ❌ | New category name |
| `coverImage` | `string` | ❌ | New URL for the group cover image |

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Group updated successfully",
  "data": {
    "_id": "65f...",
    "name": "Updated Name",
    ...
  }
}
```
