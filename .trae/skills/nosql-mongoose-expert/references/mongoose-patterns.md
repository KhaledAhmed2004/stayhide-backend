# Mongoose Patterns — Best Practices Reference

## Query Optimization Patterns

### Pattern: Repository Layer
Centralize all Mongoose queries in a repository. Never call Mongoose directly from controllers.

```js
// userRepository.js
class UserRepository {
  async findById(id, fields = '') {
    return User.findById(id).select(fields).lean();
  }

  async findActiveUsers(page, cursor) {
    const query = { isActive: true };
    if (cursor) query._id = { $gt: cursor };
    return User.find(query).limit(page.size).sort({ _id: 1 }).lean();
  }

  async updateById(id, updates) {
    return User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }
}
```

---

### Pattern: Lean + DTO Transform
```js
// Fetch lean, then shape the response
const rawUser = await User.findById(id).select('name email role createdAt').lean();
if (!rawUser) throw new NotFoundError();

// Transform to DTO — don't expose internal fields
return {
  id: rawUser._id.toString(),
  name: rawUser.name,
  email: rawUser.email,
  role: rawUser.role,
  memberSince: rawUser.createdAt,
};
```

---

### Pattern: Aggregation for Complex Reads
```js
const orderSummary = await Order.aggregate([
  // 1. Filter first (uses index)
  { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
  
  // 2. Lookup related data
  { $lookup: {
    from: 'products',
    localField: 'items.productId',
    foreignField: '_id',
    as: 'productDetails',
    pipeline: [{ $project: { name: 1, price: 1 } }]  // Only needed fields
  }},
  
  // 3. Shape output last
  { $project: {
    orderId: '$_id',
    total: 1,
    itemCount: { $size: '$items' },
    createdAt: 1,
  }},
  
  // 4. Sort and paginate
  { $sort: { createdAt: -1 } },
  { $limit: 20 },
]);
```

---

### Pattern: Upsert
```js
// Atomic — won't create duplicate on race condition
const result = await UserPreferences.findOneAndUpdate(
  { userId },
  { $set: updates },
  { upsert: true, new: true, runValidators: true }
).lean();
```

---

### Pattern: Bulk Operations
```js
// DON'T do this — N queries:
for (const item of items) {
  await Inventory.updateOne({ _id: item.id }, { $inc: { stock: -item.qty } });
}

// DO this — 1 query:
const bulkOps = items.map(item => ({
  updateOne: {
    filter: { _id: item.id },
    update: { $inc: { stock: -item.qty } },
  }
}));
await Inventory.bulkWrite(bulkOps);
```

---

### Pattern: Atomic Increment / Decrement
```js
// DON'T read-then-write (race condition):
const post = await Post.findById(id);
post.viewCount = post.viewCount + 1;
await post.save();

// DO use $inc (atomic):
await Post.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
```

---

### Pattern: findOneAndUpdate vs findById + save
```js
// findById + save — use when:
// - You need Mongoose validators to run on ALL fields
// - You need virtuals on the saved document
// - You're using hooks that depend on field changes

// findOneAndUpdate — use when:
// - Updating specific fields only
// - Performance matters
// - Atomic operations ($inc, $push, $set)
// Note: add { runValidators: true } to run validators on updated fields
```

---

## Index Patterns

### Pattern: Partial Index
Only index documents matching a condition — saves space and write overhead.
```js
// Index only active users — saves index size if many users are inactive
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
```

### Pattern: TTL Index
Auto-delete documents after a time period.
```js
// Sessions expire after 24 hours
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
```

### Pattern: Text Index for Search
```js
ProductSchema.index({ name: 'text', description: 'text' }, { weights: { name: 10, description: 1 } });

// Query:
await Product.find({ $text: { $search: 'wireless headphones' } })
  .sort({ score: { $meta: 'textScore' } });
```
**Note:** Text indexes are expensive. For production search, consider Elasticsearch or Atlas Search.

---

## Schema Patterns

### Pattern: Discriminators for Polymorphism
```js
const EventSchema = new Schema({ 
  userId: ObjectId,
  timestamp: Date,
  type: String,
}, { discriminatorKey: 'type', timestamps: true });

const Event = mongoose.model('Event', EventSchema);
const PurchaseEvent = Event.discriminator('purchase', new Schema({ amount: Number, currency: String }));
const LoginEvent = Event.discriminator('login', new Schema({ ip: String, device: String }));
```

### Pattern: Soft Delete
```js
const DocumentSchema = new Schema({
  deletedAt: { type: Date, default: null },
  deletedBy: { type: ObjectId, ref: 'User', default: null },
});

// Add to all queries automatically:
DocumentSchema.pre('find', function() {
  this.where({ deletedAt: null });
});

// To actually delete:
await doc.updateOne({ deletedAt: new Date(), deletedBy: userId });
```

---

## Connection Patterns

### Pattern: Graceful Connection Management
```js
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,  // Force IPv4
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
```

### Pattern: Read Preference for Analytics
```js
// Don't hit primary with heavy analytics queries
await Order.find({ status: 'completed' })
  .read('secondaryPreferred')
  .lean();
```

---

## Validation Patterns

### Pattern: Custom Validators
```js
const UserSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format',
    },
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age seems too high'],
  },
});
```

### Pattern: Async Validators (Check Uniqueness)
```js
username: {
  type: String,
  validate: {
    validator: async function(v) {
      const count = await this.constructor.countDocuments({ username: v });
      return count === 0;
    },
    message: 'Username already taken',
  }
}
```
Note: Prefer unique indexes over async validators for uniqueness — validators have race conditions.
