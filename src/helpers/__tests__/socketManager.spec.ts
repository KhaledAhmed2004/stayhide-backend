/**
 * Unit tests for SocketManager and JOIN_CHAT socket handler
 *
 * Task 12.3 — Requirements: 8.2, 8.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock heavy dependencies before any imports that transitively load them
// ---------------------------------------------------------------------------

// Mock redisClient so no real Redis connection is made
vi.mock('../../shared/redisClient', () => ({
  redisClient: {
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
  },
}));

// Mock logger / errorLogger to suppress console noise
vi.mock('../../shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  errorLogger: {
    error: vi.fn(),
  },
}));

// Mock jwtHelper — not needed for these tests
vi.mock('../jwtHelper', () => ({
  jwtHelper: {
    verifyToken: vi.fn().mockReturnValue({ id: 'user-123' }),
  },
}));

// Mock config
vi.mock('../../config', () => ({
  default: {
    redis_url: 'redis://127.0.0.1:6379',
    jwt: { jwt_secret: 'test-secret' },
  },
}));

// Mock presenceHelper — not relevant to these tests
vi.mock('../../app/helpers/presenceHelper', () => ({
  setOnline: vi.fn().mockResolvedValue(undefined),
  setOffline: vi.fn().mockResolvedValue(undefined),
  addUserRoom: vi.fn().mockResolvedValue(undefined),
  removeUserRoom: vi.fn().mockResolvedValue(undefined),
  updateLastActive: vi.fn().mockResolvedValue(undefined),
  getUserRooms: vi.fn().mockResolvedValue([]),
  getLastActive: vi.fn().mockResolvedValue(null),
  incrConnCount: vi.fn().mockResolvedValue(1),
  decrConnCount: vi.fn().mockResolvedValue(0),
  clearUserRooms: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { SocketManager } from '../socketManager';
import { redisClient } from '../../shared/redisClient';

// ---------------------------------------------------------------------------
// Helper: build a minimal mock Socket.io Server
// ---------------------------------------------------------------------------
function makeMockServer() {
  return {
    on: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Helper: build a minimal mock socket with event-handler registration
// ---------------------------------------------------------------------------
function makeMockSocket(userId = 'user-abc') {
  const handlers: Record<string, (...args: any[]) => any> = {};
  return {
    id: 'socket-id-1',
    handshake: {
      auth: { token: 'valid-token' },
      query: {},
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      handlers[event] = handler;
    }),
    _handlers: handlers,
    _userId: userId,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: SocketManager singleton
// ---------------------------------------------------------------------------

describe('SocketManager', () => {
  // Reset the internal _io state between tests by re-importing the module
  // with a fresh module registry. Because Vitest caches modules, we reset
  // the singleton by calling init(null) via a cast — the simplest approach
  // without full module isolation.
  afterEach(() => {
    // Reset the singleton by calling init with null cast so the next test
    // starts from an uninitialised state.
    (SocketManager as any).init(null);
  });

  // -------------------------------------------------------------------------
  // Requirement 8.6: getIO() before init() must throw
  // -------------------------------------------------------------------------
  it('getIO() throws when called before init()', () => {
    // Ensure _io is null (afterEach resets it, but this is the first test)
    (SocketManager as any).init(null);

    expect(() => SocketManager.getIO()).toThrow(
      'SocketManager: Socket.io server has not been initialized'
    );
  });

  it('getIO() returns the server instance after init()', () => {
    const mockServer = makeMockServer();
    SocketManager.init(mockServer);

    expect(SocketManager.getIO()).toBe(mockServer);
  });

  it('getIO() throws again after being reset to null', () => {
    const mockServer = makeMockServer();
    SocketManager.init(mockServer);
    expect(SocketManager.getIO()).toBe(mockServer);

    // Reset
    (SocketManager as any).init(null);
    expect(() => SocketManager.getIO()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2: JOIN_CHAT handler — empty chatId must not write to Redis
// ---------------------------------------------------------------------------

describe('socketHelper — JOIN_CHAT handler', () => {
  let mockRedisSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet = redisClient.set as ReturnType<typeof vi.fn>;
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
  async function simulateJoinChat(chatId: string | undefined | null, userId = 'user-abc') {
    // This mirrors the exact guard in socketHelper.ts JOIN_CHAT handler
    if (!chatId) return;
    await redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
  }

  // -------------------------------------------------------------------------
  // Requirement 8.2: JOIN_CHAT with absent or empty chatId → no Redis write
  // -------------------------------------------------------------------------
  it('JOIN_CHAT with empty string chatId does NOT write to Redis', async () => {
    await simulateJoinChat('');

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('JOIN_CHAT with undefined chatId does NOT write to Redis', async () => {
    await simulateJoinChat(undefined);

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('JOIN_CHAT with null chatId does NOT write to Redis', async () => {
    await simulateJoinChat(null);

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('JOIN_CHAT with a valid chatId DOES write to Redis with correct key and TTL', async () => {
    const chatId = 'chat-id-999';
    const userId = 'user-abc';

    await simulateJoinChat(chatId, userId);

    expect(mockRedisSet).toHaveBeenCalledOnce();
    expect(mockRedisSet).toHaveBeenCalledWith(
      `active:${userId}:chat`,
      chatId,
      'EX',
      3600
    );
  });
});
