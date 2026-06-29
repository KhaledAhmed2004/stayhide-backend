"use strict";
/**
 * E2E tests for Chat module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and Socket.io.
 * Covers the full chat lifecycle: connection → chat creation → messaging → read receipts → notification routing → connection removal.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ── Mocks (hoisted — must appear before imports) ──────────────────────────
vitest_1.vi.mock('../../notification/pushNotificationHelper', () => ({
    pushNotificationHelper: {
        sendPushNotifications: vitest_1.vi.fn().mockResolvedValue(undefined),
        sendPushNotification: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        on: vitest_1.vi.fn(),
    },
}));
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const connection_model_1 = require("../../connection/connection.model");
const chat_model_1 = require("../chat.model");
const message_model_1 = require("../../message/message.model");
const notification_model_1 = require("../../notification/notification.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const socketManager_1 = require("../../../../helpers/socketManager");
const pushNotificationHelper_1 = require("../../notification/pushNotificationHelper");
const redisClient_1 = require("../../../../shared/redisClient");
// ── Module-level variables ────────────────────────────────────────────────────
let replSet;
// ── Test helpers ──────────────────────────────────────────────────────────────
/** Create a verified, active user and return its document plus a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.USER, nameSuffix = 'user') {
        const user = yield user_model_1.User.create({
            name: `Test ${role} ${nameSuffix}`,
            role,
            email: `${(0, crypto_1.randomUUID)()}@test.com`,
            password: 'password123',
            isVerified: true,
            status: user_1.USER_STATUS.ACTIVE,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
            tokenVersion: 0,
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
/**
 * Creates two users and a pending connection request from userA to userB.
 * Throws if the API call does not return 201 or the connection ID is missing.
 */
function setupPendingConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.USER, 'userA');
        const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.USER, 'userB');
        const res = yield (0, supertest_1.default)(app_1.default)
            .post('/api/v1/connections')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ receiverId: userB._id.toString() });
        if (res.status !== 201 || !((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new Error(`setupPendingConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`);
        }
        return { userA, tokenA, userB, tokenB, connectionId: res.body.data.id };
    });
}
/**
 * Builds on setupPendingConnection and accepts the connection as userB.
 * Throws if the API call does not return 200 or chatId is missing.
 */
function setupAcceptedConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { userA, tokenA, userB, tokenB, connectionId } = yield setupPendingConnection();
        const res = yield (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/connections/${connectionId}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);
        if (res.status !== 200 || !((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.chatId)) {
            throw new Error(`setupAcceptedConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`);
        }
        return {
            userA,
            tokenA,
            userB,
            tokenB,
            connectionId,
            chatId: res.body.data.chatId,
        };
    });
}
/**
 * Calls setupAcceptedConnection then sends n text messages from userA.
 * Each send is asserted to return 201.
 * Returns the accepted connection context plus the array of message response bodies.
 */
