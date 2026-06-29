# MongoDB Schema Design Patterns

Reference: Apply these patterns when the user's use case matches. Always explain WHY a pattern fits.

---

## 1. Extended Reference Pattern
**Problem:** You need data from another document frequently, but don't want to populate every time.
**Solution:** Duplicate a small subset of referenced document's fields.

```js
// Instead of just storing orderId and always populating:
const OrderSchema = new Schema({
  customer: {
    _id: { type: ObjectId, ref: 'User', required: true },
    name: String,        // duplicated from User
    email: String,       // duplicated from User
  },
  // ...
});
```
**When to use:** Read-heavy, the duplicated fields change rarely, avoiding populate() on hot paths.
**Trade-off:** Must update duplicated data when source changes (use background job or event).

---

## 2. Subset Pattern
**Problem:** Documents have large arrays but you only ever show the first N items.
**Solution:** Store the top N items in the main document, full list in a separate collection.

```js
// Movie with reviews — show top 10 reviews on movie page
const MovieSchema = new Schema({
  title: String,
  top10Reviews: [ReviewSchema],  // Latest/best 10 only
  reviewCount: Number,
});
// Full reviews in separate Review collection
```
**When to use:** Large arrays where you typically only show a subset (comments, reviews, activity feed).

---

## 3. Computed Pattern
**Problem:** Expensive calculations run on every read.
**Solution:** Pre-compute and store the result, update when source data changes.

```js
const ProductSchema = new Schema({
  reviews: [{ rating: Number }],
  averageRating: Number,     // computed, updated on new review
  reviewCount: Number,       // computed
});

// Pre-save hook or background job updates averageRating
```
**When to use:** Aggregations run frequently, data changes less often than reads.
**Trade-off:** Data may be slightly stale. Use TTL or event-driven updates.

---

## 4. Bucket Pattern
**Problem:** Time-series or event data creates too many small documents.
**Solution:** Group events into "buckets" by time period.

```js
// Instead of one doc per sensor reading:
const SensorBucketSchema = new Schema({
  sensorId: ObjectId,
  date: Date,           // start of the hour/day bucket
  readings: [{
    timestamp: Date,
    value: Number,
  }],
  count: Number,
  sum: Number,          // pre-computed for averages
  min: Number,
  max: Number,
});
```
**When to use:** IoT data, metrics, logs, time-series — high-volume append-only data.
**Bucket size:** Usually 1 hour or 1 day worth of readings per document.

---

## 5. Outlier Pattern
**Problem:** Most documents are small but a few are huge (power users, viral posts).
**Solution:** Main document handles normal case, overflow documents for outliers.

```js
const PostSchema = new Schema({
  content: String,
  likes: [ObjectId],       // works for most posts
  hasOverflow: Boolean,    // flag when likes > threshold
  likeCount: Number,
});

// Separate LikeOverflow collection for posts with millions of likes
```
**When to use:** When 95% of docs are small but 5% could be huge. Prevents rare edge case from wrecking performance.

---

## 6. Tree Patterns (Hierarchical Data)

### Parent Reference (simple, common)
```js
{ _id: 1, name: "Electronics", parent: null }
{ _id: 2, name: "Phones", parent: 1 }
```
✅ Easy inserts, easy to find parent
❌ Finding all descendants requires multiple queries

### Materialized Path
```js
{ _id: 2, name: "Phones", path: ",1,2," }
{ _id: 3, name: "Smartphones", path: ",1,2,3," }
```
✅ Find all descendants with regex: `{ path: /,1,/ }`
❌ Path updates when tree restructures

### Nested Set (for read-heavy trees)
```js
{ _id: 1, name: "Electronics", left: 1, right: 10 }
{ _id: 2, name: "Phones", left: 2, right: 7 }
```
✅ Find subtree: `{ left: { $gt: 2 }, right: { $lt: 7 } }`
❌ Expensive writes — tree restructure changes many nodes

**Choose based on:** Read vs write ratio, need for subtree queries, tree depth.

---

## 7. Polymorphic Pattern
**Problem:** Similar but different document types in one collection.
**Solution:** Use a `type` discriminator field.

```js
// One collection for all payment methods
const PaymentMethodSchema = new Schema({
  userId: ObjectId,
  type: { type: String, enum: ['card', 'bank', 'crypto'] },
  // Card-specific
  last4: String,
  expiryDate: Date,
  // Bank-specific
  accountNumber: String,
  routingNumber: String,
}, { discriminatorKey: 'type' });
```
Mongoose supports this natively with `discriminators`.

---

## 8. Schema Versioning Pattern
**Problem:** Schema evolves over time, old documents have different shape.
**Solution:** Add a schema version field.

```js
const UserSchema = new Schema({
  schemaVersion: { type: Number, default: 2 },
  // ...
});

// Migration: on read, check version and transform if needed
// On write: always write current version
```
