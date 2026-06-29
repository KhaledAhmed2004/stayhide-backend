# 14. List Users (Admin)

```http
GET /users
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Lists all users, with search, various filters, and paginated results. Also used for the Approval Queue by filtering with `status=PENDING`.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getAllUserRoles`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getAllUserRolesFromDB`

### Business Logic (`getAllUserRolesFromDB`)
1. **Filtering**: Supports `searchTerm` (name/email), `email`, `role`, `status`, and `isVerified`.
2. **Conditional Field Visibility & PENDING Restriction**:
    - **`status=PENDING` Response**: Includes only `_id`, `name`, `email`, `role`, `verificationImage`, `verificationVideo`, and `createdAt`. Optimized for the admin approval queue.
    - **General Response**: Includes full details including `name`, `email`, `phone`, `status`, `isVerified`, `role`, `profileImage`, `createdAt`, and `updatedAt`.
3. **Pagination & Sorting**: Implements custom aggregation pipeline with `$facet` for data and total count.

## Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `searchTerm` | Name or email regex search | — | `John` |
| `email` | Exact or regex email match | — | `dr.john@example.com` |
| `role` | Filter by role (`SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`) | — | `BROTHER` |
| `status` | Filter by status (`ACTIVE`, `PENDING`, `SUSPENDED`, etc.) | — | `PENDING` |
| `isVerified`| Filter by email verification status | — | `true` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |
| `sortBy` | Field name for sorting | `createdAt` | `createdAt` |
| `sortOrder` | Sort direction (`asc` or `desc`) | `desc` | `desc` |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User list fetched",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 27,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Dr. John Doe",
      "role": "BROTHER",
      "email": "dr.john@example.com",
      "phone": "+123456789",
      "profileImage": "uploads/users/profiles/profile.png",
      "status": "ACTIVE",
      "isVerified": true,
      "createdAt": "2026-03-15T10:30:00.000Z",
      "updatedAt": "2026-03-15T10:30:00.000Z"
    }
  ]
}
```
