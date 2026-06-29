# Infrastructure — Error Handling, Logging & Testing

Read this when setting up error infrastructure from scratch, adding logging, or writing tests for API endpoints.

---

## 1. Core Infrastructure Files

These three files underpin everything — every other file in the project depends on them.

### `src/shared/catchAsync.ts`

`catchAsync` wraps every async controller in a try-catch so unhandled promise rejections are automatically forwarded to `globalErrorHandler`. Without this, an uncaught async error crashes the Node process or silently fails.

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next); // forwards all errors to globalErrorHandler
  };

export default catchAsync;
```

### `src/errors/ApiError.ts`

A typed error class that carries an HTTP status code. Throwing `ApiError` is the only correct way to signal an expected error (not found, forbidden, conflict) — it distinguishes business logic errors from unexpected bugs.

```typescript
class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string, stack?: string) {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
```

### `src/errors/globalErrorHandler.ts`

The single place where all errors are formatted and sent as responses. It handles three categories: Zod validation errors, known `ApiError`s (expected failures), and unknown errors (bugs). Stack traces are only shown in development.

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import ApiError from './ApiError';
import logger from '../shared/logger';

type TErrorMessage = { path: string; message: string };

const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errorMessages: TErrorMessage[] = [];

  // Zod validation error — triggered by validateRequest middleware
  if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation Error';
    errorMessages = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  // Known business error — thrown intentionally with ApiError
  else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorMessages = [{ path: '', message: err.message }];
  }

  // Mongoose CastError (invalid ObjectId in URL params)
  else if (err.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid ID format';
    errorMessages = [{ path: '', message }];
  }

  // Mongoose duplicate key (unique index violation)
  else if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? 'field';
    statusCode = StatusCodes.CONFLICT;
    message = `Duplicate value for ${field}`;
    errorMessages = [{ path: field, message }];
  }

  // Unknown error — log the full error for debugging
  else {
    logger.error({ err, requestId: req.headers['x-request-id'] }, 'Unhandled error');
    errorMessages = [{ path: '', message }];
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorMessages,
    // Stack trace only in development — never expose internals in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default globalErrorHandler;
```

### `src/middlewares/validateRequest.ts`

```typescript
import { AnyZodObject, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';

const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      next(err); // ZodError — globalErrorHandler handles it
    }
  };

export default validateRequest;
```

---

## 2. Structured Logging with Pino

`console.log` in production has no structure — it can't be filtered, queried, or aggregated. Pino gives every log a level, timestamp, and request ID so you can trace any request end-to-end across logs.

### Install
```bash
npm install pino pino-pretty
```

### `src/shared/logger.ts`

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } } // human-readable in dev
      : undefined, // JSON in production (structured, parseable by log aggregators)
  redact: ['req.headers.authorization', 'body.password', 'body.token'], // never log secrets
});

export default logger;
```

### Request logging middleware

```typescript
// src/middlewares/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../shared/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${Date.now() - start}ms`,
      requestId: req.headers['x-request-id'],
      userId: (req as any).user?.userId,
    });
  });

  next();
};
```

### Using the logger in services

```typescript
import logger from '../../shared/logger';

// Info — important domain events (creates, deletes, state changes)
logger.info({ id: result._id, action: 'club.create' }, 'Club created');

// Warn — recoverable issues worth investigating
logger.warn({ id, action: 'booking.cancel', reason: payload.reason }, 'Booking cancelled by user');

// Error — unexpected failures (caught by globalErrorHandler for unhandled errors)
logger.error({ err, userId }, 'Payment processing failed unexpectedly');

