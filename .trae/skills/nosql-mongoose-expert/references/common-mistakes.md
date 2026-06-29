# Common Mistakes — Junior/Mid vs Senior Level

These are the most frequent issues found in real MongoDB/Mongoose codebases. Use this to calibrate feedback.

---

## 🔴 CRITICAL Mistakes

### 1. Unbounded Arrays
**Junior code:**
```js
const PostSchema = new Schema({
  likes: [{ type: ObjectId, ref: 'User' }],  // Will grow forever
  comments: [CommentSchema],                  // Will grow forever
});
```
**Why it's critical:** MongoDB documents max at 16MB. A viral post with 1M likes will hit the limit and break. Also causes full document scans on every read.
**Senior fix:** Separate `Like` and `Comment` collections with `postId` reference. Store count as computed field on Post.

---

### 2. Missing Indexes on Query Fields
**Junior code:**
```js
// Querying without index on large collection
const orders = await Order.find({ status: 'pending', userId: req.user.id });
// No index defined on the schema
```
**Why it's critical:** MongoDB does a full collection scan. At 1M documents, this takes seconds.
**Senior fix:**
```js
OrderSchema.index({ userId: 1, status: 1 });  // Compound, ESR order
```

---

### 3. N+1 Query Pattern
**Junior code:**
```js
const posts = await Post.find({ authorId: userId });
const postsWithAuthors = [];
for (const post of posts) {
  const author = await User.findById(post.authorId);  // N queries!
  postsWithAuthors.push({ ...post.toObject(), author });
}
```
**Why it's critical:** 100 posts = 101 database round trips. 1000 posts = 1001 queries. Catastrophic at scale.
**Senior fix:** Use `$lookup` in aggregation or `.populate()` (one extra query, not N).

---

### 4. Storing Passwords/Secrets in Plain Text
**Junior code:**
```js
const UserSchema = new Schema({
  password: String,  // plain text!
});
```
**Fix:** Hash with bcrypt in `pre('save')` hook.

---

## 🟠 HIGH Mistakes

### 5. Not Using lean() for Read Queries
**Junior code:**
```js
// Every read creates full Mongoose Document object (heavy)
const products = await Product.find({ category: 'electronics' });
// Then only reads data, never calls .save()
```
**Senior fix:**
```js
const products = await Product.find({ category: 'electronics' }).lean();
```
Impact: 2-5x faster reads, significantly less memory usage.

---

### 6. Fetching All Fields Always
**Junior code:**
```js
const user = await User.findById(id);
// Returns all fields including large bio, preferences, history, etc.
// Then only uses user.name and user.email
```
**Senior fix:**
```js
const user = await User.findById(id).select('name email role').lean();
```

---

### 7. Using skip() for Deep Pagination
**Junior code:**
```js
// Page 500 with 20 items = skip 10,000
const items = await Item.find().skip(page * limit).limit(limit);
```
**Why it's high:** MongoDB scans and discards 10,000 documents. Gets slower as page number increases.
**Senior fix:** Cursor-based pagination using `_id` or indexed timestamp.

---

### 8. Over-using populate() on Hot Paths
**Junior code:**
```js
// In a hot API endpoint called 1000x/minute:
const posts = await Post.find().populate('author').populate('tags').populate('category');
// 4 queries per request × 1000 requests = 4000 queries/minute
```
**Senior fix:** Denormalize critical fields (Extended Reference pattern) or use single `$lookup` aggregation.

---

### 9. Using $where or JavaScript in Queries
**Junior code:**
```js
// Never do this:
await User.find({ $where: "this.firstName + this.lastName === 'John Doe'" });
```
**Why:** Runs JavaScript on server, can't use indexes, security risk (NoSQL injection), slow.
**Senior fix:** Store `fullName` as a computed field or use `$concat` in aggregation.

---

## 🟡 MEDIUM Mistakes

### 10. Not Setting timestamps: true
**Junior code:**
```js
const UserSchema = new Schema({
  name: String,
  // No createdAt, updatedAt
});
```
**Senior fix:** Always add `{ timestamps: true }` option. You will almost always need these eventually.

---

### 11. Defining Indexes Inside Schema Instead of Separately
**Junior code:**
```js
const UserSchema = new Schema({
  email: { type: String, unique: true, index: true },  // redundant: unique implies index
  username: { type: String, index: true },
});
```
**Senior fix:**
```js
const UserSchema = new Schema({ email: String, username: String });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 });
// Easier to manage, see all indexes in one place
```

---

### 12. Putting Business Logic in Mongoose Hooks
**Junior code:**
```js
UserSchema.post('save', async function(doc) {
  // Sending email, calling Stripe, updating analytics...
  await sendWelcomeEmail(doc.email);
  await stripe.customers.create({ email: doc.email });
  await analytics.track('user_created', doc._id);
});
```
**Why it's wrong:** Hook failures can corrupt the save flow. Hard to test. Hard to debug. Couples DB layer to external services.
**Senior fix:** Do this in the service layer after `user.save()` returns.

---

### 13. Overly Normalized Schema (Relational Thinking in MongoDB)
**Junior code:**
```js
// Treating MongoDB like PostgreSQL
const AddressSchema = new Schema({ street: String, city: String, country: String });
const UserSchema = new Schema({ addressId: { type: ObjectId, ref: 'Address' } });
// Now every user fetch requires populate() for address
```
**When this is wrong:** If address is only ever accessed with the user, embed it.
**When it's right:** If address is shared between multiple entities (e.g., company addresses used by many users).

---

### 14. No Error Handling on Mongoose Operations
**Junior code:**
```js
const user = await User.findById(id);
console.log(user.name);  // Crashes if user is null
```
**Senior fix:**
```js
const user = await User.findById(id).lean();
if (!user) throw new NotFoundError('User not found');
```

---

## 🔵 LOW / ⚪ STYLE Issues

### 15. Inconsistent Field Naming
Mix of camelCase and snake_case in the same schema. Pick one. MongoDB convention is camelCase.

### 16. Not Using Mongoose Virtuals for Computed Display Fields
```js
// Instead of always sending both firstName and lastName and computing fullName in frontend:
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});
```

### 17. Required Fields Not Marked
Fields that are always expected but not marked `required: true` — Mongoose won't validate them.

### 18. Enum Values Not Validated
```js
// BAD
status: String  // accepts anything

// GOOD
status: { type: String, enum: ['pending', 'active', 'suspended'], required: true }
```
