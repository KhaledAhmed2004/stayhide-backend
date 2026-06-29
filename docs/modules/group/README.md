# Group Management Module APIs

> **Section**: Backend API specifications for the Group Management module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Group Discovery — Find and join groups based on gender
> - App - Group Feed — Interact with posts, likes, and comments
> - Admin Dashboard - Group Management — Create and moderate groups

---

## Database Design

### 1. Group Model (`groups`)
Stores metadata for groups.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `name` | String | ✅ | Title of the group |
| `description` | String | ✅ | Short details |
| `userType` | String | ✅ | `BROTHER` or `SISTER` |
| `category` | String | ✅ | Name of the category |
| `coverImage` | String | ❌ | Optional cover image URL |
| `memberCount` | Number | ✅ | Total joined users (Auto-updated) |

### 2. Group Member Model (`group-members`)
Tracks user membership in groups.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `groupId` | ObjectId | ✅ | Reference to group |
| `userId` | ObjectId | ✅ | Reference to user |
| `role` | String | ✅ | `member` or `admin` |
| `joinedAt` | Date | ✅ | When the user joined |

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/groups` | Admin | **Done**: Create a new group | [01-create-group.md](./01-create-group.md) |
| 02 | GET | `/groups` | All | **Done**: List groups (filtered by role, includes `isMember`) | [02-list-groups.md](./02-list-groups.md) |
| 03 | GET | `/groups/:groupId` | All | **Done**: Get group details (includes `isMember`) | [13-get-group.md](./13-get-group.md) |
| 04 | PATCH | `/groups/:groupId` | Admin | **Done**: Update a group | [11-update-group.md](./11-update-group.md) |
| 05 | DELETE | `/groups/:groupId` | Admin | **Done**: Delete a group | [12-delete-group.md](./12-delete-group.md) |
| 06 | POST | `/groups/:groupId/join` | All | **Done**: Join a group | [03-join-group.md](./03-join-group.md) |
| 07 | POST | `/groups/:groupId/leave`| All | **Done**: Leave a group | [10-leave-group.md](./10-leave-group.md) |
| 08 | DELETE | `/groups/:groupId/members/:userId` | Admin | **Done**: Kick a member from a group | [15-kick-member.md](./15-kick-member.md) |
| 09 | POST | `/groups/:groupId/posts` | Members | **Done**: Create a post (JSON or multipart) | [04-create-post.md](./04-create-post.md) |
| 10 | PATCH | `/groups/posts/:postId` | Author | **Done**: Update a post (JSON or multipart, merges attachments) | [04-create-post.md](./04-create-post.md) |
| 11 | DELETE | `/groups/posts/:postId` | Author/Admin | **Done**: Delete a post | [08-delete-post.md](./08-delete-post.md) |
| 12 | PATCH | `/groups/posts/:postId/pin` | Admin | **Done**: Pin/Unpin a post | [16-pin-post.md](./16-pin-post.md) |
| 13 | GET | `/groups/:groupId/posts` | Members | **Done**: Get group feed (pinned first, then newest, includes `isLiked`) | [05-get-feed.md](./05-get-feed.md) |
| 14 | POST | `/groups/posts/:postId/like` | Members | **Done**: Like/Unlike a post | [06-like-post.md](./06-like-post.md) |
| 15 | POST | `/groups/posts/:postId/comments`| Members | **Done**: Add a comment or reply | [07-add-comment.md](./07-add-comment.md) |
| 16 | GET | `/groups/posts/:postId/comments` | Members | **Done**: Get comments for a post | [14-get-comments.md](./14-get-comments.md) |
| 17 | PATCH | `/groups/comments/:commentId` | Author | **Done**: Update a comment | [07-add-comment.md](./07-add-comment.md) |
| 18 | DELETE | `/groups/comments/:commentId` | Author/Admin | **Done**: Delete a comment (cascades replies) | [09-delete-comment.md](./09-delete-comment.md) |

> **Note**: `SUPER_ADMIN` has implicit access to all groups and can perform any action without joining. `BROTHER` and `SISTER` are restricted to groups matching their role.

