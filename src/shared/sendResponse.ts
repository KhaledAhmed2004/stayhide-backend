import { Response } from 'express';

// Helper to recursively transform keys to camelCase and alias _id to id
const snakeToCamel = (str: string): string =>
  str.replace(/(_\w)/g, m => m[1].toUpperCase());

const formatData = (obj: any, seen = new WeakSet()): any => {
  if (
    obj === null ||
    typeof obj !== 'object' ||
    obj instanceof Date ||
    obj instanceof Buffer
  ) {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return undefined;
  }

  // Handle Mongoose documents/Objects
  if (typeof obj.toObject === 'function') {
    obj = obj.toObject();
  }

  // Handle ObjectId (Mongoose)
  if (obj.constructor && obj.constructor.name === 'ObjectId') {
    return obj.toString();
  }

  // Add to seen set to prevent infinite recursion
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(v => formatData(v, seen));
  }

  return Object.keys(obj).reduce((result: any, key) => {
    let value = obj[key];

    // Recursive call for nested objects/arrays
    value = formatData(value, seen);

    // Alias _id to id
    const newKey = key === '_id' ? 'id' : snakeToCamel(key);

    result[newKey] = value;
    return result;
  }, {});
};

/**
 * Unified API response envelope used by every endpoint in this codebase.
 *
 * Shape:
 * ```json
 * {
 *   "success":    true | false,
 *   "statusCode": 200,
 *   "message":    "Human-readable description",
 *   "meta":       { ...see convention below },
 *   "data":       { ...payload }
 * }
 * ```
 *
 * ── meta convention ──────────────────────────────────────────────────────────
 *
 * `meta` is optional. When present, all fields sit flat at the top level —
 * no nested `pagination` sub-object. See docs/standards/api-response-standard.md for the full
 * contract.
 *
 * Cursor pagination (real-time feeds — notifications, profiles, connections):
 *   { limit, nextCursor, hasNext, ...domainCounts }
 *   e.g. { limit: 10, nextCursor: "abc==", hasNext: true, unreadCount: 3 }
 *
 * Offset pagination (stable admin lists — tickets, broadcasts, user admin):
 *   { page, limit, total, totalPages, hasNext, hasPrev }
 *   e.g. { page: 1, limit: 10, total: 47, totalPages: 5, hasNext: true, hasPrev: false }
 *
 * Domain-only meta (no pagination — metrics, analytics):
 *   { comparisonPeriod, ...otherDomainFields }
 *   e.g. { comparisonPeriod: "month" }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
type IData<T> = {
  success: boolean;
  statusCode: number;
  message?: string;
  meta?: Record<string, unknown>;
  data?: T;
};

const sendResponse = <T>(res: Response, data: IData<T>) => {
  // 👇 store full response data for logger middleware
  res.locals.responsePayload = data;

  const resData = {
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    meta: data.meta,
    data: data.data ? formatData(data.data) : data.data,
  };

  res.status(data.statusCode).json(resData);
};

export default sendResponse;
