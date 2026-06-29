# Query Patterns — Pagination, Filtering, Sorting, Search

---

## QueryBuilder (Standard — always use for lists)

```typescript
const result = new QueryBuilder([Feature].find(), req.query)
  .search(['name', 'description'])  // $regex case-insensitive search
  .filter()                          // exact field matches
  .sort()                            // sortBy + sortOrder
  .paginate()                        // page + limit
  .fields();                         // field selection

const [data, pagination] = await Promise.all([
  result.modelQuery,
  result.countTotal(),
]);
// pagination: { page, limit, totalPage, total }
```

---

## Standard Query Params (Zod querySchema)

```typescript
const querySchema = z.object({
  query: z.object({
    // Pagination
    page: z.string().optional(),                           // default: "1"
    limit: z.string().optional(),                          // default: "10"

    // Sorting
    sortBy: z.string().optional(),                         // field name
    sortOrder: z.enum(['asc', 'desc']).optional(),         // default: "desc"

    // Search (full-text across searchable fields)
    searchTerm: z.string().optional(),

    // Field selection
    fields: z.string().optional(),                         // "name,sport,createdAt"

    // Domain-specific filters (add as needed)
    sport: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    createdBy: z.string().optional(),
  }),
});
```

---

## Client URL Examples

```
GET /api/v1/clubs                                          ← all, default page/limit
GET /api/v1/clubs?page=2&limit=20                         ← paginate
GET /api/v1/clubs?sortBy=name&sortOrder=asc               ← sort
GET /api/v1/clubs?searchTerm=dhaka                        ← search
GET /api/v1/clubs?sport=football&status=active            ← filter
GET /api/v1/clubs?fields=name,sport,location              ← field selection
GET /api/v1/clubs?searchTerm=fc&sport=football&page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

---

## Advanced Filtering (beyond QueryBuilder defaults)

For range filters or complex conditions, pre-build the base query:

```typescript
const getAll = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from && { $gte: new Date(query.from as string) }),
      ...(query.to && { $lte: new Date(query.to as string) }),
    };
  }

  if (query.minPrice || query.maxPrice) {
    filter.price = {
      ...(query.minPrice && { $gte: Number(query.minPrice) }),
      ...(query.maxPrice && { $lte: Number(query.maxPrice) }),
    };
  }

  const result = new QueryBuilder([Feature].find(filter), query)
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [data, pagination] = await Promise.all([result.modelQuery, result.countTotal()]);
  return { data, pagination };
};
```

---

## Cursor-Based Pagination (for high-volume / real-time feeds)

Use when: offset pagination is too slow (collection > 100k docs), or for infinite scroll / real-time feeds.

```typescript
// Request: GET /api/v1/feed?cursor=abc123&limit=20
// cursor = last _id from previous page

const getFeed = async (cursor?: string, limit = 20) => {
  const filter = cursor ? { _id: { $lt: cursor } } : {};

  const data = await Post
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)          // fetch one extra to check hasMore
    .select('title content createdAt');

  const hasMore = data.length > limit;
  if (hasMore) data.pop();

  return {
    data,
    cursor: hasMore ? data[data.length - 1]._id : null,
    hasMore,
  };
};

// Response shape:
// { data: [...], cursor: "xyz789", hasMore: true }
// Client passes cursor=xyz789 for next page
```

---

## Performance Rules

### Add MongoDB indexes for every filtered/sorted field:
```typescript
// [feature].model.ts — add to schema
[feature]Schema.index({ sport: 1 });
[feature]Schema.index({ status: 1, createdAt: -1 });
[feature]Schema.index({ createdBy: 1, status: 1 });
[feature]Schema.index({ name: 'text', description: 'text' }); // for searchTerm
```

### Lean queries for read-only operations:
```typescript
const data = await [Feature].find(filter).lean(); // returns plain objects, ~30% faster
```

### Use `countDocuments` not `count` (deprecated):
```typescript
const total = await [Feature].countDocuments(filter);
```

### Avoid N+1 queries — use `.populate()` or aggregate:
```typescript
// Bad — N+1
const clubs = await Club.find();
for (const club of clubs) {
  club.owner = await User.findById(club.ownerId); // N extra queries
}

// Good — one query
const clubs = await Club.find().populate('ownerId', 'name email');
```

---

## Pagination Response (always include)

```typescript
sendResponse(res, {
  success: true,
  statusCode: StatusCodes.OK,
  message: 'Clubs retrieved successfully',
  pagination: result.pagination,   // { page, limit, totalPage, total }
  data: result.data,
});
```
