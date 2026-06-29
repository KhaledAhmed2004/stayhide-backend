# API Audit Checklist

Run this when reviewing existing API code. Work layer by layer, severity by severity.

---

## How to Run an Audit

1. **Gather** — collect `routes.ts`, `controller.ts`, `service.ts`, `validation.ts`. Audit what's available and flag missing layers.
2. **Check** — go through the checklist, marking each item ✅ / ❌ / ⚠️.
3. **Report** — use the format at the bottom of this file.
4. **Offer to fix** — end with: *"Want me to fix all violations now? I'll rewrite the affected files with everything resolved."*

---

## 🔴 Critical — Fix before merge (breaks security or contract)

### Routes layer

**Auth middleware on every protected route**
Without `auth(USER_ROLES.X)`, any unauthenticated request gets through. This is a silent security hole — the endpoint appears to work but has no access control.
- [ ] Every route that should be protected has `auth(...)` before the controller

**Validation middleware on every mutating route**
`validateRequest()` runs Zod before the request reaches the service. Without it, malformed or malicious input (wrong types, extra fields, oversized strings) goes straight into the database.
- [ ] All POST / PATCH / PUT routes have `validateRequest(...)` before the controller
- [ ] All GET list routes have `validateRequest(...)` for query params

**No business logic in route files**
Route files wire middleware chains together. If business logic lives here, it can't be tested, reused, or easily audited. Only middleware + controller references belong in routes.
- [ ] Route files contain only `router.method(path, ...middlewares, controller)` — nothing else

### Controller layer

**Every async method wrapped in `catchAsync`**
Without `catchAsync`, any unhandled promise rejection in a controller bypasses `globalErrorHandler` — in older Express versions it crashes the process silently; in newer ones it returns a 500 with no useful error message.
- [ ] Every controller method is wrapped in `catchAsync`

**All responses via `sendResponse()` — never raw `res.json()`**
`sendResponse()` enforces the standard `{ success, statusCode, message, data, pagination }` shape. Raw `res.json()` breaks the contract that clients depend on and is untestable against the standard format.
- [ ] No `res.json(...)` or `res.send(...)` — only `sendResponse()`

**Correct status codes**
`201` for resource creation (tells clients and caches something was created), `200` for everything else. Returning `200` for a create misleads clients and breaks HTTP semantics.
- [ ] `StatusCodes.CREATED` (201) used for POST create endpoints
- [ ] No `204 No Content` with a response body (204 means truly empty)

**No direct DB calls in controllers**
Controllers translate between HTTP and the service layer. DB calls in controllers make the logic untestable without a live DB and impossible to reuse outside HTTP.
- [ ] All DB operations are in the service layer, not the controller

**Errors thrown as `ApiError`, not manually sent**
`throw new ApiError(...)` lets `globalErrorHandler` format all errors consistently. Manual `res.status(x).json(...)` in a controller bypasses the handler, breaks the error shape, and risks inconsistent messages.
- [ ] No manual `res.status(x).json({ success: false, ... })` in controllers

### Service layer

**`ApiError` for all not-found and business rule violations**
`throw new Error(...)` (base Error) sends a `500 Internal Server Error`. These are expected, known conditions that should send `404`, `403`, or `409` — `ApiError` carries the right status code.
- [ ] All expected failures use `throw new ApiError(StatusCodes.X, 'message')`
- [ ] No `throw new Error(...)` in services

**Services are framework-agnostic**
No `req` or `res` in service files. Services should be callable from a REST controller, a WebSocket handler, a background job, or a unit test — none of which have an Express `req`.
- [ ] No `Request` or `Response` imports in service files

**Object-level authorization in service, not just middleware-level**
Middleware checks the role ("is this user an ADMIN?"). Services must also check ownership ("does this user own *this specific resource*?"). Missing this means any authenticated user can edit any other user's data.
- [ ] Resources that have an owner are checked: `item.createdBy.toString() === requesterId`

**Multi-step writes use transactions**
If a service does two or more DB writes and the second one fails, without a transaction the first write is committed — leaving data in a corrupt partial state.
- [ ] Any service function with 2+ writes uses a Mongoose session/transaction

### Validation layer

**Zod schemas use `.strict()` on body objects**
Without `.strict()`, unknown extra fields pass through silently. This enables mass-assignment vulnerabilities where a client sends `{ role: 'ADMIN' }` alongside valid fields and it gets saved.
- [ ] All body schemas use `.strict()`

**Schemas in validation files, not inlined in routes**
Inlined schemas can't be reused (e.g., in tests), aren't versioned cleanly, and make route files unreadable.
- [ ] All schemas exported from `[feature].validation.ts`

### Security

**No secrets returned in any response**
Passwords, tokens, or any credential returned in a response is a critical leak.
- [ ] `.select('-password')` used on all user queries
- [ ] No token or secret fields in any response body

**Stack traces hidden in production**
Stack traces reveal file paths, line numbers, and implementation details — attackers use this to map the codebase. `globalErrorHandler` should only include `stack` when `NODE_ENV === 'development'`.
- [ ] Production error responses do not include `stack`