// Debug — verbose detail for development only
logger.debug({ query: req.query }, 'Executing club search');
```

### Log levels guide

| Level | When to use |
|-------|------------|
| `error` | Unexpected failure needing immediate attention |
| `warn` | Recoverable problem; unusual but not broken |
| `info` | Normal important event (resource created, user logged in) |
| `debug` | Verbose details for development debugging only |

**Never log**: passwords, tokens, full credit card numbers, personal data (phone, NID) — Pino's `redact` config strips `authorization` headers and `password` fields automatically.

---

## 3. Register Everything in `app.ts`

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { globalLimiter } from './config/rateLimiter';
import { requestIdMiddleware } from './middlewares/requestId';
import { requestLogger } from './middlewares/requestLogger';
import globalErrorHandler from './errors/globalErrorHandler';
import router from './routes';
import { HealthRoutes } from './routes/health.routes';

const app = express();

// ① Request ID — first, so every log that follows includes it
app.use(requestIdMiddleware);

// ② Security headers
app.use(helmet());
app.disable('x-powered-by');

// ③ CORS
app.use(cors(corsOptions));

// ④ Rate limiting
app.use('/api', globalLimiter);

// ⑤ Body parsing (10kb limit prevents payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ⑥ Request logging
app.use(requestLogger);

// ⑦ Health routes (no auth, no rate limit)
app.use('/api', HealthRoutes);

// ⑧ Versioned API routes
app.use('/api/v1', router);

// ⑨ Global error handler — always last
app.use(globalErrorHandler);

export default app;
```

---

## 4. Testing with Jest + Supertest

Tests verify that your routes actually behave as documented. Supertest lets you make real HTTP requests to your Express app in tests without running a server — it's the standard for Express API testing.

### Install
```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

### `jest.config.ts`
```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
};
```

### `src/__tests__/setup.ts`
```typescript
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clean all collections between tests — tests must be independent
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

### Test template: `src/__tests__/[feature].test.ts`

```typescript
import request from 'supertest';
import app from '../../app';
import { generateTestToken } from '../helpers/auth';

const adminToken = generateTestToken({ userId: 'user1', role: 'ADMIN' });

describe('[Feature] API', () => {
  // ─── GET /api/v1/[features] ───────────────────────────────────────
  describe('GET /api/v1/[features]', () => {
    it('returns paginated list with 200', async () => {
      const res = await request(app)
        .get('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/[features]');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/v1/[features] ──────────────────────────────────────
  describe('POST /api/v1/[features]', () => {
    it('creates resource and returns 201 with Location header', async () => {
      const res = await request(app)
        .post('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test [Feature]', sport: 'football' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.headers.location).toMatch(/\/api\/v1\/\[features\]\//);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sport: 'football' }); // no name

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorMessages[0].path).toBe('body.name');
    });

    it('returns 409 for duplicate name', async () => {
      await request(app)
        .post('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unique Name', sport: 'cricket' });

      const res = await request(app)
        .post('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unique Name', sport: 'cricket' }); // duplicate

      expect(res.status).toBe(409);
    });
  });

  // ─── DELETE (soft delete) ─────────────────────────────────────────
  describe('DELETE /api/v1/[features]/:id', () => {
    it('soft-deletes and returns 200', async () => {
      const create = await request(app)
        .post('/api/v1/[features]')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'To Delete', sport: 'football' });

      const id = create.body.data._id;

      const del = await request(app)
        .delete(`/api/v1/[features]/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(del.status).toBe(200);

      // Verify it's no longer accessible (soft delete filtered by pre-hook)
      const get = await request(app)
        .get(`/api/v1/[features]/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(get.status).toBe(404);
    });
  });
});
```

### Test helper: `src/__tests__/helpers/auth.ts`
```typescript
import jwt from 'jsonwebtoken';

export const generateTestToken = (payload: { userId: string; role: string }) =>
  jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
```

### What to test per endpoint

| Check | Test |
|-------|------|
| Happy path returns correct status + shape | Always |
| Missing required fields → 400 | All POST/PATCH |
| Unknown extra fields → 400 | All POST/PATCH (`.strict()`) |
| No auth token → 401 | All protected routes |
| Wrong role → 403 | RBAC routes |
| Non-existent ID → 404 | GET/:id, PATCH/:id, DELETE/:id |
| Duplicate creation → 409 | POST with unique constraints |
| Soft delete filtered from GET | After DELETE |
| Pagination shape present | GET list |
| Location header on 201 | POST create |
