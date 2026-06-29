# Notification Module — Design Audit

> **Purpose:** This document records every design decision made for the notification system —
> what was chosen, what was rejected, and why. It exists so any developer can understand
> the reasoning behind the current shape without having to reverse-engineer it from code.
>
> **Last updated:** May 2026  
> **Status:** Production-ready (v1)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [API Response Shape — Final Design](#2-api-response-shape--final-design)
3. [Field-by-Field Design Decisions](#3-field-by-field-design-decisions)
   - [id](#31-id)
   - [type](#32-type)
   - [schemaVersion](#33-schemaversion)
   - [isRead + readAt](#34-isread--readat)
   - [actor](#35-actor)
   - [subject](#36-subject)
   - [actions](#37-actions)
4. [What Was Rejected and Why](#4-what-was-rejected-and-why)
5. [Legacy Compatibility Strategy](#5-legacy-compatibility-strategy)
6. [Notification Types Reference](#6-notification-types-reference)
7. [Write-Time vs Read-Time Data Strategy](#7-write-time-vs-read-time-data-strategy)
8. [Industry Comparison](#8-industry-comparison)
9. [Pagination Strategy](#9-pagination-strategy)
10. [Future Considerations](#10-future-considerations)

---

## 1. System Overview

The notification system handles two categories of notifications:

**A. Typed notifications (schemaVersion: 1)**  
Written by `sendNotifications()` in `notificationsHelper.ts`. Used for user-to-user events
like connection requests and acceptances. These store a rich `metadata` payload at write time
so the API response is zero-join — no extra DB lookups at read time.

**B. Legacy flat notifications (schemaVersion: 0)**  
Written by `NotificationBuilder` via `database.channel`. Used for broadcast events like
new content, khutbah, post likes, comments. These store only `title`, `text`, `resourceType`,
`resourceId`. The formatter falls back to a flat shape for these.

Both types are served by the same `GET /api/v1/notifications/me` endpoint. The formatter
in `notification.service.ts` branches on `schemaVersion` to produce the correct shape.

---

## 2. API Response Shape — Final Design

### CONNECTION_REQUEST (received by the target user)

```json
{
  "id": "6a0e24048249918a84a28103",
  "type": "CONNECTION_REQUEST",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-05-20T21:13:40.336Z",
  "schemaVersion": 1,
  "actor": {
    "id": "6a0e24038249918a84a280b9",
    "name": "Khaled Ahmed",
    "profileImage": "/default-avatar.svg"
  },
  "subject": {
    "type": "Connection",
    "id": "6a0e24038249918a84a280ff"
  },
  "actions": [
    { "type": "ACCEPT" },
    { "type": "REJECT" },
    { "type": "VIEW_PROFILE" }
  ]
}
```

### CONNECTION_ACCEPTED (received by the original sender)

```json
{
  "id": "6a0e24058249918a84a28200",
  "type": "CONNECTION_ACCEPTED",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-05-20T21:14:10.112Z",
  "schemaVersion": 1,
  "actor": {
    "id": "6a0e24038249918a84a280cc",
    "name": "Omar Faruk",
    "profileImage": "/default-avatar.svg"
  },
  "subject": {
    "type": "Connection",
    "id": "6a0e24038249918a84a280ff",
    "chatId": "6a0e24058249918a84a28199"
  },
  "actions": [
    { "type": "OPEN_CHAT" },
    { "type": "VIEW_PROFILE" }
  ]
}
```

### Legacy flat notification (schemaVersion: 0, backward compatible)

```json
{
  "id": "6a0e...",
  "type": "POST_LIKED",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-05-20T21:00:00.000Z",
  "schemaVersion": 0,
  "title": "New Like",
  "text": "Someone liked your post.",
  "subject": { "type": "GroupPost", "id": "6a0e..." },
  "actor": null,
  "actions": []
}
```

---

## 3. Field-by-Field Design Decisions

### 3.1 `id`

**Decision:** Standard MongoDB ObjectId, serialized as string.  
**Why:** Stable, unique, sortable by creation time. No prefix (`notif_`) added — prefixes
add complexity with no real benefit in a single-collection system.

---

### 3.2 `type`

**Decision:** Domain-specific event names — `CONNECTION_REQUEST`, `CONNECTION_ACCEPTED`,
`POST_LIKED`, etc. Not a generic `SYSTEM` catch-all.

**Why `SYSTEM` was rejected:**  
`SYSTEM` tells the client nothing. The client cannot branch on it to render different UI,
route to different screens, or apply different action logic. It is the equivalent of
HTTP status `200 OK` for everything — technically valid, practically useless.

**Why domain-specific types:**  
The client reads `type` to decide what to render. `CONNECTION_REQUEST` → show Accept/Reject
buttons. `CONNECTION_ACCEPTED` → show Open Chat button. `POST_LIKED` → show post preview.
This is how GitHub (`reason`), Linear (`type`), and Slack (`event_type`) work.

**Enum is enforced at the DB schema level** in `notification.model.ts` via Mongoose `enum`.
The `NotificationBuilder.ts` type union must stay in sync — both are updated together.

---

### 3.3 `schemaVersion`

**Decision:** Integer field, default `0`. Current typed notifications use `1`.

**Why it exists:**  
Notification documents are stored long-term. If the payload shape changes in 6 months
(e.g., `actor` becomes `actors[]` for group events), old documents in the DB still have
the old shape. Without a version field, the formatter cannot distinguish old from new and
must guess — which leads to silent rendering bugs.

**How it works:**  
- `schemaVersion: 0` (or missing) → legacy flat formatter path
- `schemaVersion: 1` → typed formatter path, reads `metadata.actor/subject/actions`

**Industry precedent:** Stripe webhooks, Segment events, AWS EventBridge all version
their event payloads for exactly this reason.

---

### 3.4 `isRead` + `readAt`

**Decision:** Both fields are always present. `readAt` is `null` when unread.

**Why two fields instead of one:**  
`isRead` is a boolean — fast for badge count queries (`WHERE isRead = false`).  
`readAt` is a timestamp — needed for analytics, debugging, and UX ("Read 2 hours ago").

`isRead` alone answers "has it been read?".  
`readAt` answers "when was it read?" — a different question.

**Use cases for `readAt`:**
- Analytics: "How long does it take users to respond to connection requests?"
- Debugging: User reports notification stuck as unread → check if `readAt` is set
- UX: Display relative time ("Read 3 hours ago") in notification history
- Audit: Compliance or support investigations

**Industry precedent:** Intercom (`read_at`), Gmail (`dateRead`), Firebase Cloud Messaging
(read timestamp), Slack (`ts` + read state) all track both.

**DB index:** `{ receiver: 1, isRead: 1 }` exists for fast unread count queries.

---

### 3.5 `actor`

**Decision:** Field named `actor`, not `sender`. Contains `{ id, name, profileImage }`.
Denormalized at write time.

**Why `actor` not `sender`:**  
`sender` implies a messaging context — someone sent a message. These notifications are
event-driven: someone *did something* (requested, accepted, liked, commented). The person
who triggered the event is the `actor`.

This is the terminology used by GitHub (`actor`), Linear (`actor`), Jira (`author`),
and LinkedIn (`actor`). No major notification system uses `sender` for event notifications.

**Why denormalized (stored at write time, not populated at read time):**  
At read time, a DB join (`User.findById`) would be required for every notification in the
list. For a user with 50 unread notifications, that is 50 extra queries or one `$lookup`.

More critically: push notifications (FCM/APNs) are delivered at the moment of the event.
At delivery time, the device has no DB access. The payload must be self-contained.
LinkedIn, Facebook, and every mobile push system embeds actor data in the payload for
this reason.

**Staleness trade-off:** If the actor changes their name or profile image after the
notification is created, the stored data is stale. This is an accepted trade-off —
the same trade-off made by every major platform. The notification is a historical record
of what happened at that moment.

---

### 3.6 `subject`

**Decision:** `{ type, id, ...contextFields }` object. Not a flat `connectionId` field.

**Why a `subject` object:**  
Different notification types reference different resources. Without a subject object,
each new notification type would require a new top-level field:

```
// ❌ Without subject — field explosion
{ connectionId: "...", postId: null, issueId: null, chatId: null }

// ✅ With subject — one shape for all types
{ subject: { type: "Connection", id: "..." } }
{ subject: { type: "GroupPost", id: "..." } }
{ subject: { type: "Issue", id: "..." } }
```

**Context-specific fields on subject:**  
`CONNECTION_ACCEPTED` adds `chatId` to `subject` because a chat was created as part of
the acceptance. The client needs `chatId` to render the "Open Chat" button without an
extra API call. This is a pragmatic addition — only present when relevant.

**Industry precedent:** GitHub (`subject: { type, url, title }`), Linear (`subject`),
Jira (`issue` object). All use a resource reference object rather than flat ID fields.

---

### 3.7 `actions`

**Decision:** Array of `{ type: string }` objects. No `endpoint` URLs.

**Why no endpoint URLs:**  
Hardcoding API endpoints in stored notification documents creates a versioning trap.
If the API route changes (`/api/v1/` → `/api/v2/`), every notification document in the
DB contains a broken endpoint. Old notifications become unactionable.

The client owns routing logic. It knows that `ACCEPT` on a `CONNECTION_REQUEST` means
`POST /api/v1/connections/{subject.id}/accept`. The server does not need to tell it this.

**Why an `actions` array at all:**  
The client should not need to hardcode "if type is CONNECTION_REQUEST, show Accept and
Reject buttons". That is business logic leaking into the client. The server declares
what actions are available; the client renders them. This is the pattern used by
Slack Block Kit and GitHub's notification action model.

**Action types by notification type:**

| Notification Type    | Actions                              |
|----------------------|--------------------------------------|
| `CONNECTION_REQUEST` | `ACCEPT`, `REJECT`, `VIEW_PROFILE`   |
| `CONNECTION_ACCEPTED`| `OPEN_CHAT`, `VIEW_PROFILE`          |
| Others (legacy)      | `[]` (empty — client uses title/text)|

---

## 4. What Was Rejected and Why

### ❌ Generic `SYSTEM` type for all connection notifications

**Rejected because:** Tells the client nothing. Cannot branch on it for UI rendering,
routing, or action logic. Every notification looks the same regardless of what happened.

---

### ❌ `sender` field name

**Rejected because:** Semantically wrong for event-driven notifications. `sender` implies
messaging. These are events. `actor` is the correct term (GitHub, Linear, Slack).

---

### ❌ Pre-built `message` string in the payload

**Rejected because:** Breaks internationalization. If the app ever supports multiple
languages, a pre-built English string cannot be translated. The client should construct
the display string using i18n with the structured data:

```javascript
// ❌ Pre-built string (not i18n-ready)
message: "Khaled Ahmed wants to connect with you"

// ✅ Structured data (i18n-ready)
actor: { name: "Khaled Ahmed" }
// Client: t("connection.requested", { name: notification.actor.name })
// → EN: "Khaled Ahmed wants to connect with you"
// → BN: "Khaled Ahmed আপনার সাথে কানেক্ট করতে চায়"
```

---

### ❌ Endpoint URLs in `actions`

**Rejected because:** Version fragility. Stored endpoints break when routes change.
The client constructs URLs from `subject.id` using its own routing knowledge.

---

### ❌ `priority` field

**Rejected because:** Not needed at this stage. Priority is a push delivery concern
(FCM notification priority), not an API response concern. Adding it now would be
premature — it can be added in `schemaVersion: 2` when there is an actual use case.

---

### ❌ `id` prefix (`notif_6a0e...`)

**Rejected because:** Adds complexity with no benefit in a single-collection system.
Prefixes are useful in multi-entity APIs where IDs from different collections might
collide (e.g., Stripe uses `ch_`, `cus_`, `pi_`). In this system, notification IDs
are only ever used in notification endpoints.

---

### ❌ Nested `pagination` object inside `meta`

**Rejected because:** Unnecessary nesting with no structural benefit.

The initial shape was:
```json
{ "meta": { "pagination": { "limit": 10, "nextCursor": null, "hasNext": false }, "unreadCount": 1 } }
```

This forces the client to write `response.meta.pagination.limit` — three levels deep for
a simple scalar. The `pagination` wrapper exists only as a grouping label, not because
the fields need isolation from `unreadCount`.

The final flat shape:
```json
{ "meta": { "limit": 10, "nextCursor": null, "hasNext": false, "unreadCount": 1 } }
```

**Industry precedent for flat meta:**
- Twitter API v2: `{ "meta": { "result_count": 10, "next_token": "abc" } }` — flat
- Stripe: `{ "has_more": true, "data": [...] }` — cursor fields at root, no `meta` at all
- Slack: `{ "response_metadata": { "next_cursor": "..." } }` — flat inside its envelope

None of these nest a `pagination` sub-object inside `meta`. The nesting pattern is common
in offset-based APIs where `page`, `limit`, `total`, `totalPages` form a coherent group
worth isolating. For cursor pagination with only 3 fields, the group is too small to
justify the extra level.

---

## 5. Legacy Compatibility Strategy

All existing notifications in the DB (written before this design) have `schemaVersion: 0`
(or the field is absent, which defaults to `0`).

The formatter in `notification.service.ts` handles both:

```typescript
if (doc.schemaVersion === 1 && doc.metadata?.actor) {
  // Typed path — return actor/subject/actions
} else {
  // Legacy path — return title/text/subject (backward compatible)
}
```

**No migration needed.** Old notifications continue to render with `title` and `text`.
New notifications render with the full typed shape. Both are served by the same endpoint.

---

## 6. Notification Types Reference

| Type                  | Trigger                              | Actor          | Subject Type  | Actions                          |
|-----------------------|--------------------------------------|----------------|---------------|----------------------------------|
| `CONNECTION_REQUEST`  | User sends connection request        | Sender         | Connection    | ACCEPT, REJECT, VIEW_PROFILE     |
| `CONNECTION_ACCEPTED` | User accepts connection request      | Acceptor       | Connection    | OPEN_CHAT, VIEW_PROFILE          |
| `NEW_MESSAGE`         | Offline user receives a message      | Sender         | Chat          | OPEN_CHAT                        |
| `QUESTION_ANSWERED`   | Imam answers a question              | Imam           | AskQuestion   | VIEW_ANSWER                      |
| `POST_LIKED`          | User likes a group post              | Liker          | GroupPost     | VIEW_POST                        |
| `POST_COMMENTED`      | User comments on a group post        | Commenter      | GroupPost     | VIEW_COMMENT                     |
| `COMMENT_REPLIED`     | User replies to a comment            | Replier        | GroupPost     | VIEW_REPLY                       |
| `NEW_CONTENT`         | Admin publishes learning content     | System/Admin   | LearningContent | VIEW_CONTENT                   |
| `NEW_KHUTBAH`         | Admin publishes a khutbah            | System/Admin   | Khutbah       | VIEW_KHUTBAH                     |
| `ADMIN`               | Admin broadcasts a message           | Admin          | —             | —                                |
| `SYSTEM`              | Legacy system events                 | —              | —             | —                                |

> **Note:** Types marked with `System/Admin` as actor are currently sent via
> `NotificationBuilder` and do not have typed metadata (schemaVersion: 0).
> They can be upgraded to schemaVersion: 1 in a future iteration.

---

## 7. Write-Time vs Read-Time Data Strategy

**Decision: Denormalize at write time.**

When `sendNotifications()` is called, the full actor data (`name`, `profileImage`) is
passed in `metadata` and stored in the DB document. At read time, the formatter reads
`metadata` directly — no joins, no extra queries.

**Alternative considered: Populate at read time**  
Fetch actor data from the `User` collection when serving `GET /notifications/me`.

**Why rejected:**
1. N+1 query problem — 50 notifications = 50 user lookups (or one `$lookup` aggregation)
2. Push notifications require self-contained payloads — cannot populate at FCM delivery time
3. Read performance degrades as notification volume grows

**Accepted trade-off:**  
Actor data (name, profileImage) may be stale if the user updates their profile after
the notification was created. This is the same trade-off made by LinkedIn, Facebook,
and every major notification system. A notification is a historical record.

---

## 8. Industry Comparison

| Feature                  | This System    | GitHub         | Linear         | Slack          |
|--------------------------|----------------|----------------|----------------|----------------|
| Typed event names        | ✅             | ✅ (`reason`)  | ✅ (`type`)    | ✅ (`type`)    |
| Actor object             | ✅             | ✅ (`actor`)   | ✅ (`actor`)   | ✅ (`user`)    |
| Subject/resource object  | ✅             | ✅ (`subject`) | ✅ (resource)  | ✅ (`item`)    |
| Actions array            | ✅             | ✅             | ✅             | ✅ (Block Kit) |
| No endpoint URLs         | ✅             | ✅             | ✅             | ✅             |
| Schema versioning        | ✅             | —              | —              | —              |
| readAt timestamp         | ✅             | —              | ✅             | ✅             |
| Denormalized actor data  | ✅             | ✅             | ✅             | ✅             |
| i18n-ready (no message)  | ✅             | ✅             | ✅             | ✅             |

---

## 9. Pagination Strategy

### Decision: Cursor-based pagination, not offset/page pagination

`GET /api/v1/notifications/me` uses cursor pagination via `QueryBuilder.cursorPaginate('_id')`.
Offset pagination (`skip` / `limit` with `page` number) was explicitly rejected.

---

### Why offset pagination fails for notification feeds

Notification feeds are high-frequency real-time streams. New documents arrive between
page loads. With offset pagination this causes **page drift**:

```
User has 20 notifications. Fetches page 1 (skip 0, limit 10) → sees items 1–10.
3 new notifications arrive.
User fetches page 2 (skip 10, limit 10) → DB now has 23 items.
skip(10) now lands on what was item 8 before — items 8, 9, 10 are shown again (duplicates).
Items 11, 12, 13 (the new ones) are never seen (skipped).
```

This is not a theoretical edge case. On a mobile app with real-time push notifications,
new items arrive constantly. Offset pagination is structurally broken for this use case.

---

### How cursor pagination solves it

The cursor is the `_id` of the last document the client received (base64-encoded).
Each subsequent request fetches documents with `_id < cursor` (descending order).
New documents arriving at the top of the feed do not affect the cursor position —
the client always continues from exactly where it left off.

```
User fetches first page → receives items with IDs [Z, Y, X, W, V, U, T, S, R, Q]
                          cursor = base64(Q)
3 new notifications arrive → IDs [C2, C1, C0] prepended to feed
User fetches next page with ?nextCursor=base64(Q)
→ query: { _id: { $lt: Q } } → returns [P, O, N, M, L, K, J, I, H, G]
No duplicates. No skipped items. Drift-proof.
```

---

### Response shape

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "meta": {
    "limit": 10,
    "nextCursor": "NmEwZTI0MDQ4MjQ5OTE4YTg0YTI4MTAz",
    "hasNext": true,
    "unreadCount": 7
  },
  "data": [ ... ]
}
```

All four fields sit at the same level inside `meta`. No nested `pagination` object.
`unreadCount` is notification-domain data; `limit`, `nextCursor`, `hasNext` are transport
metadata. Both categories are small enough to coexist flat — a nested wrapper would add
a level of indirection with zero benefit at this scale.

When `hasNext` is `false`, `nextCursor` is `null`. The client stops fetching.

**Client usage:**
```
First page : GET /api/v1/notifications/me
Next page  : GET /api/v1/notifications/me?nextCursor=NmEwZTI0...
No more    : meta.hasNext === false → stop
```

---

### What was rejected

**`total` and `totalPages` fields** — not included in cursor pagination response.
Showing "Page 3 of 12" is meaningless in a real-time feed where the total changes
every few seconds. Instagram, Twitter, and LinkedIn notification feeds do not show
total counts for this reason.

**Offset pagination for `getSentHistory`** — the admin broadcast history endpoint
(`GET /notifications/broadcasts`) intentionally keeps offset pagination. Admin history
is a stable, low-write dataset where page numbers are meaningful and drift is not a
concern. Different access patterns warrant different pagination strategies.

---

### Industry precedent

| Platform | Notification feed pagination |
|---|---|
| Instagram | Cursor (`end_cursor` in GraphQL) |
| Twitter/X | Cursor (`next_token`) |
| LinkedIn | Cursor (`start` + `count` with stable cursor) |
| GitHub | Cursor (Link header with `rel=next`) |
| Slack | Cursor (`next_cursor` in response) |
| Facebook | Cursor (`after` in paging object) |

No major platform uses offset pagination for notification feeds.

---

## 10. Future Considerations

### schemaVersion: 2
When group events are introduced (e.g., multiple actors liked a post), `actor` may need
to become `actors[]`. The `schemaVersion` field makes this migration safe — old documents
stay on v1, new documents use v2, the formatter handles both.

### Upgrading legacy notifications
`NotificationBuilder`-written notifications (POST_LIKED, NEW_CONTENT, etc.) currently
use `schemaVersion: 0`. They can be upgraded to v1 by:
1. Adding `.setData({ actor: {...}, subject: {...}, actions: [...] })` to each builder call
2. Passing `schemaVersion: 1` through the database channel
3. No DB migration needed — old documents keep rendering via the legacy fallback

### `NEW_MESSAGE` notifications
Currently written with `type: 'SYSTEM'` in `message.service.ts`. Should be upgraded to
`type: 'NEW_MESSAGE'` with `schemaVersion: 1` and actor/subject metadata. The `subject`
would be `{ type: 'Chat', id: chatId }` and actions would be `[{ type: 'OPEN_CHAT' }]`.

### Read receipts at scale
If the user base grows significantly, `PATCH /notifications/read-all` updating thousands
of documents in one query may become slow. Consider a `lastReadAt` field on the User
document as a cursor — notifications created before `lastReadAt` are considered read
without individual document updates.

