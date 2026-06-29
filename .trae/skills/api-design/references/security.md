# API Security

Production security for Express/Node.js APIs. Read this for rate limiting, helmet, CORS, JWT hardening, and input protection.

---

## 1. Security Middleware Stack (app.ts setup order matters)

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { requestIdMiddleware } from './middlewares/requestId';

const app = express();

// 1. Request ID — first so all logs include it
app.use(requestIdMiddleware);

// 2. Security headers
app.use(helmet());
app.disable('x-powered-by'); // never reveal framework

// 3. CORS — before routes
app.use(cors(corsOptions));

// 4. Global rate limiter
app.use('/api', globalLimiter);

// 5. Body parsing with size limit
app.use(express.json({ limit: '10kb' }));

// 6. NoSQL injection sanitization
app.use(mongoSanitize());

// 7. Routes
app.use('/api/v1', router);

// 8. Global error handler — always last
app.use(globalErrorHandler);
```

---

## 2. Helmet — Security Headers

```typescript
// src/config/helmet.ts
import helmet from 'helmet';

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,    // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,          // X-Content-Type-Options: nosniff
  xssFilter: true,        // X-XSS-Protection
  frameguard: { action: 'deny' }, // X-Frame-Options
});
```

What helmet sets automatically:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- Removes `X-Powered-By`

---

## 3. CORS — Configuration

```typescript
// src/config/cors.ts
import cors from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
  credentials: true,
  maxAge: 86400, // cache preflight for 24h
};
```

**Never use `cors({ origin: '*' })` in production for authenticated APIs.**

---

## 4. Rate Limiting

### Global limiter (all routes)
```typescript
// src/config/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,                    // 300 req / 15 min per IP
  standardHeaders: true,       // RateLimit-* headers (RFC standard)
  legacyHeaders: false,        // Disable X-RateLimit-* (legacy)
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later.',
  },
  skip: (req) => req.ip === '127.0.0.1', // skip health checks
});
```

### Auth limiter (stricter — login/register/forgot-password)
```typescript
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 10,                    // only 10 auth attempts per window
  skipSuccessfulRequests: true, // don't count successful logins
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts. Try again in 10 minutes.',
  },
});

// Apply to auth routes specifically:
router.post('/login', authLimiter, validateRequest(AuthValidation.loginSchema), AuthController.login);
router.post('/register', authLimiter, validateRequest(AuthValidation.registerSchema), AuthController.register);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
```

### Heavy operation limiter (file upload, export, bulk ops)
```typescript
export const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    statusCode: 429,
    message: 'Rate limit reached for this operation. Try again in 1 hour.',
  },
});
```

### Rate limit headers the client receives:
```
RateLimit-Limit: 300
RateLimit-Remaining: 142
RateLimit-Reset: 1700000000
Retry-After: 45    ← only on 429
```

---

## 5. JWT Hardening

```typescript
// src/helpers/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets must be set in environment variables');
}

export const signAccessToken = (payload: { userId: string; role: string }) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',    // short-lived access token
    algorithm: 'HS256',
  });

export const signRefreshToken = (payload: { userId: string }) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',     // long-lived refresh token
    algorithm: 'HS256',
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
```

**JWT rules:**
- Access token: 15–30 min expiry
- Refresh token: 7 days, stored in httpOnly cookie (not localStorage)
- Never store sensitive data in JWT payload (no passwords, no PII)
- Never use `algorithm: 'none'`
- Secret must be ≥ 32 random characters — use `openssl rand -base64 32`

---

## 6. Input Sanitization

### NoSQL injection (MongoDB)
```typescript
import mongoSanitize from 'express-mongo-sanitize';
app.use(mongoSanitize()); // strips $ and . from req.body, params, query
```

### Prevent oversized payloads
```typescript
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

### Zod already protects against:
- Type coercion attacks (e.g. sending `{ "$gt": "" }` as a string field)
- Unexpected fields via `.strict()`
- XSS via string length limits and type checking

---

## 7. RBAC (Role-Based Access Control)

```typescript
// src/middlewares/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../errors/ApiError';

const auth = (...requiredRoles: string[]) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };

    if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action');
    }

    req.user = decoded;
    next();
  });

// Usage:
router.delete('/:clubId', auth(USER_ROLES.ADMIN), ClubController.remove);
router.patch('/:clubId', auth(USER_ROLES.ADMIN, USER_ROLES.MODERATOR), ClubController.update);
router.get('/', auth(), ClubController.getAll); // any authenticated user
```

---

## 8. Resource-Level Authorization (Object-Level)

After fetching a resource, verify the requester owns it:

```typescript
// In service layer:
const getMyBooking = async (bookingId: string, requesterId: string) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');

  // Object-level auth check
  if (booking.userId.toString() !== requesterId && requesterId !== USER_ROLES.ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have access to this booking');
  }

  return booking;
};
```

---

## 9. Production Security Checklist

- [ ] `helmet()` applied globally
- [ ] CORS locked to specific origins (never `*` in prod)
- [ ] Global rate limiter on all `/api` routes
- [ ] Stricter `authLimiter` on auth endpoints
- [ ] `express.json({ limit: '10kb' })` to prevent payload attacks
- [ ] `mongoSanitize()` for NoSQL injection protection
- [ ] JWT secrets in env vars, never hardcoded
- [ ] Access token expiry ≤ 30 min
- [ ] `x-powered-by` header disabled
- [ ] Stack traces not exposed in production errors
- [ ] Passwords excluded from all responses (`.select('-password')`)
- [ ] HTTPS enforced in production
- [ ] `X-Request-ID` on every request/response for tracing
- [ ] Object-level auth checks in service layer (not just role checks)