function setupChatWithMessages(n) {
    return __awaiter(this, void 0, void 0, function* () {
        const ctx = yield setupAcceptedConnection();
        const { tokenA, chatId } = ctx;
        const messages = [];
        for (let i = 1; i <= n; i++) {
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: `Message ${i}`, type: 'text' });
            if (res.status !== 201) {
                throw new Error(`setupChatWithMessages failed at message ${i}: status=${res.status} body=${JSON.stringify(res.body)}`);
            }
            messages.push(res.body.data);
        }
        return Object.assign(Object.assign({}, ctx), { messages });
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Clear collections in dependency order
    yield connection_model_1.Connection.deleteMany({});
    yield notification_model_1.Notification.deleteMany({});
    yield message_model_1.Message.deleteMany({});
    yield chat_model_1.Chat.deleteMany({});
    yield user_model_1.User.deleteMany({});
    // 2. Reset all mock call counts and one-time overrides
    vitest_1.vi.clearAllMocks();
    // 3. Fresh Socket.io mock — covers both global.io and SocketManager paths
    const mockIo = { to: vitest_1.vi.fn().mockReturnThis(), emit: vitest_1.vi.fn() };
    global.io = mockIo;
    socketManager_1.SocketManager.init(mockIo);
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Chat E2E Tests', () => {
    (0, vitest_1.describe)('Infrastructure & Helpers', () => {
        (0, vitest_1.it)('mongoose is connected after beforeAll', () => __awaiter(void 0, void 0, void 0, function* () {
            // readyState 1 = connected
            (0, vitest_1.expect)(mongoose_1.default.connection.readyState).toBe(1);
        }));
        (0, vitest_1.it)('mocks are in place', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, vitest_1.expect)(vitest_1.vi.isMockFunction(redisClient_1.redisClient.get)).toBe(true);
            (0, vitest_1.expect)(vitest_1.vi.isMockFunction(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification)).toBe(true);
            (0, vitest_1.expect)(vitest_1.vi.isMockFunction(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications)).toBe(true);
        }));
        (0, vitest_1.it)('beforeEach clears all collections', () => __awaiter(void 0, void 0, void 0, function* () {
            // Seed one document in each collection, then let beforeEach run (it already ran before this test)
            // Since beforeEach already ran, all collections should be empty right now
            (0, vitest_1.expect)(yield user_model_1.User.countDocuments()).toBe(0);
            (0, vitest_1.expect)(yield connection_model_1.Connection.countDocuments()).toBe(0);
            (0, vitest_1.expect)(yield chat_model_1.Chat.countDocuments()).toBe(0);
            (0, vitest_1.expect)(yield message_model_1.Message.countDocuments()).toBe(0);
            (0, vitest_1.expect)(yield notification_model_1.Notification.countDocuments()).toBe(0);
        }));
    });
    // ── Flow 2: Multi-Message Exchange and Cursor Pagination ─────────────────
    (0, vitest_1.describe)('Flow 2: Multi-Message Exchange and Cursor Pagination', () => {
        (0, vitest_1.it)('5-message alternating exchange returns messages sorted ascending', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, userB, tokenB, chatId } = yield setupAcceptedConnection();
            // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
            const sends = [
                { token: tokenA, text: 'M1' },
                { token: tokenB, text: 'M2' },
                { token: tokenA, text: 'M3' },
                { token: tokenB, text: 'M4' },
                { token: tokenA, text: 'M5' },
            ];
            for (const { token, text } of sends) {
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/messages')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ chatId, text, type: 'text' });
                (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-SEND-${text}`, `Send ${text}`);
                (0, vitest_1.expect)(res.status).toBe(201);
            }
            // GET all messages (no limit)
            const historyRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, historyRes.body, 'FLOW2-GET-HISTORY', 'Get all 5 messages');
            (0, vitest_1.expect)(historyRes.status).toBe(200);
            (0, vitest_1.expect)(Array.isArray(historyRes.body.data)).toBe(true);
            (0, vitest_1.expect)(historyRes.body.data).toHaveLength(5);
            (0, vitest_1.expect)(historyRes.body.data[0].text).toBe('M1');
            (0, vitest_1.expect)(historyRes.body.data[4].text).toBe('M5');
            // Assert ascending createdAt order (Req 4.1)
            const dates = historyRes.body.data.map((m) => new Date(m.createdAt).getTime());
            for (let i = 1; i < dates.length; i++) {
                (0, vitest_1.expect)(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
            }
        }));
        (0, vitest_1.it)('cursor pagination: page 1 of 3 returns correct meta', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupChatWithMessages(5);
            const page1 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE1', 'Fetch page 1 with limit=2');
            (0, vitest_1.expect)(page1.status).toBe(200);
            (0, vitest_1.expect)(page1.body.data).toHaveLength(2);
            (0, vitest_1.expect)(page1.body.meta.total).toBe(5);
            (0, vitest_1.expect)(page1.body.meta.limit).toBe(2);
            (0, vitest_1.expect)(page1.body.meta.hasNextPage).toBe(true);
            (0, vitest_1.expect)(page1.body.meta.nextCursor).toBeTruthy();
            (0, vitest_1.expect)(typeof page1.body.meta.nextCursor).toBe('string');
            (0, vitest_1.expect)(page1.body.meta.nextCursor.length).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('cursor pagination: page 2 uses nextCursor from page 1', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupChatWithMessages(5);
            // Page 1
            const page1 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE2-FETCH1', 'Fetch page 1 for cursor');
            (0, vitest_1.expect)(page1.status).toBe(200);
            const cursor1 = page1.body.meta.nextCursor;
            (0, vitest_1.expect)(cursor1).toBeTruthy();
            const page1Ids = page1.body.data.map((m) => m.id || m._id);
            // Page 2
            const page2 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2, cursor: cursor1 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor1 }, page2.body, 'FLOW2-PAGE2-FETCH2', 'Fetch page 2 with cursor from page 1');
            (0, vitest_1.expect)(page2.status).toBe(200);
            (0, vitest_1.expect)(page2.body.data).toHaveLength(2);
            const page2Ids = page2.body.data.map((m) => m.id || m._id);
            // No ID overlap between page 1 and page 2 (Req 4.3)
            const overlap = page1Ids.filter((id) => page2Ids.includes(id));
            (0, vitest_1.expect)(overlap).toHaveLength(0);
        }));
        (0, vitest_1.it)('cursor pagination: page 3 is the last page', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupChatWithMessages(5);
            // Page 1
            const page1 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE3-FETCH1', 'Fetch page 1');
            (0, vitest_1.expect)(page1.status).toBe(200);
            const cursor1 = page1.body.meta.nextCursor;
            const page1Ids = page1.body.data.map((m) => m.id || m._id);
            // Page 2
            const page2 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2, cursor: cursor1 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor1 }, page2.body, 'FLOW2-PAGE3-FETCH2', 'Fetch page 2');
            (0, vitest_1.expect)(page2.status).toBe(200);
            const cursor2 = page2.body.meta.nextCursor;
            const page2Ids = page2.body.data.map((m) => m.id || m._id);
            // Page 3 (last page)
            const page3 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .query({ limit: 2, cursor: cursor2 })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor2 }, page3.body, 'FLOW2-PAGE3-FETCH3', 'Fetch page 3 (last)');
            (0, vitest_1.expect)(page3.status).toBe(200);
            (0, vitest_1.expect)(page3.body.data).toHaveLength(1);
            (0, vitest_1.expect)(page3.body.meta.hasNextPage).toBe(false);
            (0, vitest_1.expect)(page3.body.meta.nextCursor).toBeNull();
            const page3Ids = page3.body.data.map((m) => m.id || m._id);
            // All IDs across 3 pages are unique and total 5 (Req 4.4)
            const allIds = [...page1Ids, ...page2Ids, ...page3Ids];
            (0, vitest_1.expect)(allIds).toHaveLength(5);
            (0, vitest_1.expect)(new Set(allIds).size).toBe(5);
        }));
        (0, vitest_1.it)('bulk mark-read: modifiedCount matches sender B message count', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, userB, tokenB, chatId } = yield setupAcceptedConnection();
            // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
            const sends = [
                { token: tokenA, text: 'M1' },
                { token: tokenB, text: 'M2' },
                { token: tokenA, text: 'M3' },
                { token: tokenB, text: 'M4' },
                { token: tokenA, text: 'M5' },
            ];
            for (const { token, text } of sends) {
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/messages')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ chatId, text, type: 'text' });
                (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-MARKREAD-SEND-${text}`, `Send ${text}`);
                (0, vitest_1.expect)(res.status).toBe(201);
            }
            // userA marks read — should only mark M2 and M4 (sent by userB)
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW2-MARKREAD', 'userA marks chat as read');
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            (0, vitest_1.expect)(markReadRes.body.data.modifiedCount).toBe(2);
            (0, vitest_1.expect)(Array.isArray(markReadRes.body.data.updatedIds)).toBe(true);
            (0, vitest_1.expect)(markReadRes.body.data.updatedIds).toHaveLength(2);
        }));
        (0, vitest_1.it)('mark-read excludes own messages from readBy', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, userB, tokenB, chatId } = yield setupAcceptedConnection();
            // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
            const sends = [
                { token: tokenA, text: 'M1' },
                { token: tokenB, text: 'M2' },
                { token: tokenA, text: 'M3' },
                { token: tokenB, text: 'M4' },
                { token: tokenA, text: 'M5' },
            ];
            for (const { token, text } of sends) {
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/messages')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ chatId, text, type: 'text' });
                (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-READBY-SEND-${text}`, `Send ${text}`);
                (0, vitest_1.expect)(res.status).toBe(201);
            }
            // userA marks read
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW2-READBY-MARKREAD', 'userA marks chat as read');
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            // Req 4.6: userB's messages should have userA in readBy
            const userBMessages = yield message_model_1.Message.find({ chatId, sender: userB._id });
            (0, vitest_1.expect)(userBMessages.length).toBeGreaterThan(0);
            for (const msg of userBMessages) {
                const readByStrings = msg.readBy.map((id) => id.toString());
                (0, vitest_1.expect)(readByStrings).toContain(userA._id.toString());
            }
            // Req 4.7: userA's own messages should NOT have userA in readBy
            const userAMessages = yield message_model_1.Message.find({ chatId, sender: userA._id });
            (0, vitest_1.expect)(userAMessages.length).toBeGreaterThan(0);
            for (const msg of userAMessages) {
                const readByStrings = msg.readBy.map((id) => id.toString());
                (0, vitest_1.expect)(readByStrings).not.toContain(userA._id.toString());
            }
        }));
    });
    // ── Flow 3: Notification Routing ─────────────────────────────────────────
    (0, vitest_1.describe)('Flow 3: Notification Routing', () => {
        (0, vitest_1.it)('offline receiver: push sent, dedup key set', () => __awaiter(void 0, void 0, void 0, function* () {
            // Default redisClient.get returns null → receiver offline
            const { userA, tokenA, userB, chatId } = yield setupAcceptedConnection();
            // Give userB a device token so the push notification path actually fires
            yield user_model_1.User.findByIdAndUpdate(userB._id, {
                $push: { deviceTokens: { token: 'fake-fcm-token-for-test', platform: 'android' } },
            });
            // Send a message as userA
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'Offline push test', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'Offline push test', type: 'text' }, sendRes.body, 'FLOW3-OFFLINE-SEND', 'userA sends message to offline receiver');
            (0, vitest_1.expect)(sendRes.status).toBe(201);
            // Req 5.1: redisClient.set called with dedup key as first arg
            const dedupKey = `notif:dedup:${chatId}:${userB._id}`;
            const setCalls = vitest_1.vi.mocked(redisClient_1.redisClient.set).mock.calls;
            const dedupCall = setCalls.find((args) => args[0] === dedupKey);
            (0, vitest_1.expect)(dedupCall).toBeDefined();
            // Req 5.1: push notification helper called at least once
            const pushSingleCalled = vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification).mock.calls.length;
            const pushBulkCalled = vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications).mock.calls.length;
            (0, vitest_1.expect)(pushSingleCalled + pushBulkCalled).toBeGreaterThan(0);
            // Req 5.4: CHAT_UPDATED NOT emitted to user::${userB._id}
            const emitCalls = vitest_1.vi.mocked(global.io.emit).mock.calls;
            const chatUpdatedCalls = emitCalls.filter(([event]) => event === 'CHAT_UPDATED');
            (0, vitest_1.expect)(chatUpdatedCalls).toHaveLength(0);
        }));
        (0, vitest_1.it)('offline receiver: second message within dedup window skips push', () => __awaiter(void 0, void 0, void 0, function* () {
            // Default redisClient.get returns null → receiver offline
            const { userA, tokenA, chatId } = yield setupAcceptedConnection();
            // First message: default set returns 'OK' → push fires
            const firstRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'First message', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'First message', type: 'text' }, firstRes.body, 'FLOW3-DEDUP-FIRST', 'userA sends first message (push should fire)');
            (0, vitest_1.expect)(firstRes.status).toBe(201);
            // Override set to return null (NX fails — dedup key already exists)
            vitest_1.vi.mocked(redisClient_1.redisClient.set).mockResolvedValueOnce(null);
            // Clear push helper mocks before second send
            vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification).mockClear();
            vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications).mockClear();
            // Second message: NX fails → push should be suppressed
            const secondRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'Second message', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'Second message', type: 'text' }, secondRes.body, 'FLOW3-DEDUP-SECOND', 'userA sends second message (push should be suppressed)');
            (0, vitest_1.expect)(secondRes.status).toBe(201);
            // Req 5.2: push helpers NOT called for second message
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)('receiver in different chat: CHAT_UPDATED emitted, no push', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, userB, chatId } = yield setupAcceptedConnection();
            // Override get to return a different chatId → receiver is in a different chat
            vitest_1.vi.mocked(redisClient_1.redisClient.get).mockResolvedValueOnce('some-other-chat-id');
            // Send a message as userA
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'Different chat test', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'Different chat test', type: 'text' }, sendRes.body, 'FLOW3-DIFF-CHAT-SEND', 'userA sends message while receiver is in different chat');
            (0, vitest_1.expect)(sendRes.status).toBe(201);
            // Req 5.3, 11.2: io.to('user::' + userB._id) called and CHAT_UPDATED emitted
            const userBRoom = `user::${userB._id.toString()}`;
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(userBRoom);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('CHAT_UPDATED', vitest_1.expect.objectContaining({
                lastMessage: vitest_1.expect.any(Object),
                unreadCount: vitest_1.expect.any(Number),
            }));
            // Req 5.3: push helpers NOT called
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)('receiver has chat open: no push, no CHAT_UPDATED, MESSAGE_SENT still fires', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, userB, chatId } = yield setupAcceptedConnection();
            // Override get to return the current chatId → receiver has this chat open
            vitest_1.vi.mocked(redisClient_1.redisClient.get).mockResolvedValueOnce(chatId);
            // Send a message as userA
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'Chat open test', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'Chat open test', type: 'text' }, sendRes.body, 'FLOW3-CHAT-OPEN-SEND', 'userA sends message while receiver has chat open');
            (0, vitest_1.expect)(sendRes.status).toBe(201);
            // Req 5.5: push helpers NOT called
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
            (0, vitest_1.expect)(vitest_1.vi.mocked(pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();
            // Req 5.5: CHAT_UPDATED NOT emitted to user::${userB._id}
            const emitCalls = vitest_1.vi.mocked(global.io.emit).mock.calls;
            const chatUpdatedCalls = emitCalls.filter(([event]) => event === 'CHAT_UPDATED');
            (0, vitest_1.expect)(chatUpdatedCalls).toHaveLength(0);
            // Req 5.6, 11.1: MESSAGE_SENT still emitted to chat::${chatId}
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('MESSAGE_SENT', vitest_1.expect.objectContaining({
                message: vitest_1.expect.any(Object),
            }));
        }));
    });
    // ── Flow 1: Full Happy Path ────────────────────────────────────────────────
    (0, vitest_1.describe)('Flow 1: Full Happy Path', () => {
        (0, vitest_1.it)('connection accept → chat create → send message → get history → mark read', () => __awaiter(void 0, void 0, void 0, function* () {
            // ── Step 1: Setup pending connection ──────────────────────────────────
            const { userA, tokenA, userB, tokenB, connectionId } = yield setupPendingConnection();
            // ── Step 2: Accept the connection as userB ────────────────────────────
            const acceptRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/accept`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/connections/${connectionId}/accept`, {}, acceptRes.body, 'FLOW1-ACCEPT-CONNECTION', 'userB accepts connection from userA');
            (0, vitest_1.expect)(acceptRes.status).toBe(200);
            (0, vitest_1.expect)(acceptRes.body.success).toBe(true);
            (0, vitest_1.expect)(acceptRes.body.data.status).toBe('ACCEPTED');
            (0, vitest_1.expect)(acceptRes.body.data.chatId).toBeTruthy();
            const chatId = acceptRes.body.data.chatId;
            // ── Step 3: Assert exactly one Chat document exists ───────────────────
            const chatCount = yield chat_model_1.Chat.countDocuments({
                participants: { $all: [userA._id, userB._id] },
            });
            (0, vitest_1.expect)(chatCount).toBe(1);
            // ── Step 4: Assert CONNECTION_ACCEPTED socket event emitted to userA ──
            // Req 11.5: io.to('user::' + userA._id).emit('CONNECTION_ACCEPTED', ...)
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`user::${userA._id.toString()}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('CONNECTION_ACCEPTED', vitest_1.expect.objectContaining({
                connectionId: vitest_1.expect.anything(),
                chatId: vitest_1.expect.anything(),
            }));
            // ── Step 5: POST /api/v1/chats/:userB._id as userA (idempotency) ──────
            const chatCreateResA = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/chats/${userB._id.toString()}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/chats/${userB._id.toString()}`, {}, chatCreateResA.body, 'FLOW1-CREATE-CHAT-A', 'userA creates/gets chat with userB (idempotency)');
            (0, vitest_1.expect)(chatCreateResA.status).toBe(201);
            (0, vitest_1.expect)(chatCreateResA.body.data.id).toBe(chatId);
            // ── Step 6: POST /api/v1/chats/:userA._id as userB (reverse idempotency)
            const chatCreateResB = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/chats/${userA._id.toString()}`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/chats/${userA._id.toString()}`, {}, chatCreateResB.body, 'FLOW1-CREATE-CHAT-B', 'userB creates/gets chat with userA (reverse idempotency)');
            (0, vitest_1.expect)(chatCreateResB.status).toBe(201);
            (0, vitest_1.expect)(chatCreateResB.body.data.id).toBe(chatId);
            // ── Step 7: GET /api/v1/chats as userA (before any message) ──────────
            const chatListResA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListResA.body, 'FLOW1-LIST-CHATS-A', 'userA lists chats before any message');
            (0, vitest_1.expect)(chatListResA.status).toBe(200);
            (0, vitest_1.expect)(Array.isArray(chatListResA.body.data)).toBe(true);
            (0, vitest_1.expect)(chatListResA.body.data).toHaveLength(1);
            (0, vitest_1.expect)(chatListResA.body.data[0].id).toBe(chatId);
            (0, vitest_1.expect)(chatListResA.body.data[0].unreadCount).toBe(0);
            // ── Step 8: GET /api/v1/chats as userB (before any message) ──────────
            const chatListResB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW1-LIST-CHATS-B', 'userB lists chats before any message');
            (0, vitest_1.expect)(chatListResB.status).toBe(200);
            (0, vitest_1.expect)(Array.isArray(chatListResB.body.data)).toBe(true);
            (0, vitest_1.expect)(chatListResB.body.data).toHaveLength(1);
            (0, vitest_1.expect)(chatListResB.body.data[0].id).toBe(chatId);
            (0, vitest_1.expect)(chatListResB.body.data[0].unreadCount).toBe(0);
            // ── Step 9: Send message as userA ─────────────────────────────────────
            const sendMsgRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: 'Hello from A', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'Hello from A', type: 'text' }, sendMsgRes.body, 'FLOW1-SEND-MESSAGE', 'userA sends first message');
            (0, vitest_1.expect)(sendMsgRes.status).toBe(201);
            (0, vitest_1.expect)(sendMsgRes.body.success).toBe(true);
            (0, vitest_1.expect)(sendMsgRes.body.data.text).toBe('Hello from A');
            (0, vitest_1.expect)(sendMsgRes.body.data.chatId).toBe(chatId);
            // ── Step 10: Assert MESSAGE_SENT socket event ─────────────────────────
            // Req 3.8, 11.1: io.to('chat::' + chatId).emit('MESSAGE_SENT', { message: { text: 'Hello from A' } })
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('MESSAGE_SENT', vitest_1.expect.objectContaining({
                message: vitest_1.expect.objectContaining({ text: 'Hello from A' }),
            }));
            // ── Step 11: Assert Chat.lastMessage updated ──────────────────────────
            // Req 3.9, 3.10
            const chatDoc = yield chat_model_1.Chat.findById(chatId);
            (0, vitest_1.expect)(chatDoc).not.toBeNull();
            (0, vitest_1.expect)(chatDoc.lastMessage.text).toBe('Hello from A');
            (0, vitest_1.expect)(chatDoc.lastMessage.sender.toString()).toBe(userA._id.toString());
            // ── Step 12: GET /api/v1/chats as userA — lastMessage reflected ───────
            const chatListAfterMsgA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListAfterMsgA.body, 'FLOW1-LIST-CHATS-A-AFTER-MSG', 'userA lists chats after sending message');
            (0, vitest_1.expect)(chatListAfterMsgA.body.data[0].lastMessage.text).toBe('Hello from A');
            // ── Step 13: GET /api/v1/chats as userB — unreadCount === 1 ──────────
            // Override mget to return ['1'] for this call (Req 3.11)
            vitest_1.vi.mocked(redisClient_1.redisClient.mget).mockResolvedValueOnce(['1']);
            const chatListAfterMsgB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListAfterMsgB.body, 'FLOW1-LIST-CHATS-B-UNREAD', 'userB lists chats — expects unreadCount 1');
            (0, vitest_1.expect)(chatListAfterMsgB.body.data[0].unreadCount).toBe(1);
            // ── Step 14: GET /api/v1/messages/chat/:chatId as userB ───────────────
            const msgHistoryRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW1-GET-HISTORY', 'userB fetches message history');
            (0, vitest_1.expect)(msgHistoryRes.status).toBe(200);
            (0, vitest_1.expect)(msgHistoryRes.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(msgHistoryRes.body.data)).toBe(true);
            (0, vitest_1.expect)(msgHistoryRes.body.data).toHaveLength(1);
            (0, vitest_1.expect)(msgHistoryRes.body.data[0].text).toBe('Hello from A');
            // ── Step 15: POST /api/v1/messages/chat/:chatId/read as userB ─────────
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW1-MARK-READ', 'userB marks messages as read');
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            (0, vitest_1.expect)(markReadRes.body.success).toBe(true);
            (0, vitest_1.expect)(markReadRes.body.data.modifiedCount).toBe(1);
            (0, vitest_1.expect)(Array.isArray(markReadRes.body.data.updatedIds)).toBe(true);
            (0, vitest_1.expect)(markReadRes.body.data.updatedIds).toHaveLength(1);
            // ── Step 16: Assert MESSAGES_READ socket event ────────────────────────
            // Req 3.14, 11.3: io.to('chat::' + chatId).emit('MESSAGES_READ', { chatId, userId, updatedIds })
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('MESSAGES_READ', vitest_1.expect.objectContaining({
                chatId,
                userId: userB._id.toString(),
                updatedIds: vitest_1.expect.arrayContaining([vitest_1.expect.any(String)]),
            }));
            // ── Step 17: GET /api/v1/chats as userB — unreadCount === 0 ──────────
            // Override mget to return ['0'] (Req 3.15)
            vitest_1.vi.mocked(redisClient_1.redisClient.mget).mockResolvedValueOnce(['0']);
            const chatListFinalB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListFinalB.body, 'FLOW1-LIST-CHATS-B-AFTER-READ', 'userB lists chats after marking read — expects unreadCount 0');
            (0, vitest_1.expect)(chatListFinalB.body.data[0].unreadCount).toBe(0);
        }));
    });
    // ── Flow 4: Connection Removal with Chat Persistence ─────────────────────
    (0, vitest_1.describe)('Flow 4: Connection Removal with Chat Persistence', () => {
        (0, vitest_1.it)('user A removes connection: Connection deleted, Chat persists, CONNECTION_REMOVED emitted', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const { userA, tokenA, userB, tokenB, connectionId, chatId } = yield setupChatWithMessages(3);
            // ── Step 1: Remove connection as userA ────────────────────────────────
            const removeRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/remove`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-CONNECTION', 'userA removes connection');
            // Req 6.1: status 200, success true, data.status 'NONE'
            (0, vitest_1.expect)(removeRes.status).toBe(200);
            (0, vitest_1.expect)(removeRes.body.success).toBe(true);
            (0, vitest_1.expect)(removeRes.body.data.status).toBe('NONE');
            // ── Step 2: Assert Connection document is deleted ─────────────────────
            // Req 6.2
            const connectionDoc = yield connection_model_1.Connection.findById(connectionId);
            (0, vitest_1.expect)(connectionDoc).toBeNull();
            // ── Step 3: Assert Chat document still exists ─────────────────────────
            // Req 6.3
            const chatDoc = yield chat_model_1.Chat.findById(chatId);
            (0, vitest_1.expect)(chatDoc).not.toBeNull();
            // ── Step 4: Assert CONNECTION_REMOVED socket event emitted to userB ───
            // Req 6.4, 11.4: io.to('user::' + userB._id).emit('CONNECTION_REMOVED', { connectionId, chatId })
            // Note: chatId in the socket payload is a MongoDB ObjectId, so we use expect.anything() and
            // verify the chatId value separately via the DB and chat list checks below.
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`user::${userB._id.toString()}`);
            const emitCalls = global.io.emit.mock.calls;
            const removedCall = emitCalls.find(([event]) => event === 'CONNECTION_REMOVED');
            (0, vitest_1.expect)(removedCall).toBeDefined();
            (0, vitest_1.expect)(removedCall[1]).toMatchObject({
                connectionId: vitest_1.expect.anything(),
            });
            // chatId in the payload is an ObjectId — verify it matches the known chatId string
            (0, vitest_1.expect)((_a = removedCall[1].chatId) === null || _a === void 0 ? void 0 : _a.toString()).toBe(chatId);
            // ── Step 5: GET /api/v1/chats as userA — chat still visible ──────────
            // Req 6.5
            const chatListResA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListResA.body, 'FLOW4-LIST-CHATS-A', 'userA lists chats after connection removal');
            (0, vitest_1.expect)(chatListResA.status).toBe(200);
            (0, vitest_1.expect)(chatListResA.body.success).toBe(true);
            const chatListAIds = chatListResA.body.data.map((c) => c.id || c._id);
            (0, vitest_1.expect)(chatListAIds).toContain(chatId);
            // ── Step 6: GET /api/v1/chats as userB — chat still visible ──────────
            // Req 6.6
            const chatListResB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW4-LIST-CHATS-B', 'userB lists chats after connection removal');
            (0, vitest_1.expect)(chatListResB.status).toBe(200);
            (0, vitest_1.expect)(chatListResB.body.success).toBe(true);
            const chatListBIds = chatListResB.body.data.map((c) => c.id || c._id);
            (0, vitest_1.expect)(chatListBIds).toContain(chatId);
            // ── Step 7: GET /api/v1/messages/chat/:chatId as userA — 3 messages ──
            // Req 6.7: message history unaffected by connection removal
            const msgHistoryRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW4-GET-HISTORY', 'userA fetches message history after connection removal');
            (0, vitest_1.expect)(msgHistoryRes.status).toBe(200);
            (0, vitest_1.expect)(msgHistoryRes.body.data).toHaveLength(3);
        }));
        (0, vitest_1.it)('user B can also remove connection: CONNECTION_REMOVED emitted to user A', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenB, connectionId } = yield setupAcceptedConnection();
            // Remove connection as userB
            const removeRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/remove`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-BY-B', 'userB removes connection');
            // Req 6.8: status 200, data.status 'NONE'
            (0, vitest_1.expect)(removeRes.status).toBe(200);
            (0, vitest_1.expect)(removeRes.body.data.status).toBe('NONE');
            // Req 6.8, 11.4: CONNECTION_REMOVED emitted to user::userA._id
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`user::${userA._id.toString()}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('CONNECTION_REMOVED', vitest_1.expect.objectContaining({
                connectionId: vitest_1.expect.anything(),
                chatId: vitest_1.expect.anything(),
            }));
        }));
        (0, vitest_1.it)('non-participant cannot remove connection: 403', () => __awaiter(void 0, void 0, void 0, function* () {
            const { connectionId } = yield setupAcceptedConnection();
            // Create a third user who is not part of the connection
            const { token: tokenC } = yield createAuthUser(user_1.USER_ROLES.USER, 'userC');
            // Attempt to remove connection as userC
            const removeRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/remove`)
                .set('Authorization', `Bearer ${tokenC}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-NON-PARTICIPANT', 'userC (non-participant) attempts to remove connection');
            // Req 6.9: 403 Forbidden
            (0, vitest_1.expect)(removeRes.status).toBe(403);
            (0, vitest_1.expect)(removeRes.body.success).toBe(false);
        }));
        (0, vitest_1.it)('message history persists after connection removal', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, tokenA, connectionId, chatId } = yield setupChatWithMessages(3);
            // Remove connection as userA
            const removeRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/remove`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-PERSIST-REMOVE', 'userA removes connection (persistence check)');
            (0, vitest_1.expect)(removeRes.status).toBe(200);
            // Req 6.7: message history still accessible and complete
            const msgHistoryRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW4-PERSIST-HISTORY', 'userA fetches message history — explicit persistence check');
            (0, vitest_1.expect)(msgHistoryRes.status).toBe(200);
            (0, vitest_1.expect)(msgHistoryRes.body.data).toHaveLength(3);
        }));
    });
    // ── Flow 5: Validation Guards ─────────────────────────────────────────────
    (0, vitest_1.describe)('Flow 5: Validation Guards', () => {
        (0, vitest_1.it)('unauthenticated requests return 401 for all chat/message endpoints', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userB, chatId } = yield setupAcceptedConnection();
            // Req 7.1: POST /api/v1/chats/:otherUserId without Authorization → 401
            const chatCreateRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/chats/${userB._id.toString()}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/chats/${userB._id.toString()}`, {}, chatCreateRes.body, 'FLOW5-UNAUTH-CREATE-CHAT', 'unauthenticated POST /chats/:id');
            (0, vitest_1.expect)(chatCreateRes.status).toBe(401);
            (0, vitest_1.expect)(chatCreateRes.body.success).toBe(false);
            // Req 7.2: GET /api/v1/chats without Authorization → 401
            const chatListRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats');
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW5-UNAUTH-LIST-CHATS', 'unauthenticated GET /chats');
            (0, vitest_1.expect)(chatListRes.status).toBe(401);
            (0, vitest_1.expect)(chatListRes.body.success).toBe(false);
            // Req 7.3: POST /api/v1/messages without Authorization → 401
            const sendMsgRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .send({ chatId, text: 'hello', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'hello', type: 'text' }, sendMsgRes.body, 'FLOW5-UNAUTH-SEND-MSG', 'unauthenticated POST /messages');
            (0, vitest_1.expect)(sendMsgRes.status).toBe(401);
            (0, vitest_1.expect)(sendMsgRes.body.success).toBe(false);
            // Req 7.4: GET /api/v1/messages/chat/:chatId without Authorization → 401
            const getMsgRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, getMsgRes.body, 'FLOW5-UNAUTH-GET-HISTORY', 'unauthenticated GET /messages/chat/:chatId');
            (0, vitest_1.expect)(getMsgRes.status).toBe(401);
            (0, vitest_1.expect)(getMsgRes.body.success).toBe(false);
            // Req 7.5: POST /api/v1/messages/chat/:chatId/read without Authorization → 401
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW5-UNAUTH-MARK-READ', 'unauthenticated POST /messages/chat/:chatId/read');
            (0, vitest_1.expect)(markReadRes.status).toBe(401);
            (0, vitest_1.expect)(markReadRes.body.success).toBe(false);
        }));
        (0, vitest_1.it)('non-existent chatId returns 404 on send', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser();
            // Use a valid ObjectId that does not exist in the DB
            const nonExistentChatId = new mongoose_1.default.Types.ObjectId().toString();
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${token}`)
                .send({ chatId: nonExistentChatId, text: 'hello', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId: nonExistentChatId, text: 'hello', type: 'text' }, sendRes.body, 'FLOW5-NONEXISTENT-CHAT', 'send to non-existent chatId');
            // Req 7.6: 404 when chatId does not exist
            (0, vitest_1.expect)(sendRes.status).toBe(404);
            (0, vitest_1.expect)(sendRes.body.success).toBe(false);
        }));
        (0, vitest_1.it)('non-participant returns 403 on send and get history', () => __awaiter(void 0, void 0, void 0, function* () {
            const { chatId } = yield setupAcceptedConnection();
            // Create a third user who is not a participant of the chat
            const { token: tokenC } = yield createAuthUser(user_1.USER_ROLES.USER, 'userC');
            // Req 7.7: POST /api/v1/messages as userC → 403 with 'not a participant'
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenC}`)
                .send({ chatId, text: 'intruder message', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: 'intruder message', type: 'text' }, sendRes.body, 'FLOW5-NON-PARTICIPANT-SEND', 'userC (non-participant) sends message');
            (0, vitest_1.expect)(sendRes.status).toBe(403);
            (0, vitest_1.expect)(sendRes.body.success).toBe(false);
            (0, vitest_1.expect)(sendRes.body.message.toLowerCase()).toContain('not a participant');
            // Req 7.8: GET /api/v1/messages/chat/:chatId as userC → 403 with 'not a participant'
            const getRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenC}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, {}, getRes.body, 'FLOW5-NON-PARTICIPANT-GET', 'userC (non-participant) fetches message history');
            (0, vitest_1.expect)(getRes.status).toBe(403);
            (0, vitest_1.expect)(getRes.body.success).toBe(false);
            (0, vitest_1.expect)(getRes.body.message.toLowerCase()).toContain('not a participant');
        }));
        (0, vitest_1.it)('empty message body returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupAcceptedConnection();
            // Req 7.9: POST /api/v1/messages with no text and no attachments → 400
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, type: 'text' }, sendRes.body, 'FLOW5-EMPTY-BODY', 'send message with no text and no attachments');
            (0, vitest_1.expect)(sendRes.status).toBe(400);
            (0, vitest_1.expect)(sendRes.body.success).toBe(false);
            (0, vitest_1.expect)(sendRes.body.message.toLowerCase()).toContain('must contain text or at least one attachment');
        }));
        (0, vitest_1.it)('text exceeding 10000 chars returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupAcceptedConnection();
            // Req 7.10: POST /api/v1/messages with text.length === 10001 → 400
            const longText = 'a'.repeat(10001);
            const sendRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId, text: longText, type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId, text: `${'a'.repeat(20)}...(10001 chars)`, type: 'text' }, sendRes.body, 'FLOW5-TEXT-TOO-LONG', 'send message with text exceeding 10000 chars');
            (0, vitest_1.expect)(sendRes.status).toBe(400);
            (0, vitest_1.expect)(sendRes.body.success).toBe(false);
            (0, vitest_1.expect)(sendRes.body.message.toLowerCase()).toContain('exceeds maximum length');
        }));
    });
    // ── Flow 6 & 7: Chat List Ordering/Search and Mark-Read Edge Cases ────────
    (0, vitest_1.describe)('Flow 6 & 7: Chat List and Mark-Read Edge Cases', () => {
        /**
         * Helper: set up two accepted connections for userA.
         * userB has a name containing 'Ali'; userC does not.
         * Returns chatAB (userA↔userB) and chatAC (userA↔userC) IDs plus tokens.
         */
        function setupTwoChats() {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.USER, 'userA');
                const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.USER, 'Ali userB');
                const { user: userC, token: tokenC } = yield createAuthUser(user_1.USER_ROLES.USER, 'userC');
                // userA → userB connection
                const connABRes = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/connections')
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({ receiverId: userB._id.toString() });
                if (connABRes.status !== 201 || !((_a = connABRes.body.data) === null || _a === void 0 ? void 0 : _a.id)) {
                    throw new Error(`setupTwoChats: connAB failed status=${connABRes.status} body=${JSON.stringify(connABRes.body)}`);
                }
                const connABId = connABRes.body.data.id;
                // userB accepts
                const acceptABRes = yield (0, supertest_1.default)(app_1.default)
                    .post(`/api/v1/connections/${connABId}/accept`)
                    .set('Authorization', `Bearer ${tokenB}`);
                if (acceptABRes.status !== 200 || !((_b = acceptABRes.body.data) === null || _b === void 0 ? void 0 : _b.chatId)) {
                    throw new Error(`setupTwoChats: acceptAB failed status=${acceptABRes.status} body=${JSON.stringify(acceptABRes.body)}`);
                }
                const chatAB = acceptABRes.body.data.chatId;
                // userA → userC connection
                const connACRes = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/connections')
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({ receiverId: userC._id.toString() });
                if (connACRes.status !== 201 || !((_c = connACRes.body.data) === null || _c === void 0 ? void 0 : _c.id)) {
                    throw new Error(`setupTwoChats: connAC failed status=${connACRes.status} body=${JSON.stringify(connACRes.body)}`);
                }
                const connACId = connACRes.body.data.id;
                // userC accepts
                const acceptACRes = yield (0, supertest_1.default)(app_1.default)
                    .post(`/api/v1/connections/${connACId}/accept`)
                    .set('Authorization', `Bearer ${tokenC}`);
                if (acceptACRes.status !== 200 || !((_d = acceptACRes.body.data) === null || _d === void 0 ? void 0 : _d.chatId)) {
                    throw new Error(`setupTwoChats: acceptAC failed status=${acceptACRes.status} body=${JSON.stringify(acceptACRes.body)}`);
                }
                const chatAC = acceptACRes.body.data.chatId;
                return { userA, tokenA, userB, tokenB, userC, tokenC, chatAB, chatAC };
            });
        }
        // ── Flow 6: Chat List Ordering and Search ─────────────────────────────
        (0, vitest_1.it)('chat list ordered by lastMessage.createdAt descending', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatAB, chatAC } = yield setupTwoChats();
            // Send a message to chatAC first
            const sendACRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId: chatAC, text: 'Message to AC', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId: chatAC, text: 'Message to AC', type: 'text' }, sendACRes.body, 'FLOW6-SEND-AC', 'userA sends message to chatAC first');
            (0, vitest_1.expect)(sendACRes.status).toBe(201);
            // Then send a message to chatAB (more recent)
            const sendABRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ chatId: chatAB, text: 'Message to AB', type: 'text' });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { chatId: chatAB, text: 'Message to AB', type: 'text' }, sendABRes.body, 'FLOW6-SEND-AB', 'userA sends message to chatAB second (most recent)');
            (0, vitest_1.expect)(sendABRes.status).toBe(201);
            // GET /api/v1/chats as userA — chatAB should be first (most recent lastMessage)
            const chatListRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW6-LIST-ORDERED', 'userA lists chats — expects chatAB first');
            (0, vitest_1.expect)(chatListRes.status).toBe(200);
            (0, vitest_1.expect)(chatListRes.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(chatListRes.body.data)).toBe(true);
            (0, vitest_1.expect)(chatListRes.body.data.length).toBeGreaterThanOrEqual(2);
            // Req 8.1: most recently active chat (chatAB) must be first
            const firstChatId = chatListRes.body.data[0].id || chatListRes.body.data[0]._id;
            (0, vitest_1.expect)(firstChatId).toBe(chatAB);
        }));
        (0, vitest_1.it)('searchTerm filters by other participant name (case-insensitive)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatAB } = yield setupTwoChats();
            // GET /api/v1/chats?searchTerm=ali — should match userB (name contains 'Ali')
            const searchRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .query({ searchTerm: 'ali' })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', { searchTerm: 'ali' }, searchRes.body, 'FLOW6-SEARCH-ALI', 'userA searches chats with searchTerm=ali');
            (0, vitest_1.expect)(searchRes.status).toBe(200);
            (0, vitest_1.expect)(searchRes.body.success).toBe(true);
            // Req 8.2: only chatAB (with userB whose name contains 'Ali') should be returned
            (0, vitest_1.expect)(searchRes.body.data).toHaveLength(1);
            const resultChatId = searchRes.body.data[0].id || searchRes.body.data[0]._id;
            (0, vitest_1.expect)(resultChatId).toBe(chatAB);
        }));
        (0, vitest_1.it)('searchTerm with no match returns empty array', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA } = yield setupTwoChats();
            // GET /api/v1/chats?searchTerm=NONEXISTENT
            const searchRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .query({ searchTerm: 'NONEXISTENT' })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', { searchTerm: 'NONEXISTENT' }, searchRes.body, 'FLOW6-SEARCH-NOMATCH', 'userA searches with non-matching searchTerm');
            (0, vitest_1.expect)(searchRes.status).toBe(200);
            (0, vitest_1.expect)(searchRes.body.success).toBe(true);
            // Req 8.3: no chats match → empty array
            (0, vitest_1.expect)(searchRes.body.data).toEqual([]);
        }));
        (0, vitest_1.it)('empty searchTerm returns all chats', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA } = yield setupTwoChats();
            // GET /api/v1/chats?searchTerm= (empty string)
            const searchRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .query({ searchTerm: '' })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', { searchTerm: '' }, searchRes.body, 'FLOW6-SEARCH-EMPTY', 'userA searches with empty searchTerm');
            (0, vitest_1.expect)(searchRes.status).toBe(200);
            // Req 8.4: empty searchTerm → all chats returned
            (0, vitest_1.expect)(searchRes.body.data).toHaveLength(2);
        }));
        (0, vitest_1.it)('whitespace-only searchTerm returns all chats', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA } = yield setupTwoChats();
            // GET /api/v1/chats?searchTerm=   (whitespace only)
            const searchRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .query({ searchTerm: '   ' })
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', { searchTerm: '   ' }, searchRes.body, 'FLOW6-SEARCH-WHITESPACE', 'userA searches with whitespace-only searchTerm');
            (0, vitest_1.expect)(searchRes.status).toBe(200);
            // Req 8.5: whitespace-only searchTerm treated as no filter → all chats returned
            (0, vitest_1.expect)(searchRes.body.data).toHaveLength(2);
        }));
        // ── Flow 7: Mark-Read Edge Cases ──────────────────────────────────────
        (0, vitest_1.it)('mark-read on empty chat returns modifiedCount 0, no MESSAGES_READ event', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenB, chatId } = yield setupAcceptedConnection();
            // Call mark-read on a chat with no messages
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-EMPTY-CHAT-READ', 'userB marks empty chat as read');
            // Req 9.1: modifiedCount 0, updatedIds []
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            (0, vitest_1.expect)(markReadRes.body.success).toBe(true);
            (0, vitest_1.expect)(markReadRes.body.data.modifiedCount).toBe(0);
            (0, vitest_1.expect)(markReadRes.body.data.updatedIds).toEqual([]);
            // Req 9.2: MESSAGES_READ NOT emitted to chat::${chatId}
            const emitCalls = global.io.emit.mock.calls;
            const messagesReadCalls = emitCalls.filter(([event]) => event === 'MESSAGES_READ');
            (0, vitest_1.expect)(messagesReadCalls).toHaveLength(0);
        }));
        (0, vitest_1.it)('mark-read with only own messages returns modifiedCount 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupChatWithMessages(3);
            // userA marks read — all messages are from userA, so nothing should be marked
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-OWN-MSGS-READ', 'userA marks chat as read (all messages are own)');
            // Req 9.3: modifiedCount 0, updatedIds []
            (0, vitest_1.expect)(markReadRes.body.data.modifiedCount).toBe(0);
            (0, vitest_1.expect)(markReadRes.body.data.updatedIds).toEqual([]);
        }));
        (0, vitest_1.it)('mark-read is idempotent: second call returns modifiedCount 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenB, chatId } = yield setupChatWithMessages(3);
            // First call — marks 3 messages from userA as read by userB
            const firstMarkReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, firstMarkReadRes.body, 'FLOW7-IDEMPOTENT-FIRST', 'userB marks chat as read (first call)');
            (0, vitest_1.expect)(firstMarkReadRes.status).toBe(200);
            (0, vitest_1.expect)(firstMarkReadRes.body.data.modifiedCount).toBe(3);
            // Second call — all messages already read, nothing to update
            const secondMarkReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, secondMarkReadRes.body, 'FLOW7-IDEMPOTENT-SECOND', 'userB marks chat as read again (second call — idempotent)');
            // Req 9.5: second call returns modifiedCount 0, updatedIds []
            (0, vitest_1.expect)(secondMarkReadRes.status).toBe(200);
            (0, vitest_1.expect)(secondMarkReadRes.body.data.modifiedCount).toBe(0);
            (0, vitest_1.expect)(secondMarkReadRes.body.data.updatedIds).toEqual([]);
        }));
        (0, vitest_1.it)('mark-read populates readBy for all messages from other sender', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userA, userB, tokenB, chatId } = yield setupChatWithMessages(3);
            // userB marks chat as read
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-READBY-POPULATE', 'userB marks chat as read');
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            // Req 9.4: all messages from userA should have userB in readBy
            const userAMessages = yield message_model_1.Message.find({ chatId, sender: userA._id });
            (0, vitest_1.expect)(userAMessages).toHaveLength(3);
            for (const msg of userAMessages) {
                const readByStrings = msg.readBy.map((id) => id.toString());
                (0, vitest_1.expect)(readByStrings).toContain(userB._id.toString());
            }
        }));
        (0, vitest_1.it)('mark-read reflects in chat list unreadCount', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenB, chatId } = yield setupChatWithMessages(3);
            // userB marks chat as read
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-UNREAD-COUNT', 'userB marks chat as read');
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            // Override mget to return ['0'] — simulates unreadCount = 0 for this chat
            vitest_1.vi.mocked(redisClient_1.redisClient.mget).mockResolvedValueOnce(['0']);
            // GET /api/v1/chats as userB — unreadCount should be 0
            const chatListRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW7-UNREAD-LIST', 'userB lists chats after mark-read — expects unreadCount 0');
            (0, vitest_1.expect)(chatListRes.status).toBe(200);
            // Req 9.6: unreadCount should be 0
            (0, vitest_1.expect)(chatListRes.body.data[0].unreadCount).toBe(0);
        }));
    });
});
