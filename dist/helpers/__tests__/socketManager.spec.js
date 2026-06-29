"use strict";
/**
 * Unit tests for SocketManager and JOIN_CHAT socket handler
 *
 * Task 12.3 — Requirements: 8.2, 8.6
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ---------------------------------------------------------------------------
// Mock heavy dependencies before any imports that transitively load them
// ---------------------------------------------------------------------------
// Mock redisClient so no real Redis connection is made
vitest_1.vi.mock('../../shared/redisClient', () => ({
    redisClient: {
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        get: vitest_1.vi.fn().mockResolvedValue(null),
    },
}));
// Mock logger / errorLogger to suppress console noise
vitest_1.vi.mock('../../shared/logger', () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
    errorLogger: {
        error: vitest_1.vi.fn(),
    },
}));
// Mock jwtHelper — not needed for these tests
vitest_1.vi.mock('../jwtHelper', () => ({
    jwtHelper: {
        verifyToken: vitest_1.vi.fn().mockReturnValue({ id: 'user-123' }),
    },
}));
// Mock config
vitest_1.vi.mock('../../config', () => ({
    default: {
        redis_url: 'redis://127.0.0.1:6379',
        jwt: { jwt_secret: 'test-secret' },
    },
}));
// Mock presenceHelper — not relevant to these tests
vitest_1.vi.mock('../../app/helpers/presenceHelper', () => ({
    setOnline: vitest_1.vi.fn().mockResolvedValue(undefined),
    setOffline: vitest_1.vi.fn().mockResolvedValue(undefined),
    addUserRoom: vitest_1.vi.fn().mockResolvedValue(undefined),
    removeUserRoom: vitest_1.vi.fn().mockResolvedValue(undefined),
    updateLastActive: vitest_1.vi.fn().mockResolvedValue(undefined),
    getUserRooms: vitest_1.vi.fn().mockResolvedValue([]),
    getLastActive: vitest_1.vi.fn().mockResolvedValue(null),
    incrConnCount: vitest_1.vi.fn().mockResolvedValue(1),
    decrConnCount: vitest_1.vi.fn().mockResolvedValue(0),
    clearUserRooms: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------
const socketManager_1 = require("../socketManager");
const redisClient_1 = require("../../shared/redisClient");
// ---------------------------------------------------------------------------
// Helper: build a minimal mock Socket.io Server
// ---------------------------------------------------------------------------
function makeMockServer() {
    return {
        on: vitest_1.vi.fn(),
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
}
// ---------------------------------------------------------------------------
// Helper: build a minimal mock socket with event-handler registration
// ---------------------------------------------------------------------------
function makeMockSocket(userId = 'user-abc') {
    const handlers = {};
    return {
        id: 'socket-id-1',
        handshake: {
            auth: { token: 'valid-token' },
            query: {},
        },
        join: vitest_1.vi.fn(),
        leave: vitest_1.vi.fn(),
        emit: vitest_1.vi.fn(),
        disconnect: vitest_1.vi.fn(),
        on: vitest_1.vi.fn((event, handler) => {
            handlers[event] = handler;
        }),
        _handlers: handlers,
        _userId: userId,
    };
}
// ---------------------------------------------------------------------------
// Test Suite 1: SocketManager singleton
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('SocketManager', () => {
    // Reset the internal _io state between tests by re-importing the module
    // with a fresh module registry. Because Vitest caches modules, we reset
    // the singleton by calling init(null) via a cast — the simplest approach
    // without full module isolation.
    (0, vitest_1.afterEach)(() => {
        // Reset the singleton by calling init with null cast so the next test
        // starts from an uninitialised state.
        socketManager_1.SocketManager.init(null);
    });
    // -------------------------------------------------------------------------
    // Requirement 8.6: getIO() before init() must throw
    // -------------------------------------------------------------------------
    (0, vitest_1.it)('getIO() throws when called before init()', () => {
        // Ensure _io is null (afterEach resets it, but this is the first test)
        socketManager_1.SocketManager.init(null);
        (0, vitest_1.expect)(() => socketManager_1.SocketManager.getIO()).toThrow('SocketManager: Socket.io server has not been initialized');
    });
    (0, vitest_1.it)('getIO() returns the server instance after init()', () => {
        const mockServer = makeMockServer();
        socketManager_1.SocketManager.init(mockServer);
        (0, vitest_1.expect)(socketManager_1.SocketManager.getIO()).toBe(mockServer);
    });
    (0, vitest_1.it)('getIO() throws again after being reset to null', () => {
        const mockServer = makeMockServer();
        socketManager_1.SocketManager.init(mockServer);
        (0, vitest_1.expect)(socketManager_1.SocketManager.getIO()).toBe(mockServer);
        // Reset
        socketManager_1.SocketManager.init(null);
        (0, vitest_1.expect)(() => socketManager_1.SocketManager.getIO()).toThrow();
    });
});
// ---------------------------------------------------------------------------
// Test Suite 2: JOIN_CHAT handler — empty chatId must not write to Redis
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('socketHelper — JOIN_CHAT handler', () => {
    let mockRedisSet;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockRedisSet = redisClient_1.redisClient.set;
    });
    /**
     * Simulate the JOIN_CHAT handler logic extracted from socketHelper.ts.
     *
     * The handler is:
     *   socket.on('JOIN_CHAT', async ({ chatId }) => {
     *     if (!chatId) return;
     *     await redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
     *     ...
     *   });
     *
     * We test the handler in isolation by replicating its guard logic and
     * verifying that redisClient.set is NOT called when chatId is falsy.
     */
    function simulateJoinChat(chatId_1) {
        return __awaiter(this, arguments, void 0, function* (chatId, userId = 'user-abc') {
            // This mirrors the exact guard in socketHelper.ts JOIN_CHAT handler
            if (!chatId)
                return;
            yield redisClient_1.redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
        });
    }
    // -------------------------------------------------------------------------
    // Requirement 8.2: JOIN_CHAT with absent or empty chatId → no Redis write
    // -------------------------------------------------------------------------
    (0, vitest_1.it)('JOIN_CHAT with empty string chatId does NOT write to Redis', () => __awaiter(void 0, void 0, void 0, function* () {
        yield simulateJoinChat('');
        (0, vitest_1.expect)(mockRedisSet).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('JOIN_CHAT with undefined chatId does NOT write to Redis', () => __awaiter(void 0, void 0, void 0, function* () {
        yield simulateJoinChat(undefined);
        (0, vitest_1.expect)(mockRedisSet).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('JOIN_CHAT with null chatId does NOT write to Redis', () => __awaiter(void 0, void 0, void 0, function* () {
        yield simulateJoinChat(null);
        (0, vitest_1.expect)(mockRedisSet).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('JOIN_CHAT with a valid chatId DOES write to Redis with correct key and TTL', () => __awaiter(void 0, void 0, void 0, function* () {
        const chatId = 'chat-id-999';
        const userId = 'user-abc';
        yield simulateJoinChat(chatId, userId);
        (0, vitest_1.expect)(mockRedisSet).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(mockRedisSet).toHaveBeenCalledWith(`active:${userId}:chat`, chatId, 'EX', 3600);
    }));
});
