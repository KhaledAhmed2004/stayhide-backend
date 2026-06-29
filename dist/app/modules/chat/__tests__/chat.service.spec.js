"use strict";
/**
 * Unit tests for ChatService
 * Task 12.1 — Requirements: 3.3, 3.4, 4.8
 *
 * Uses mongodb-memory-server for DB-touching tests.
 * Mocks redisClient from src/shared/redisClient.ts to isolate service logic.
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
function createUser() {
    return __awaiter(this, void 0, void 0, function* () {
        return user_model_1.User.create({
            name: 'Test User',
            role: 'BROTHER',
            email: `test-${Date.now()}-${Math.random()}@example.com`,
            password: 'password123',
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
        });
    });
}
/** Return a new ObjectId string that does not correspond to any document. */
function nonExistentId() {
    return new mongoose_1.default.Types.ObjectId().toString();
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
(0, vitest_1.describe)('ChatService.createOrGet', () => {
    /**
     * Requirement 3.3 — userId === otherUserId → 400
     */
    (0, vitest_1.it)('throws 400 when userId equals otherUserId', () => __awaiter(void 0, void 0, void 0, function* () {
        const userId = new mongoose_1.default.Types.ObjectId().toString();
        yield (0, vitest_1.expect)(chat_service_1.ChatService.createOrGet(userId, userId)).rejects.toMatchObject({
            statusCode: 400,
        });
    }));
    /**
     * Requirement 3.4 — non-existent otherUserId → 404
     */
    (0, vitest_1.it)('throws 404 when otherUserId does not exist in the User collection', () => __awaiter(void 0, void 0, void 0, function* () {
        const userId = new mongoose_1.default.Types.ObjectId().toString();
        const ghostUserId = nonExistentId();
        yield (0, vitest_1.expect)(chat_service_1.ChatService.createOrGet(userId, ghostUserId)).rejects.toMatchObject({
            statusCode: 404,
        });
    }));
    (0, vitest_1.it)('returns an existing chat when one already exists for the two participants', () => __awaiter(void 0, void 0, void 0, function* () {
        const userA = yield createUser();
        const userB = yield createUser();
        const first = yield chat_service_1.ChatService.createOrGet(userA._id.toString(), userB._id.toString());
        const second = yield chat_service_1.ChatService.createOrGet(userA._id.toString(), userB._id.toString());
        (0, vitest_1.expect)(first._id.toString()).toBe(second._id.toString());
        const count = yield chat_model_1.Chat.countDocuments();
        (0, vitest_1.expect)(count).toBe(1);
    }));
});
(0, vitest_1.describe)('ChatService.getList', () => {
    /**
     * Requirement 4.8 — getList returns empty array when no chats exist
     */
    (0, vitest_1.it)('returns an empty array when the user has no chats', () => __awaiter(void 0, void 0, void 0, function* () {
        const userId = new mongoose_1.default.Types.ObjectId().toString();
        const result = yield chat_service_1.ChatService.getList(userId);
        (0, vitest_1.expect)(result).toEqual([]);
    }));
    (0, vitest_1.it)('throws 400 when userId is not a valid ObjectId', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, vitest_1.expect)(chat_service_1.ChatService.getList('not-a-valid-objectid')).rejects.toMatchObject({
            statusCode: 400,
        });
    }));
    (0, vitest_1.it)('returns chats with unreadCount 0 when Redis returns no data', () => __awaiter(void 0, void 0, void 0, function* () {
        const userA = yield createUser();
        const userB = yield createUser();
        yield chat_model_1.Chat.create({ participants: [userA._id, userB._id] });
        // mget returns null for every key → unreadCount should be 0
        const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
        vitest_1.vi.mocked(redisClient.mget).mockResolvedValue([null]);
        const result = yield chat_service_1.ChatService.getList(userA._id.toString());
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].unreadCount).toBe(0);
    }));
});
