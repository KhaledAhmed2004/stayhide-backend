# REST Principles, Naming, Methods & Headers

Industry-standard REST design rules. Read this for naming decisions, method/status-code choices, versioning, caching, idempotency, and HTTP headers.

---

## 1. Resource Naming — Complete Rules

### Core rules
- **Nouns only, never verbs** in resource paths — a URL names a thing, not an action
- **Plural** for all collections: `/users`, `/clubs`, `/bookings`
- **Lowercase kebab-case**: `/turf-bookings`, `/user-profiles`
- **No file extensions**: never `/users.json`
- **No trailing slashes**: `/clubs` not `/clubs/`

### Path parameter names — must be meaningful
**Never use bare `:id`.** Always name the param after the resource it identifies: `:userId`, `:clubId`, `:bookingId`, `:cardId`. The reasons:
- **Self-documenting** — `req.params.userId` reads correctly anywhere; `req.params.id` forces the reader to scroll up to see *which* id.
- **Nested routes get unambiguous** — in `/clubs/:clubId/members/:memberId`, both params have distinct names. If both were `:id`, Express would silently overwrite.
- **Refactor safety** — searching for `clubId` finds every consumer; searching for `id` finds half the codebase.
- **Validation pairs cleanly** — `z.object({ params: z.object({ userId: z.string() }) })` matches the route literally.

```
✅  GET    /api/v1/users/:userId
✅  PATCH  /api/v1/clubs/:clubId
✅  DELETE /api/v1/bookings/:bookingId
❌  GET    /api/v1/users/:id
❌  PATCH  /api/v1/clubs/:id
```

In controllers / services, destructure by the same name:
```typescript
const { userId } = req.params;          // ✅
const result = await UserService.getById(userId);

const { id } = req.params;              // ❌ — what id?
```

### Path depth
```
/api/v1/clubs                              ✅ collection
/api/v1/clubs/:clubId                      ✅ single resource
/api/v1/clubs/:clubId/members              ✅ sub-resource (clear ownership)
/api/v1/clubs/:clubId/members/:memberId    ✅ single sub-resource
```

Keep nesting to **≤ 2 levels**. Deeper nesting makes URLs unreadable and hard to maintain. Beyond 2 levels, flatten using query params:
```
❌  /api/v1/clubs/:id/members/:mId/stats/:sId
✅  /api/v1/member-stats?memberId=X&clubId=Y
```

### Verb endpoints (non-CRUD state transitions)
Use `POST /:resourceId/{verb}` for actions that transition resource state. The `POST` on a sub-path signals "this does something" rather than "this is a resource". **Reach for this only when the action genuinely cannot be modeled as a field update** — most state changes are better as `PATCH /:resourceId` with the field in the body.
```
POST /api/v1/bookings/:bookingId/cancel      ✅
POST /api/v1/orders/:orderId/approve         ✅
POST /api/v1/users/:userId/deactivate        ✅
POST /api/v1/auth/login                      ✅
POST /api/v1/auth/logout                     ✅
POST /api/v1/auth/refresh-token              ✅
```

### Batch operations
```
POST /api/v1/clubs/batch-delete       body: { ids: [...] }
POST /api/v1/notifications/mark-read  body: { ids: [...] }
```
Never `DELETE /api/v1/clubs?ids=1,2,3` — DELETE with a body is non-standard and poorly supported by clients and proxies.

### Search endpoint
When filtering is complex (multi-field, full-text, spatial):
```
GET  /api/v1/clubs/search?q=dhaka&sport=football      (simple search via query string)
POST /api/v1/clubs/search   body: { filters, sort }   (complex search with a body)
```

---

## 2. HTTP Methods — Full Semantics

| Method | Idempotent | Safe | Cacheable | Use For |
|--------|-----------|------|-----------|---------|
| GET | ✅ | ✅ | ✅ | Retrieve only — never modify |
| POST | ❌ | ❌ | ❌ | Create, or non-idempotent actions |
| PUT | ✅ | ❌ | ❌ | Full replace of a resource |
| PATCH | ❌* | ❌ | ❌ | Partial update (project default) |
| DELETE | ✅ | ❌ | ❌ | Remove resource |
| HEAD | ✅ | ✅ | ✅ | Like GET but no body (exists/health checks) |
| OPTIONS | ✅ | ✅ | ✅ | CORS preflight — handled by `cors()` middleware |

