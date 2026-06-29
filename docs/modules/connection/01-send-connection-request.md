# 01. Send Connection Request

```http
POST /connections
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows a user to send a connection request to another user. If the request is successful, a pending connection record is created, and the receiver is notified via Socket.IO and Push Notification.

## 1. Business Rules
- **Self-Connect**: Users cannot send requests to themselves.
- **Receiver Status**: The receiver must exist and have an `ACTIVE` status.
- **Pending Limit**: A user can have a maximum of **50** outgoing pending requests at any time to prevent spam.
- **Duplicates**: Only one connection/request can exist between two users at a time.
- **Re-Request Policy**: If a request is rejected or cancelled, the connection record is physically deleted, restoring the relationship state to `NONE`.

## 2. Request Body

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `receiverId` | string | ✅ | The `id` of the user you want to connect with |

```json
{
  "receiverId": "664a1b2c3d4e5f6a7b8c9d1c"
}
```

## 3. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Connection request sent successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d1a",
    "status": "PENDING",
    "receiver": {
      "id": "664a1b2c3d4e5f6a7b8c9d1c",
      "name": "John Doe",
      "profileImage": "/default-avatar.svg"
    }
  }
}
```

### Rate Limited (429)
```json
{
  "success": false,
  "statusCode": 429,
  "message": "You have reached the maximum number of pending requests (50)"
}
```
