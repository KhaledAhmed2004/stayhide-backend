# 17. Update Post

```http
PATCH /groups/posts/:postId
Content-Type: application/json OR multipart/form-data
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Members can edit their own posts with text and optional attachments. This endpoint supports both JSON payloads and `multipart/form-data` file uploads.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post |

## Request Body (JSON Format)

```json
{
  "content": "Updated content: looking forward to the next session!", // Text content of the post
  "attachments": [], // (Optional) List of new attachment URLs (Max 5 total)
  "existingAttachments": [] // (Optional) List of existing attachment URLs to retain
}
```

## Request Body (multipart/form-data Format)

- **`content`** (text): Post content
- **`attachments`** (file, max 5 files): Newly uploaded image, video, audio, or document files.
- **`existingAttachments`** (text): (Optional) A JSON-stringified array of existing attachment URLs that should be retained (e.g. `'["/uploads/images/file.jpg"]')`.

## Request Body Details

| Field | Type | Format | Description |
| :--- | :--- | :--- | :--- |
| `content` | `string` | Text | Text content of the post |
| `attachments` | `array` / `files` | JSON Array or Files | Optional attachment URLs or files to upload (Max 5) |
| `existingAttachments` | `string` | Stringified JSON Array | Optional list of existing attachment URLs to retain |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `updatePost`
- **Service**: `group.service.ts` — `updatePostInDB`

### Business Logic
1. **Owner Only**: Only the post's author can update it.
2. **Attachment Merging**: The `normalizeAttachments` middleware in the route merges `existingAttachments` (retained old URLs) with newly uploaded `attachments` (new file paths) into a single `attachments` array before passing to the controller. This means:
   - To **keep** old attachments, pass them back as `existingAttachments`.
   - To **add** new files, use the `attachments` field (file upload or URL array).
   - To **replace all** attachments, only pass `attachments` without `existingAttachments`.
   - To **remove all** attachments, pass `existingAttachments: []` with no `attachments`.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post updated successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1930",
    "groupId": "60d5ecb86372ad46101f1929",
    "userId": "60d5ecb86372ad46101f1920",
    "content": "Updated content: looking forward to the next session!",
    "attachments": [],
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "2026-05-09T10:45:00.000Z",
    "updatedAt": "2026-05-10T11:00:00.000Z"
  }
}
```

### Scenario: Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You can only update your own posts"
}
```
