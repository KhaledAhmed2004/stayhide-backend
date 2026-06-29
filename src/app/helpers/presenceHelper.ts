import { redisClient } from '../../shared/redisClient';

const ONLINE_SET = 'presence:online';
const LAST_ACTIVE_KEY = (userId: string) => `presence:lastActive:${userId}`;
const USER_ROOMS_KEY = (userId: string) => `presence:userRooms:${userId}`;
const CONN_COUNT_KEY = (userId: string) => `presence:connCount:${userId}`;

export const setOnline = async (userId: string): Promise<void> => {
  await redisClient.sadd(ONLINE_SET, userId);
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const setOffline = async (userId: string): Promise<void> => {
  await redisClient.srem(ONLINE_SET, userId);
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const updateLastActive = async (userId: string): Promise<void> => {
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const isOnline = async (userId: string): Promise<boolean> => {
  const result = await redisClient.sismember(ONLINE_SET, userId);
  return result === 1;
};

export const getLastActive = async (userId: string): Promise<number | undefined> => {
  const raw = await redisClient.get(LAST_ACTIVE_KEY(userId));
  if (raw === null) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
};

export const addUserRoom = async (userId: string, chatId: string): Promise<void> => {
  await redisClient.sadd(USER_ROOMS_KEY(userId), chatId);
};

export const removeUserRoom = async (userId: string, chatId: string): Promise<void> => {
  await redisClient.srem(USER_ROOMS_KEY(userId), chatId);
};

export const getUserRooms = async (userId: string): Promise<string[]> => {
  return redisClient.smembers(USER_ROOMS_KEY(userId));
};

export const clearUserRooms = async (userId: string): Promise<void> => {
  await redisClient.del(USER_ROOMS_KEY(userId));
};

export const incrConnCount = async (userId: string): Promise<number> => {
  return redisClient.incr(CONN_COUNT_KEY(userId));
};

export const decrConnCount = async (userId: string): Promise<number> => {
  const result = await redisClient.decr(CONN_COUNT_KEY(userId));
  if (result < 0) {
    await redisClient.set(CONN_COUNT_KEY(userId), '0');
    return 0;
  }
  return result;
};

export const getConnCount = async (userId: string): Promise<number> => {
  const raw = await redisClient.get(CONN_COUNT_KEY(userId));
  if (raw === null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
