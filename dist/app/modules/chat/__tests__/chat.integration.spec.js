"use strict";
/**
 * Integration tests for ChatService
 * Task 13.3 — Requirements: 4.4, 9.5, 10.2
 *
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks redisClient from src/shared/redisClient.ts to simulate Redis
 * unavailability (mget throws), verifying that getList degrades gracefully
 * by returning unreadCount: 0 for all chats without throwing.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
// ── Mocks (must be declared before importing the modules that use them) ──────
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        incrby: vitest_1.vi.fn().mockResolvedValue(1),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        on: vitest_1.vi.fn(),
    },
}));
// ── Imports (after mocks) ────────────────────────────────────────────────────
const chat_service_1 = require("../chat.service");
const chat_model_1 = require("../chat.model");
const user_model_1 = require("../../user/user.model");
// ── Test helpers ─────────────────────────────────────────────────────────────
let mongod;
/** Create a minimal User document with required fields. */
function createUser(suffix) {
    return __awaiter(this, void 0, void 0, function* () {
        const tag = suffix !== null && suffix !== void 0 ? suffix : `${Date.now()}-${Math.random()}`;
        return user_model_1.User.create({
            name: `Test User ${tag}`,
            role: 'BROTHER',
            email: `test-${tag}@example.com`,
            password: 'password123',
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
        });
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    mongod = yield mongodb_memory_server_1.MongoMemoryServer.create();
    yield mongoose_1.default.connect(mongod.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield mongod.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield chat_model_1.Chat.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Re-apply default mock implementations after clearAllMocks
    const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
    vitest_1.vi.mocked(redisClient.mget).mockResolvedValue([]);
    vitest_1.vi.mocked(redisClient.get).mockResolvedValue(null);
    vitest_1.vi.mocked(redisClient.set).mockResolvedValue('OK');
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('ChatService.getList — Redis unavailable', () => {
    /**
     * Requirements 4.4, 9.5, 10.2
     *
     * When Redis is unavailable (mget throws), getList must:
     *   - still return the chat list without throwing
     *   - set unreadCount to 0 for every chat
     */
    (0, vitest_1.it)('returns unreadCount: 0 for all chats when Redis mget throws', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange: two users and a chat between them
        const userA = yield createUser('a');
        const userB = yield createUser('b');
        yield chat_model_1.Chat.create({ participants: [userA._id, userB._id] });
        // Simulate Redis unavailability — mget throws a connection error
        const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
        vitest_1.vi.mocked(redisClient.mget).mockRejectedValue(new Error('Redis connection refused'));
        // Act: getList should not throw even though Redis is down
        const result = yield chat_service_1.ChatService.getList(userA._id.toString());
        // Assert: chat is returned with unreadCount of 0
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].unreadCount).toBe(0);
    }));
    (0, vitest_1.it)('returns unreadCount: 0 for multiple chats when Redis mget throws', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange: three users and two chats for userA
        const userA = yield createUser('a2');
        const userB = yield createUser('b2');
        const userC = yield createUser('c2');
        yield chat_model_1.Chat.create({ participants: [userA._id, userB._id] });
        yield chat_model_1.Chat.create({ participants: [userA._id, userC._id] });
        // Simulate Redis unavailability
        const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
        vitest_1.vi.mocked(redisClient.mget).mockRejectedValue(new Error('Redis timeout'));
        // Act
        const result = yield chat_service_1.ChatService.getList(userA._id.toString());
        // Assert: both chats are returned, each with unreadCount of 0
        (0, vitest_1.expect)(result).toHaveLength(2);
        (0, vitest_1.expect)(result.every(chat => chat.unreadCount === 0)).toBe(true);
    }));
    (0, vitest_1.it)('does not throw when Redis mget throws — error is swallowed gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        const userA = yield createUser('a3');
        const userB = yield createUser('b3');
        yield chat_model_1.Chat.create({ participants: [userA._id, userB._id] });
        const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
        vitest_1.vi.mocked(redisClient.mget).mockRejectedValue(new Error('ECONNREFUSED'));
        // Act + Assert: must resolve, not reject
        yield (0, vitest_1.expect)(chat_service_1.ChatService.getList(userA._id.toString())).resolves.toBeDefined();
    }));
});
