/**
 * Integration tests for ChatService
 * Task 13.3 — Requirements: 4.4, 9.5, 10.2
 *
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks redisClient from src/shared/redisClient.ts to simulate Redis
 * unavailability (mget throws), verifying that getList degrades gracefully
 * by returning unreadCount: 0 for all chats without throwing.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ── Mocks (must be declared before importing the modules that use them) ──────

vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    incrby: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    mget: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { ChatService } from '../chat.service';
import { Chat } from '../chat.model';
import { User } from '../../user/user.model';

// ── Test helpers ─────────────────────────────────────────────────────────────

let mongod: MongoMemoryServer;

/** Create a minimal User document with required fields. */
async function createUser(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  return User.create({
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
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Chat.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();

  // Re-apply default mock implementations after clearAllMocks
  const { redisClient } = await import('../../../../shared/redisClient');
  vi.mocked(redisClient.mget).mockResolvedValue([]);
  vi.mocked(redisClient.get).mockResolvedValue(null);
  vi.mocked(redisClient.set).mockResolvedValue('OK');
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChatService.getList — Redis unavailable', () => {
  /**
   * Requirements 4.4, 9.5, 10.2
   *
   * When Redis is unavailable (mget throws), getList must:
   *   - still return the chat list without throwing
   *   - set unreadCount to 0 for every chat
   */
  it('returns unreadCount: 0 for all chats when Redis mget throws', async () => {
    // Arrange: two users and a chat between them
    const userA = await createUser('a');
    const userB = await createUser('b');
    await Chat.create({ participants: [userA._id, userB._id] });

    // Simulate Redis unavailability — mget throws a connection error
    const { redisClient } = await import('../../../../shared/redisClient');
    vi.mocked(redisClient.mget).mockRejectedValue(
      new Error('Redis connection refused'),
    );

    // Act: getList should not throw even though Redis is down
    const result = await ChatService.getList(userA._id.toString());

    // Assert: chat is returned with unreadCount of 0
    expect(result).toHaveLength(1);
    expect(result[0].unreadCount).toBe(0);
  });

  it('returns unreadCount: 0 for multiple chats when Redis mget throws', async () => {
    // Arrange: three users and two chats for userA
    const userA = await createUser('a2');
    const userB = await createUser('b2');
    const userC = await createUser('c2');
    await Chat.create({ participants: [userA._id, userB._id] });
    await Chat.create({ participants: [userA._id, userC._id] });

    // Simulate Redis unavailability
    const { redisClient } = await import('../../../../shared/redisClient');
    vi.mocked(redisClient.mget).mockRejectedValue(
      new Error('Redis timeout'),
    );

    // Act
    const result = await ChatService.getList(userA._id.toString());

    // Assert: both chats are returned, each with unreadCount of 0
    expect(result).toHaveLength(2);
    expect(result.every(chat => chat.unreadCount === 0)).toBe(true);
  });

  it('does not throw when Redis mget throws — error is swallowed gracefully', async () => {
    // Arrange
    const userA = await createUser('a3');
    const userB = await createUser('b3');
    await Chat.create({ participants: [userA._id, userB._id] });

    const { redisClient } = await import('../../../../shared/redisClient');
    vi.mocked(redisClient.mget).mockRejectedValue(
      new Error('ECONNREFUSED'),
    );

    // Act + Assert: must resolve, not reject
    await expect(
      ChatService.getList(userA._id.toString()),
    ).resolves.toBeDefined();
  });
});
