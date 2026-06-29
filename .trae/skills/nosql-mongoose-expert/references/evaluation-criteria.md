# Evaluation Criteria — Full Rubric

## 0. Scoring Rubric (use this to assign scores)

### Category 1: Schema Design (25 pts)
| Points | Criteria |
|---|---|
| 23–25 | Embed/reference decisions are all correct and justified by access patterns. Schema patterns (Extended Reference, Computed, Bucket etc.) applied where appropriate. No unbounded arrays. Cardinality handled correctly everywhere. |
| 17–22 | Most decisions correct. 1–2 minor embed/ref misjudgments. No critical unbounded arrays. |
| 10–16 | Several embed/ref mistakes. At least one unbounded array risk. Little evidence of pattern awareness. |
| 0–9 | Relational thinking applied to MongoDB. Multiple unbounded arrays. No pattern awareness. |

### Category 2: Indexing Strategy (20 pts)
| Points | Criteria |
|---|---|
| 18–20 | All high-frequency query fields indexed. Compound indexes follow ESR rule. No redundant indexes. TTL indexes where appropriate. Partial/sparse indexes used correctly. |
| 13–17 | Core indexes present. Missing 1–2 compound indexes. ESR rule mostly followed. |
| 7–12 | Only unique indexes present. Missing most query indexes. No compound strategy. |
| 0–6 | Almost no indexes. Full collection scans guaranteed in production. |

### Category 3: Data Integrity & Types (20 pts)
| Points | Criteria |
|---|---|
| 18–20 | All foreign keys are ObjectId. Enums validated everywhere. Required fields marked. Validators on critical fields. Consistent type usage across models. |
| 13–17 | Mostly correct types. 1–2 String instead of ObjectId. Most enums validated. |
| 7–12 | Several String/ObjectId mismatches. Inconsistent enum validation. Some required fields missing. |
| 0–6 | Widespread type issues. Foreign keys as strings throughout. No validators. |

### Category 4: Performance & Scalability (20 pts)
| Points | Criteria |
|---|---|
| 18–20 | No unbounded arrays. No N+1 patterns. Cursor-based pagination. Aggregation pipeline ordered correctly. Extended Reference used to avoid hot-path populate(). |
| 13–17 | Minor scalability concerns. No critical N+1. Pagination may use skip/limit but on small datasets. |
| 7–12 | 1–2 N+1 risks. Unbounded array present. skip/limit pagination on potentially large collections. |
| 0–6 | Multiple N+1 patterns. Multiple unbounded arrays. No pagination strategy. |

### Category 5: Mongoose Best Practices (15 pts)
| Points | Criteria |
|---|---|
| 13–15 | timestamps: true everywhere. lean() and select() used on reads. No business logic in hooks. Soft delete pattern clean. |
| 9–12 | timestamps mostly present. lean()/select() sometimes missing. Minor hook misuse. |
| 5–8 | Missing timestamps on several models. lean()/select() rarely used. Hooks doing too much. |
| 0–4 | No timestamps. No lean(). Business logic in hooks. Plain string passwords. |

---

## 1. Embedding vs Referencing

### Embed when:
- Data is accessed together almost always ("owned" relationship)
- Child data has no independent lifecycle (e.g., order line items)
- Array is bounded and small (< ~100 items, ideally < 20)
- No need to query child documents independently
- One-to-few or one-to-many (small many)

### Reference when:
- Data is accessed independently
- Many-to-many relationships
- Child documents are large or frequently updated
- Array could grow without bound (one-to-squillions)
- Multiple parents share the same child data

### Red flags:
- Embedding users inside posts (user data duplicated everywhere, update nightmare)
- Referencing order line items (forces populate() on every order read)
- Embedding comments/messages that can grow to thousands per document

---

## 2. Indexing Rules

### ESR Rule for Compound Indexes
Always order fields: **Equality → Sort → Range**

```js
// Query: find users by status, sort by createdAt, filter by age range
// CORRECT index:
{ status: 1, createdAt: 1, age: 1 }

// WRONG:
{ age: 1, status: 1, createdAt: 1 }
```

### Index Redundancy
If you have `{ a: 1, b: 1 }`, you don't need `{ a: 1 }` separately — the compound index covers it.

### When NOT to index:
- Low-cardinality fields used alone (e.g., `{ isActive: 1 }` on a collection where 95% of docs are active) — MongoDB may ignore it and do a collection scan anyway
- Write-heavy collections — every index slows writes
- Fields never used in query filters or sorts

