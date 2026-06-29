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
import { redisClient } from '../../shared/redisClient';

const unreadKey = (chatId: string, userId: string): string =>
  `unread:${chatId}:${userId}`;

/**
 * Returns the cached unread count for a user in a chat, or null when the key
 * does not exist in Redis.
 */
export const getUnreadCountCached = async (
  chatId: string,
  userId: string
): Promise<number | null> => {
  const raw = await redisClient.get(unreadKey(chatId, userId));
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/**
 * Sets the unread count for a user in a chat to an explicit value.
 * Passing 0 effectively resets the badge.
 */
export const setUnreadCount = async (
  chatId: string,
  userId: string,
  count: number
): Promise<void> => {
  await redisClient.set(unreadKey(chatId, userId), String(Math.max(0, count)));
};

/**
 * Atomically increments the unread count for a user in a chat by `delta`.
 * Returns the new value.
 */
export const incrementUnreadCount = async (
  chatId: string,
  userId: string,
  delta: number
): Promise<number> => {
  const key = unreadKey(chatId, userId);
  const next = await redisClient.incrby(key, delta);
  return Math.max(0, next);
};

/**
 * Deletes the unread count key for a user in a chat entirely.
 * Prefer setUnreadCount(chatId, userId, 0) for a soft reset.
 */
export const clearUnreadCount = async (
  chatId: string,
  userId: string
): Promise<void> => {
  await redisClient.del(unreadKey(chatId, userId));
};

/**
 * Batch-fetches unread counts for multiple (chatId, userId) pairs in a single
 * Redis MGET call.  Returns 0 for any key that does not exist.
 *
 * @param pairs - Array of { chatId, userId } tuples
 * @returns Array of non-negative integers in the same order as `pairs`
 */
export const batchGetUnreadCounts = async (
  pairs: Array<{ chatId: string; userId: string }>
): Promise<number[]> => {
  if (pairs.length === 0) return [];
  const keys = pairs.map(({ chatId, userId }) => unreadKey(chatId, userId));
  const results = await redisClient.mget(...keys);
  return results.map(raw => {
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  });
};

