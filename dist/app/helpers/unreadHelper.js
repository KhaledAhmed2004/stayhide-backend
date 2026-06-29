"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchGetUnreadCounts = exports.clearUnreadCount = exports.incrementUnreadCount = exports.setUnreadCount = exports.getUnreadCountCached = void 0;
/**
 * unreadHelper — Redis-backed unread count helpers.
 *
 * Replaces the previous node-cache implementation so that unread counts
 * survive process restarts and work correctly in multi-process deployments.
 *
 * Key pattern: unread:{chatId}:{userId}  (no TTL — persistent)
 *
 * NOTE: presenceHelper.ts (online/offline tracking) intentionally continues
 * to use node-cache because presence data is ephemeral by design.
 */
const redisClient_1 = require("../../shared/redisClient");
const unreadKey = (chatId, userId) => `unread:${chatId}:${userId}`;
/**
 * Returns the cached unread count for a user in a chat, or null when the key
 * does not exist in Redis.
 */
const getUnreadCountCached = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const raw = yield redisClient_1.redisClient.get(unreadKey(chatId, userId));
    if (raw === null)
        return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
});
exports.getUnreadCountCached = getUnreadCountCached;
/**
 * Sets the unread count for a user in a chat to an explicit value.
 * Passing 0 effectively resets the badge.
 */
const setUnreadCount = (chatId, userId, count) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.set(unreadKey(chatId, userId), String(Math.max(0, count)));
});
exports.setUnreadCount = setUnreadCount;
/**
 * Atomically increments the unread count for a user in a chat by `delta`.
 * Returns the new value.
 */
const incrementUnreadCount = (chatId, userId, delta) => __awaiter(void 0, void 0, void 0, function* () {
    const key = unreadKey(chatId, userId);
    const next = yield redisClient_1.redisClient.incrby(key, delta);
    return Math.max(0, next);
});
exports.incrementUnreadCount = incrementUnreadCount;
/**
 * Deletes the unread count key for a user in a chat entirely.
 * Prefer setUnreadCount(chatId, userId, 0) for a soft reset.
 */
const clearUnreadCount = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.del(unreadKey(chatId, userId));
});
exports.clearUnreadCount = clearUnreadCount;
/**
 * Batch-fetches unread counts for multiple (chatId, userId) pairs in a single
 * Redis MGET call.  Returns 0 for any key that does not exist.
 *
 * @param pairs - Array of { chatId, userId } tuples
 * @returns Array of non-negative integers in the same order as `pairs`
 */
const batchGetUnreadCounts = (pairs) => __awaiter(void 0, void 0, void 0, function* () {
    if (pairs.length === 0)
        return [];
    const keys = pairs.map(({ chatId, userId }) => unreadKey(chatId, userId));
    const results = yield redisClient_1.redisClient.mget(...keys);
    return results.map(raw => {
        if (raw === null)
            return 0;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    });
});
exports.batchGetUnreadCounts = batchGetUnreadCounts;