### Must-have indexes:
- Any field used in `.find()` filters on large collections
- Foreign key fields used in joins/populate (`userId`, `orderId`, etc.)
- Fields used in sort on paginated queries
- `{ expireAt: 1, expireAfterSeconds: 0 }` for TTL data

---

## 3. Mongoose-Specific Criteria

### Always use `lean()` for read-only queries
```js
// BAD — returns full Mongoose Document with all overhead
const users = await User.find({ isActive: true });

// GOOD — returns plain JS object, 2-5x faster
const users = await User.find({ isActive: true }).lean();
```
When NOT to use lean(): when you need Mongoose virtuals, when you need to call `.save()` on the result, when using populated documents with virtuals.

### Always use `select()` to limit fields
```js
// BAD — fetches all fields including large ones
const user = await User.findById(id);

// GOOD
const user = await User.findById(id).select('name email role');
```

### populate() vs Aggregation
- `populate()` = multiple round trips to DB (N queries)
- Aggregation `$lookup` = single query, all on DB server side

Use aggregation when:
- Joining more than one collection
- Filtering/sorting on joined data
- Performance is critical
- Large result sets

Use populate() when:
- Simple one-level join
- Development speed matters more than performance
- Result set is small

### Hooks — What Belongs Where
✅ Good uses of pre/post hooks:
- `pre('save')` — hashing passwords, setting computed fields
- `pre('remove')` — cascade deletes
- `post('save')` — sending notifications (carefully)

❌ Bad uses of hooks:
- Business logic that belongs in service layer
- HTTP calls or external API calls inside hooks
- Complex transactions inside hooks (use transactions explicitly)
- Logging (use application-level logging instead)

### Timestamps
Always include unless you have a specific reason not to:
```js
const schema = new Schema({...}, { timestamps: true });
```

### Strict Mode
Never disable unless you have a documented reason:
```js
// DON'T do this without a reason:
const schema = new Schema({...}, { strict: false });
```

---

## 4. Query Pattern Criteria

### N+1 Pattern (Critical Issue)
```js
// BAD — N+1: 1 query to get orders, then N queries for each user
const orders = await Order.find({});
for (const order of orders) {
  const user = await User.findById(order.userId); // N queries!
}

// GOOD — Single aggregation
const orders = await Order.aggregate([
  { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } }
]);
```

### Pagination
```js
// BAD — skip/limit degrades badly beyond ~1000 docs
// MongoDB still has to scan 100,000 docs to skip them
const page10000 = await Product.find().skip(100000).limit(20);

// GOOD — cursor-based pagination
const products = await Product.find({ _id: { $gt: lastSeenId } }).limit(20);

// ALSO GOOD — range-based using indexed field
const products = await Product.find({ createdAt: { $lt: lastSeenDate } })
  .sort({ createdAt: -1 }).limit(20);
```

### Aggregation Pipeline Order
Always in this order for performance:
1. `$match` — filter first, reduce documents early
2. `$sort` — before `$group` if possible
3. `$lookup` — after filtering, not before
4. `$project` / `$addFields` — late stage
5. `$limit` / `$skip` — as early as makes sense

```js
// BAD — lookup before match
[{ $lookup: ... }, { $match: { status: 'active' } }]

// GOOD — match first
[{ $match: { status: 'active' } }, { $lookup: ... }]
```

---

## 5. Document Size & Growth

- Hard limit: 16MB per document
- Practical limit: Keep documents under ~1MB for performance
- Arrays: Always ask "can this array grow without bound?"
  - Posts with likes: 1M users can like a post → unbounded → use separate collection
  - Order with line items: realistically < 100 → embedding is fine

---

## 6. Connection Management

```js
// Mongoose connection best practices
mongoose.connect(uri, {
  maxPoolSize: 10,        // Default is 5, adjust based on load
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

// Always handle connection events
mongoose.connection.on('error', (err) => logger.error(err));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
```

---

## 7. Transactions

Use transactions when:
- Multiple documents must be updated atomically
- Failure of one operation should roll back others

```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Order.create([orderData], { session });
  await Inventory.updateOne({ _id: itemId }, { $inc: { stock: -1 } }, { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

Do NOT use transactions for single-document operations — MongoDB single-document operations are already atomic.
