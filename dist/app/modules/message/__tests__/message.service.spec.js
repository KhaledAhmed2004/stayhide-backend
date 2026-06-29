"use strict";
/**
 * Unit tests for MessageService
 * Task 12.2 — Requirements: 5.1, 5.2, 6.6, 7.2, 7.5
 *
 * Uses mongodb-memory-server for DB-touching tests.
 * Mocks redisClient and SocketManager to isolate service logic.
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
    },
}));
vitest_1.vi.mock('../../../../helpers/socketManager', () => ({
    SocketManager: {
        init: vitest_1.vi.fn(),
        getIO: vitest_1.vi.fn().mockReturnValue({
            to: vitest_1.vi.fn().mockReturnThis(),
            emit: vitest_1.vi.fn(),
        }),
    },
}));
// Mock notification helper to avoid Firebase initialisation in tests
vitest_1.vi.mock('../../notification/notificationsHelper', () => ({
    sendNotifications: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
// ── Imports (after mocks) ────────────────────────────────────────────────────
const message_service_1 = require("../message.service");
const chat_model_1 = require("../../chat/chat.model");
const message_model_1 = require("../message.model");
const socketManager_1 = require("../../../../helpers/socketManager");
// ── Test helpers ─────────────────────────────────────────────────────────────
let mongod;
/** Create a minimal Chat document with two participants. */
function createChat(participantA, participantB) {
    return __awaiter(this, void 0, void 0, function* () {
        return chat_model_1.Chat.create({ participants: [participantA, participantB] });
    });
}
/** Create a minimal User-like ObjectId (no User model needed for these tests). */
function newId() {
    return new mongoose_1.default.Types.ObjectId();
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
    // Clear collections between tests
    yield chat_model_1.Chat.deleteMany({});
    yield message_model_1.Message.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Re-apply default mock implementations after clearAllMocks
    const { redisClient } = yield Promise.resolve().then(() => __importStar(require('../../../../shared/redisClient')));
    vitest_1.vi.mocked(redisClient.get).mockResolvedValue(null);
    vitest_1.vi.mocked(redisClient.set).mockResolvedValue('OK');
    vitest_1.vi.mocked(redisClient.incrby).mockResolvedValue(1);
    vitest_1.vi.mocked(socketManager_1.SocketManager.getIO).mockReturnValue({
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    });
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('MessageService.send', () => {
    /**
     * Requirement 5.1 — send with non-existent chatId → 404
     */
    (0, vitest_1.it)('throws 404 when chatId does not exist in the database', () => __awaiter(void 0, void 0, void 0, function* () {
        const nonExistentChatId = newId().toString();
        const senderId = newId().toString();
        yield (0, vitest_1.expect)(message_service_1.MessageService.send(nonExistentChatId, senderId, {
            text: 'Hello',
            type: 'text',
        })).rejects.toMatchObject({
            statusCode: 404,
        });
    }));
    /**
     * Requirement 5.2 — send with sender not in participants → 403
     */
    (0, vitest_1.it)('throws 403 when senderId is not a participant of the chat', () => __awaiter(void 0, void 0, void 0, function* () {
        const participantA = newId();
        const participantB = newId();
        const outsider = newId();
        const chat = yield createChat(participantA, participantB);
        yield (0, vitest_1.expect)(message_service_1.MessageService.send(chat._id.toString(), outsider.toString(), {
            text: 'Hello',
            type: 'text',
        })).rejects.toMatchObject({
            statusCode: 403,
        });
    }));
});
(0, vitest_1.describe)('MessageService.getHistory', () => {
    /**
     * Requirement 6.6 — getHistory with invalid ObjectId → 400
     */
    (0, vitest_1.it)('throws 400 when chatId is not a valid ObjectId', () => __awaiter(void 0, void 0, void 0, function* () {
        const invalidChatId = 'not-a-valid-objectid';
        const validUserId = newId().toString();
        yield (0, vitest_1.expect)(message_service_1.MessageService.getHistory(invalidChatId, validUserId)).rejects.toMatchObject({
            statusCode: 400,
        });
    }));
    (0, vitest_1.it)('throws 400 when userId is not a valid ObjectId', () => __awaiter(void 0, void 0, void 0, function* () {
        const validChatId = newId().toString();
        const invalidUserId = 'also-not-valid';
        yield (0, vitest_1.expect)(message_service_1.MessageService.getHistory(validChatId, invalidUserId)).rejects.toMatchObject({
            statusCode: 400,
        });
    }));
});
(0, vitest_1.describe)('MessageService.markRead', () => {
    /**
     * Requirement 7.2 — markRead with user not a participant → 403
     */
    (0, vitest_1.it)('throws 403 when userId is not a participant of the chat', () => __awaiter(void 0, void 0, void 0, function* () {
        const participantA = newId();
        const participantB = newId();
        const outsider = newId();
        const chat = yield createChat(participantA, participantB);
        yield (0, vitest_1.expect)(message_service_1.MessageService.markRead(chat._id.toString(), outsider.toString())).rejects.toMatchObject({
            statusCode: 403,
        });
    }));
    /**
     * Requirement 7.5 — markRead with no unread messages → { modifiedCount: 0, updatedIds: [] },
     * no socket event emitted.
     */
    (0, vitest_1.it)('returns { modifiedCount: 0, updatedIds: [] } and does not emit a socket event when there are no unread messages', () => __awaiter(void 0, void 0, void 0, function* () {
        const participantA = newId();
        const participantB = newId();
        const chat = yield createChat(participantA, participantB);
        // Create a message already read by participantB (so nothing is unread for them)
        yield message_model_1.Message.create({
            chatId: chat._id,
            sender: participantA,
            text: 'Already read',
            type: 'text',
            readBy: [participantB],
        });
        const mockEmit = vitest_1.vi.fn();
        const mockTo = vitest_1.vi.fn().mockReturnValue({ emit: mockEmit });
        vitest_1.vi.mocked(socketManager_1.SocketManager.getIO).mockReturnValue({ to: mockTo });
        const result = yield message_service_1.MessageService.markRead(chat._id.toString(), participantB.toString());
        (0, vitest_1.expect)(result).toEqual({ modifiedCount: 0, updatedIds: [] });
        // No socket event should have been emitted
        (0, vitest_1.expect)(mockTo).not.toHaveBeenCalled();
        (0, vitest_1.expect)(mockEmit).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('returns { modifiedCount: 0, updatedIds: [] } when the chat has no messages at all', () => __awaiter(void 0, void 0, void 0, function* () {
        const participantA = newId();
        const participantB = newId();
        const chat = yield createChat(participantA, participantB);
        const mockEmit = vitest_1.vi.fn();
        const mockTo = vitest_1.vi.fn().mockReturnValue({ emit: mockEmit });
        vitest_1.vi.mocked(socketManager_1.SocketManager.getIO).mockReturnValue({ to: mockTo });
        const result = yield message_service_1.MessageService.markRead(chat._id.toString(), participantA.toString());
        (0, vitest_1.expect)(result).toEqual({ modifiedCount: 0, updatedIds: [] });
        (0, vitest_1.expect)(mockTo).not.toHaveBeenCalled();
        (0, vitest_1.expect)(mockEmit).not.toHaveBeenCalled();
    }));
});
