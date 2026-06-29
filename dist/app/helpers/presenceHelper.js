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
exports.getConnCount = exports.decrConnCount = exports.incrConnCount = exports.clearUserRooms = exports.getUserRooms = exports.removeUserRoom = exports.addUserRoom = exports.getLastActive = exports.isOnline = exports.updateLastActive = exports.setOffline = exports.setOnline = void 0;
const redisClient_1 = require("../../shared/redisClient");
const ONLINE_SET = 'presence:online';
const LAST_ACTIVE_KEY = (userId) => `presence:lastActive:${userId}`;
const USER_ROOMS_KEY = (userId) => `presence:userRooms:${userId}`;
const CONN_COUNT_KEY = (userId) => `presence:connCount:${userId}`;
const setOnline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.sadd(ONLINE_SET, userId);
    yield redisClient_1.redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
});
exports.setOnline = setOnline;
const setOffline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.srem(ONLINE_SET, userId);
    yield redisClient_1.redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
});
exports.setOffline = setOffline;
const updateLastActive = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
});
exports.updateLastActive = updateLastActive;
const isOnline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield redisClient_1.redisClient.sismember(ONLINE_SET, userId);
    return result === 1;
});
exports.isOnline = isOnline;
const getLastActive = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const raw = yield redisClient_1.redisClient.get(LAST_ACTIVE_KEY(userId));
    if (raw === null)
        return undefined;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
});
exports.getLastActive = getLastActive;
const addUserRoom = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.sadd(USER_ROOMS_KEY(userId), chatId);
});
exports.addUserRoom = addUserRoom;
const removeUserRoom = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.srem(USER_ROOMS_KEY(userId), chatId);
});
exports.removeUserRoom = removeUserRoom;
const getUserRooms = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return redisClient_1.redisClient.smembers(USER_ROOMS_KEY(userId));
});
exports.getUserRooms = getUserRooms;
const clearUserRooms = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient_1.redisClient.del(USER_ROOMS_KEY(userId));
});
exports.clearUserRooms = clearUserRooms;
const incrConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return redisClient_1.redisClient.incr(CONN_COUNT_KEY(userId));
});
exports.incrConnCount = incrConnCount;
const decrConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield redisClient_1.redisClient.decr(CONN_COUNT_KEY(userId));
    if (result < 0) {
        yield redisClient_1.redisClient.set(CONN_COUNT_KEY(userId), '0');
        return 0;
    }
    return result;
});
exports.decrConnCount = decrConnCount;
const getConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const raw = yield redisClient_1.redisClient.get(CONN_COUNT_KEY(userId));
    if (raw === null)
        return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
});
exports.getConnCount = getConnCount;