---

## 🟡 Warning — Should fix (degrades consistency or DX)

**URL naming**
- [ ] Plural noun, kebab-case: `/user-profiles` not `/userProfile`
- [ ] No verbs in base paths: `/users` not `/getUsers`
- [ ] **Path params are meaningful — `:userId` / `:clubId`, never bare `:id`** (collides in nested routes, harder to grep, ambiguous in controllers)
- [ ] **No `/block` + `/unblock` style mirrored pairs** for one boolean — collapse to `PATCH /:resourceId` with the field in the body
- [ ] Nesting ≤ 2 levels
- [ ] Versioned: `/api/v1/...`

**Controller quality**
- [ ] Response messages: sentence-case, past-tense, no trailing period (`"Club retrieved successfully"`)
- [ ] `pagination` present on all list responses
- [ ] `Location` header set on 201 Created responses
- [ ] No `console.log` — use `logger.info/warn/error`

**Service quality**
- [ ] No `console.log` — use the logger
- [ ] `.lean()` on read-only queries (30% faster, prevents accidental mutations)
- [ ] `QueryBuilder` for list endpoints — no manual `.skip().limit()`
- [ ] `Promise.all` for independent parallel DB calls

**Model quality**
- [ ] `isDeleted` + `deletedAt` fields present (soft delete)
- [ ] Pre-hook filtering `{ isDeleted: false }` in place
- [ ] `toJSON` transform removes `__v`, `isDeleted`, `deletedAt`
- [ ] Indexes on filtered/sorted fields

---

## 🔵 Suggestion — Raises quality

- [ ] `X-Request-ID` middleware wired up in `app.ts`
- [ ] Pino logger configured (`src/shared/logger.ts`)
- [ ] `helmet()` applied globally
- [ ] Rate limiter applied: global + stricter auth limiter
- [ ] `idParamSchema` validates `:id` params on GET/:id, PATCH/:id, DELETE/:id
- [ ] Service functions have explicit return types
- [ ] Zod fields have `.describe()` for future OpenAPI generation
- [ ] Health + readiness endpoints (`/api/health`, `/api/ready`)
- [ ] Jest + Supertest tests for happy path + validation + auth on each endpoint

---

## Audit Report Format

```
## API Audit: [Feature Name]

### Summary
Files reviewed: [list]
Violations: X Critical · Y Warnings · Z Suggestions

---
### 🔴 Critical

[routes.ts ~L18] Missing auth on DELETE route
→ Any request can delete resources. Add `auth(USER_ROLES.ADMIN)` before the controller.

[controller.ts ~L42] `res.json()` instead of `sendResponse()`
→ Breaks the standard response contract. Replace with `sendResponse(res, { success: true, statusCode: StatusCodes.OK, ... })`.

---
### 🟡 Warnings

[routes.ts] URL `/api/v1/getClubs` uses verb in resource path
→ Rename to `/api/v1/clubs`.

[service.ts] `throw new Error('not found')` returns 500
→ Replace with `throw new ApiError(StatusCodes.NOT_FOUND, 'Club not found')`.

---
### 🔵 Suggestions

[service.ts] No explicit return type on `getAll`
→ Add `Promise<{ data: Club[]; pagination: TPagination }>`.

---
### Verdict
[One sentence. E.g.: "2 critical security gaps — this is not safe to ship without fixing auth and the error handling."]
```

---

## Violation Quick-Reference

| Violation | Root cause | Fix |
|-----------|-----------|-----|
| `res.json(...)` | Bypasses response contract | `sendResponse()` |
| `throw new Error(...)` | Sends 500 for known conditions | `throw new ApiError(StatusCodes.X, '...')` |
| No `validateRequest` on POST | Unvalidated input reaches DB | Add Zod schema + middleware |
| No `auth()` on protected route | Unauthenticated access | Add `auth(USER_ROLES.X)` |
| No `.strict()` on body schema | Mass-assignment possible | Add `.strict()` |
| Bare `:id` path param | Ambiguous, collides in nested routes | Rename to `:userId`, `:clubId`, etc. |
| `/block` + `/unblock` mirror routes | Doubles surface for one boolean | `PATCH /:resourceId` body `{ status }` |
| `.find({})` without pagination | Unbounded DB query | Use `QueryBuilder` |
| Business logic in controller | Untestable, unreusable | Move to service |
| `console.log` in code | Unstructured, no log levels | Replace with `logger` |
| Passwords in response | Security leak | `.select('-password')` |
| `throw new Error()` for 404 | Returns 500 instead of 404 | `throw new ApiError(StatusCodes.NOT_FOUND, ...)` |
| Hard delete | Unrecoverable, no audit trail | Soft delete (`isDeleted: true`) |
| No ownership check in service | Any user can modify any record | Check `item.createdBy === requesterId` |
| No idempotency on critical POST | Duplicate processing on retry | Add `Idempotency-Key` middleware |
