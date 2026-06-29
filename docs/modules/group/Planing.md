# Group Management Module Design

## 1. Overview
This module allows admins to create, organize, and manage user groups. Groups are restricted based on user type (Male/Female) and categorized for better organization. Users can join groups and interact with posts inside them.

---

## 2. Data Model (Backend Structure)

### Group Table
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "userType": "Male | Female",
  "categoryId": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Group Members Table
```json
{
  "id": "string",
  "groupId": "string",
  "userId": "string",
  "joinedAt": "datetime",
  "role": "member | admin"
}
```

### Group Posts Table
```json
{
  "id": "string",
  "groupId": "string",
  "userId": "string",
  "content": "string",
  "attachments": ["string"],
  "createdAt": "datetime"
}
```

### Post Comments Table
```json
{
  "id": "string",
  "postId": "string",
  "userId": "string",
  "comment": "string",
  "createdAt": "datetime"
}
```

### Post Likes Table
```json
{
  "id": "string",
  "postId": "string",
  "userId": "string",
  "createdAt": "datetime"
}
```

---

## 3. Admin Module Features

### Group Creation
Admin can create groups with:
* Group Name
* Description
* User Type (Male / Female)
* Category selection

### Group List (Admin Table View)
| Column        | Description         |
| ------------- | ------------------- |
| Group Name    | Title of group      |
| Members Count | Total joined users  |
| Created Date  | Group creation time |
| Description   | Short details       |
| Group Type    | Male / Female       |
| Category      | Assigned category   |

### Admin Capabilities
* Create / Edit / Delete groups
* Assign category
* Control visibility by user type
* View group analytics (members, posts)

---

## 4. Group Page (User Side)

### Access Control
* Users only see groups matching their gender type
* Example:
  * Male users → Only Male groups
  * Female users → Only Female groups

### Group Page Layout
#### 1. Group Header
* Group Name
* Description
* Total Members Count
* Join / Leave Button

#### 2. Group Feed (Posts Section)
Each post includes:
* User info
* Text content
* Attachments (images/files)
* Like button
* Comment section

### 3. Group Actions
#### Join / Leave Group
* User can join or leave anytime
* Membership updated in real-time

#### Post Creation
Users can create posts with:
* Text content
* File/Image attachments

#### Post Interaction
* Like post
* Comment on post

#### Comment Rules
* Comment can be deleted by:
  * Comment owner
  * Admin only

---

## 5. Business Rules
* Users must match group userType to access
* Only members can post/comment
* Group member count updates automatically
* Posts are visible only inside their group
* **Moderation:** Only `SUPER_ADMIN` and post owners can delete posts/comments. `SUPER_ADMIN` has global power to pin posts and kick members.
* **Pinned Posts:** Handled via double-sorting in the feed (`isPinned: -1, createdAt: -1`) to ensure relevance while maintaining a single API.

---

## 6. Phase 2 Enhancements (Implemented)
* **Pinned Posts:** `SUPER_ADMIN` can pin important posts to the top of the feed.
* **Member Management:** `SUPER_ADMIN` can kick members from a group.
* **Visual Identity:** Added `coverImage` support for groups.
* **Comment Discovery:** Added a dedicated API to fetch comments for a post.

---

## 7. API Workflow & Lifecycle

1. **Group Setup**: `SUPER_ADMIN` creates a group. They set the `userType` (Brother/Sister) and upload a `coverImage`.
2. **Joining**: Users join if their gender matches the group's `userType`. `memberCount` increases automatically.
3. **Posting**: Members create posts with text and up to 5 attachments.
4. **Browsing (The Feed)**: When users view the feed:
    - **Pinned posts** (selected by Admin) appear at the very top.
    - Regular posts follow in newest-first order.
    - Search can be used to find specific content within the feed.
5. **Engagement**:
    - Members can **Like** posts. A 15-minute "suppression" window prevents notification spam to the post owner.
    - Members can **Comment** on posts. All comments can be fetched using a dedicated GET API.
6. **Moderation**: `SUPER_ADMIN` can **Pin** important posts, **Delete** any post/comment, or **Kick** members who break rules.
7. **Auto-Cleanup**: If a user is deleted from the system, they are automatically removed from their groups, and the `memberCount` is decremented.