*PATCH is not inherently idempotent, but can be made so with `Idempotency-Key`.

**Project convention: always prefer PATCH over PUT.** PUT requires the client to send the entire object, which is wasteful and error-prone. PATCH lets the client send only the changed fields.

```typescript
// PUT — client must send ALL fields (risky: accidentally blanks unset fields)
PUT /api/v1/users/123  { "name": "Khaled", "email": "k@x.com", "role": "admin" }

// PATCH — client sends only what changed (correct approach)
PATCH /api/v1/users/123  { "email": "new@x.com" }
```

---

## 3. Idempotency

**What it means**: repeating the same request N times produces the same result as sending it once. This matters because networks fail and clients retry — idempotent operations make retries safe.

### Naturally idempotent
- GET, HEAD, OPTIONS — read-only, always safe to retry
- PUT, DELETE — same payload → same result

### Making POST/PATCH idempotent with `Idempotency-Key`
Use this for critical writes where duplicate execution would be harmful — payments, bookings, notifications sent to users.

```typescript
// Client sends a unique key with the request:
// POST /api/v1/bookings
// Idempotency-Key: a7f3c2d1-4e5b-6789-abcd-ef0123456789

// middleware/idempotency.ts
import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['idempotency-key'] as string;
  if (!key) return next(); // key is optional — only protect routes that need it

  const cached = await redis.get(`idem:${key}`);
  if (cached) {
    // Replay the stored response — no duplicate processing
    const stored = JSON.parse(cached);
    return res.status(stored.statusCode).json(stored.body);
  }

  // Intercept res.json to capture the response before sending
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode < 500) {
      // Store for 24h — covers reasonable retry windows
      redis.setex(`idem:${key}`, 86400, JSON.stringify({ statusCode: res.statusCode, body }));
    }
    return originalJson(body);
  };

  next();
};

// Apply to routes where duplicates matter:
router.post('/', auth(USER_ROLES.USER), idempotencyMiddleware, validateRequest(BookingValidation.createSchema), BookingController.create);
```

---

## 4. API Versioning

### Strategy: URI versioning (project convention)
```
/api/v1/clubs    ← current stable
/api/v2/clubs    ← new version with breaking changes
```

URI versioning is explicit, easy to debug, and works perfectly with any HTTP client or proxy — that's why it's the industry default.

### When to bump the version (breaking changes)
- Removing or renaming a response field
- Changing a field's type (string → number)
- Removing an endpoint
- Making a previously optional field required

### What does NOT require a version bump (safe changes)
- Adding new optional response fields
- Adding new optional query params
- Adding entirely new endpoints
- Performance improvements, bug fixes

### Deprecation — warn consumers before removing
```typescript
// Add to any endpoint you're planning to remove
res.set('Deprecation', 'true');
res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
res.set('Link', '</api/v2/clubs>; rel="successor-version"');
```

---

## 5. Response Headers

### Every response
```
Content-Type: application/json; charset=utf-8
X-Request-ID: <uuid>          ← attach to every log entry for end-to-end tracing
```

### Implementing `X-Request-ID`
```typescript
// src/middlewares/requestId.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.set('X-Request-ID', requestId);
  next();
};
// Register FIRST in app.ts — before all other middleware
```

### Cache-Control for GET endpoints
```typescript
// Static/public reference data (sport categories, turf types, config)
res.set('Cache-Control', 'public, max-age=3600');
res.set('ETag', `"${generateETag(data)}"`);

// User-specific or sensitive data (bookings, profiles)
res.set('Cache-Control', 'private, no-store');

// Mutations (POST, PATCH, DELETE responses)
res.set('Cache-Control', 'no-store');
```

### Rate limit headers — return on every response
```
RateLimit-Limit: 300
RateLimit-Remaining: 142
RateLimit-Reset: 1700000000    ← Unix timestamp
Retry-After: 45                ← seconds, only on 429 responses
```

