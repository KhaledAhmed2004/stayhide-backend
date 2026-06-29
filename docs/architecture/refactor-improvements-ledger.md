# Refactor Improvements Log

This document acts as an architectural ledger and tracking file for all major refactoring improvements implemented in the **okjt100** codebase. It explains **what**, **why**, **how**, and the **business/technical benefits** of the modifications made, allowing the development team to keep a clear history of enhancements and their respective rationales.

---

## 🚀 Improvement: Cursor-Based Pagination (May 2026)

### 1. 🔍 Context & What is Changing?
We are refactoring the pagination mechanism for real-time list endpoints (specifically the connection/friend request endpoints, feeds, or messaging APIs) from standard **Offset-based pagination** (`skip` & `limit`) to **Cursor-based pagination** (`nextCursor` & `limit`).

We introduce a reusable method `cursorPaginate()` inside the global `QueryBuilder` class in `src/app/builder/QueryBuilder.ts`, allowing any database query to seamlessly switch to cursor-based queries.

---

### 2. ❓ Why Refactor? (The Problems of Offset Pagination)

Before this change, the system used standard offset pagination:
```typescript
let skip = (page - 1) * limit;
this.modelQuery = this.modelQuery.skip(skip).limit(limit);
```

While simple and useful for admin dashboards, this suffers from major flaws when used for feeds or real-time lists:

*   **Database Performance Degradation ($O(N)$ Complexity):**
    When a user queries page `1000` with limit `10`, MongoDB still has to scan and load the first `9990` documents from disk/index, discard them, and return the final `10`. This consumes massive CPU and IO resources on high-volume lists.
*   **Data Inconsistencies (Duplicate or Skipped Items):**
    If User A is viewing Page 1 of their pending requests, and another user sends them a new request, that new request gets inserted at the top. When User A scrolls down to request Page 2, every item shifts down by one position. As a result, User A sees the last item from Page 1 again at the top of Page 2 (duplicates).
    Conversely, if an item gets deleted, User A will skip an item entirely when navigating to the next page.
*   **Suboptimal infinite scroll / lazy-loading:**
    Offset pagination requires a heavy `countDocuments` query to calculate `totalPages`. Running `countDocuments` on every scroll in an infinite-feed screen triggers slow database operations.

---

### 3. 🎯 The Solution: Cursor-based Pagination ($O(\log N)$ Complexity)

By using a cursor (a Base64 encoded unique key, such as `_id` or `createdAt`), the query fetches the exact set of items immediately after that cursor.

#### How it works:
1. The frontend requests the first page (no `nextCursor` passed).
2. The backend fetches `limit + 1` records sorted descending (e.g., newest first).
3. The backend detects if there is an extra `+1` record:
   - If **yes**: `hasNext` is `true`, and we encode the `_id` of the last record in our `limit` page as a Base64 string (`nextCursor`).
   - If **no**: `hasNext` is `false`, and `nextCursor` is `null`.
4. For subsequent pages, the frontend passes `nextCursor` in the query params. The backend decodes it and queries:
   ```typescript
   { _id: { $lt: decodedCursorId } }
   ```
   Because `_id` is automatically indexed in MongoDB, this lookup takes **$O(\log N)$ time**, bypassing scan offsets entirely.

---

### 4. 📊 Comparative Technical Breakdown

| Dimension | Offset-based Pagination | Cursor-based Pagination |
| :--- | :--- | :--- |
| **Parameters** | `page=2&limit=10` | `nextCursor=NjEwY2QyMWNjN2Y4ODc2ZmQ4ZTRiNjFl&limit=10` |
| **Complexity** | $O(N)$ (requires scanning skipped records) | $O(\log N)$ (uses index boundaries instantly) |
| **Stability** | Weak: Affected by insertions/deletions during scroll | Strong: Unaffected by insertions/deletions |
| **Counting Overhead** | High (must call `countDocuments` every time) | Zero (only checks for presence of the next page item) |
| **Best Used For** | Admin tables, jump-to-page navigation | Infinite scrolls, feeds, chats, pending requests |

---

### 5. 🛠️ How to Consume Cursor Pagination in Frontend (Next.js/React/Mobile)

When using libraries like **React Query**, **RTK Query**, or **SWR**, cursor pagination fits perfectly with `useInfiniteQuery`:

```javascript
// Example React Native / Next.js implementation with react-query
const fetchPendingRequests = async ({ pageParam = "" }) => {
  const url = pageParam 
    ? `/api/v1/connections/requests?type=received&limit=10&nextCursor=${pageParam}`
    : `/api/v1/connections/requests?type=received&limit=10`;
  const response = await fetch(url);
  return response.json();
};

// Inside your React Component
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = useInfiniteQuery({
  queryKey: ['pendingRequests'],
  queryFn: fetchPendingRequests,
  getNextPageParam: (lastPage) => lastPage.meta.nextCursor || undefined,
});
```

---

### 6. 🚀 How to Extend to Other Modules

If you want to convert other modules (e.g., `MessageService`, `NotificationService`, or `LearningContentService`) to cursor pagination:

1. Locate the query in the service file.
2. Replace `.paginate()` and `.getPaginationInfo()` with `.cursorPaginate(cursorField)`:
   ```typescript
   // MessageService example
   const messageQuery = new QueryBuilder(Message.find({ chatId }), query)
     .filter()
     .sort()
     .fields();

   const { data, meta } = await messageQuery.cursorPaginate('_id');
   return { data, pagination: meta };
   ```
3. Update the corresponding controller to pass `pagination` directly into your API response wrapper.
