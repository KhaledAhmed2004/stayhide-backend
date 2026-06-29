# 22. List User Profiles (Community Discovery)

```http
GET /users/profiles?latitude=23.8103&longitude=90.4125
Auth: Bearer {{accessToken}} (BROTHER, SISTER, JUMMAH)
```

> Lists public profiles of users within the same community. Brothers see other Brothers, Sisters see other Sisters, and Jummah users see other Jummah users. Only active users are listed. Includes distance calculation if coordinates are provided. **Each profile item includes a `connectionStatus` flag so the frontend can conditionally render the Connect button.**

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserProfiles`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserProfilesFromDB`

### Business Logic (`getUserProfilesFromDB`)
1. **Server-Side Scoping**: Automatically filters users by the requesting user's `role` (BROTHER/SISTER/JUMMAH) and ensures only `ACTIVE` profiles are visible. Self is excluded.
2. **High-Performance Proximity**: Uses MongoDB's native `$geoNear` aggregation for industry-standard proximity sorting.
3. **Injected Distance**: If `latitude` and `longitude` are provided, the system **always** calculates and injects `distanceInKm` directly at the database level, regardless of the `filter` used.
4. **Flexible Sorting**:
    - If `filter=nearby-me` (and coordinates provided), users are sorted by distance (closest first).
    - Otherwise (default or `filter=new-reverts`), users are sorted by `createdAt` (newest first), even if distance was calculated.
5. **Field Projection (Privacy)**: Returns specific public fields: `_id`, `name`, `profileImage`, `age`, `revertDate`, `distanceInKm`.
6. **Connection Status Enrichment (Single-Pass `$lookup`)**: For every profile returned, the pipeline performs a server-side `$lookup` against the `connections` collection to embed `connectionStatus`, `connectionId`, and `chatId` — **no N+1 queries, one aggregation round-trip**.

### `connectionStatus` Values

| `connectionStatus` | Meaning | Suggested Frontend Action |
| :--- | :--- | :--- |
| `NONE` | No connection relationship exists | Show **Connect** button → `POST /connections` |
| `PENDING_SENT` | I have sent a request to this user | Show **Requested** (disabled) or **Cancel** button |
| `PENDING_RECEIVED` | This user has sent a request to me | Show **Accept/Reject** buttons |
| `CONNECTED` | Both users are connected | Show **Message** button (link to `chatId`) |

> `connectionId` is `null` when `connectionStatus` is `NONE`, otherwise it is the `_id` of the `Connection` document. `chatId` is provided only when status is `CONNECTED`.

## Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `searchTerm` | Search by name | — | `John` |
| `latitude` | Requester's current latitude (required for `nearby-me` filter) | — | `23.8103` |
| `longitude` | Requester's current longitude (required for `nearby-me` filter) | — | `90.4125` |
| `filter` | Use `new-reverts` for newest members or `nearby-me` for location-based sorting | `new-reverts` | `nearby-me` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profiles fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Sarah Smith",
      "age": 28,
      "revertDate": "2020-05-15T00:00:00.000Z",
      "distanceInKm": 12.45,
      "profileImage": "/uploads/users/profiles/sarah.png",
      "connectionStatus": "NONE",
      "connectionId": null
    },
    {
      "id": "664a1b2c3d4e5f6a7b8c9d1f",
      "name": "Fatima Al-Rashid",
      "age": 32,
      "revertDate": "2018-11-03T00:00:00.000Z",
      "distanceInKm": 3.87,
      "profileImage": "/uploads/users/profiles/fatima.png",
      "connectionStatus": "PENDING_SENT",
      "connectionId": "665aaa111bbb222ccc333ddd"
    },
    {
      "id": "664a1b2c3d4e5f6a7b8c9d2g",
      "name": "Amina Yusuf",
      "age": 25,
      "revertDate": "2022-03-20T00:00:00.000Z",
      "distanceInKm": 8.10,
      "profileImage": "/uploads/users/profiles/amina.png",
      "connectionStatus": "CONNECTED",
      "connectionId": "665bbb444ccc555ddd666eee",
      "chatId": "665ccc777ddd888eee999fff"
    }
  ]
}
```

### Scenario: Unauthorized (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "You are not authorized"
}
```