### Location header on 201 Created
```typescript
// Tell clients exactly where to find the newly created resource
res.set('Location', `/api/v1/clubs/${result._id}`);
sendResponse(res, { success: true, statusCode: StatusCodes.CREATED, ... });
```

---

## 6. Content Negotiation

Always send and accept JSON. Enforce `Content-Type` validation on mutating requests to prevent unformatted or multipart data from leaking into the service layer unexpectedly:

```typescript
// src/middlewares/contentType.ts
export const requireJson = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'];
    if (!ct || !ct.includes('application/json')) {
      throw new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Content-Type must be application/json');
    }
  }
  next();
};
// (Do NOT apply this to file-upload routes — see uploads.md)
```

---

## 7. Statelessness

Every request must carry all the information needed to process it. There must be no server-side session state — this is what enables horizontal scaling.

- Use JWT bearer tokens: `Authorization: Bearer <token>`
- JWT payload: `{ userId, role, iat, exp }` — nothing sensitive
- Never use server-side sessions for API auth (cookies are fine for web-only sessions)

---

## 8. HATEOAS — Pragmatic Approach

Full HATEOAS (every response carries a full hypermedia map) adds significant complexity with limited practical value in most codebases. The industry pragmatic approach: add a lightweight `_links` object to resource responses for clearly related sub-resources that clients regularly navigate to.

```json
{
  "success": true,
  "data": {
    "_id": "abc123",
    "name": "Dhaka FC",
    "_links": {
      "self": "/api/v1/clubs/abc123",
      "members": "/api/v1/clubs/abc123/members",
      "tournaments": "/api/v1/clubs/abc123/tournaments"
    }
  }
}
```

Apply `_links` when: the resource has 2+ sub-resources clients frequently navigate. Skip when: internal API where clients already know the URL structure.

---

## 9. Health & Readiness Endpoints

Every production service needs at least two probes. Health checks tell load balancers and orchestrators (Docker, Kubernetes) whether to route traffic to this instance.

```typescript
// src/routes/health.routes.ts
import express from 'express';
import mongoose from 'mongoose';
import redis from '../config/redis';

const router = express.Router();

// Liveness — is the Node.js process alive?
// Load balancers hit this every ~10s. Keep it fast — no DB call.
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness — can this instance serve traffic right now?
// Only returns 200 when ALL dependencies are reachable.
router.get('/ready', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  const redisOk = redis.status === 'ready';

  if (!dbOk || !redisOk) {
    return res.status(503).json({
      status: 'not ready',
      db: dbOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    });
  }

  res.status(200).json({ status: 'ready', db: 'connected', redis: 'connected' });
});

export const HealthRoutes = router;

// Register in app.ts OUTSIDE versioned routes (no auth, no rate limit):
// app.use('/api', HealthRoutes);
```

---

## 10. Common Anti-Patterns

| Anti-pattern | Why it's wrong | Correct approach |
|---|---|---|
| `GET /deleteUser/:id` | GET must be safe — no side effects | `DELETE /users/:userId` |
| `POST /users/getAll` | Defeats HTTP caching and semantics | `GET /users` |
| Bare `:id` in any route | Ambiguous; collides in nested routes; harder to grep | Name it: `:userId`, `:clubId`, `:bookingId` |
| Separate `/block` + `/unblock` routes | Doubles surface for one boolean; drifts out of sync | `PATCH /users/:userId` with `{ status }` |
| `PUT` for partial updates | Client must send entire object | `PATCH` |
| `200 OK` with `{ success: false }` | Status code contradicts body | Use correct 4xx |
| `500` for business rule violations | 500 means unexpected/unhandled | `400`, `404`, `409`, `422` |
| Nesting > 2 levels | Unreadable, fragile to refactor | Flatten with query params |
| Mixing camelCase and snake_case | Inconsistent — breaks client code | Always camelCase in JSON |
| Returning passwords/secrets in response | Security vulnerability | Strip with `.select('-password')` |
| DB error messages in prod responses | Leaks schema/implementation details | Global error handler scrubs them |
| Hard delete for records with audit needs | Unrecoverable, breaks referential integrity | Soft delete with `isDeleted` |
