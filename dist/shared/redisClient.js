"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../config"));
/**
 * Shared ioredis client instance.
 *
 * Used by MessageService (unread counts, notification deduplication) and
 * SocketManager (active-chat tracking). ioredis reconnects automatically on
 * connection loss, so callers never need to recreate this instance.
 *
 * Connection URL is read from config.redis_url (env: REDIS_URL).
 * Falls back to redis://127.0.0.1:6379 when the env var is absent.
 */
exports.redisClient = new ioredis_1.default(config_1.default.redis_url, {
    // Suppress unhandled-error events — callers catch errors at the call site
    lazyConnect: false,
    enableOfflineQueue: true,
    connectTimeout: 5000,
    commandTimeout: 2000, // 2s timeout for any command to prevent hanging requests
    maxRetriesPerRequest: 3, // Retry a few times then fail if Redis is down
});
exports.redisClient.on('error', () => {
    // Intentionally left minimal: connection errors are logged by callers.
    // Suppressing the default throw so the process does not crash on Redis
    // unavailability (unread counts degrade gracefully to 0).
});
