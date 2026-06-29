/**
 * Unit tests for ChatService
 * Task 12.1 — Requirements: 3.3, 3.4, 4.8
 *
 * Uses mongodb-memory-server for DB-touching tests.
 * Mocks redisClient from src/shared/redisClient.ts to isolate service logic.
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
async function createUser() {
  return User.create({
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
}

/** Return a new ObjectId string that does not correspond to any document. */
function nonExistentId() {
  return new mongoose.Types.ObjectId().toString();
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

describe('ChatService.createOrGet', () => {
  /**
   * Requirement 3.3 — userId === otherUserId → 400
   */
  it('throws 400 when userId equals otherUserId', async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    await expect(
      ChatService.createOrGet(userId, userId),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  /**
   * Requirement 3.4 — non-existent otherUserId → 404
   */
  it('throws 404 when otherUserId does not exist in the User collection', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const ghostUserId = nonExistentId();

    await expect(
      ChatService.createOrGet(userId, ghostUserId),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('returns an existing chat when one already exists for the two participants', async () => {
    const userA = await createUser();
    const userB = await createUser();

    const first = await ChatService.createOrGet(
      userA._id.toString(),
      userB._id.toString(),
    );
    const second = await ChatService.createOrGet(
      userA._id.toString(),
      userB._id.toString(),
    );

    expect((first as any)._id.toString()).toBe((second as any)._id.toString());
    const count = await Chat.countDocuments();
    expect(count).toBe(1);
  });
});

describe('ChatService.getList', () => {
  /**
   * Requirement 4.8 — getList returns empty array when no chats exist
   */
  it('returns an empty array when the user has no chats', async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    const result = await ChatService.getList(userId);

    expect(result).toEqual([]);
  });

  it('throws 400 when userId is not a valid ObjectId', async () => {
    await expect(
      ChatService.getList('not-a-valid-objectid'),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('returns chats with unreadCount 0 when Redis returns no data', async () => {
    const userA = await createUser();
    const userB = await createUser();

    await Chat.create({ participants: [userA._id, userB._id] });

    // mget returns null for every key → unreadCount should be 0
    const { redisClient } = await import('../../../../shared/redisClient');
    vi.mocked(redisClient.mget).mockResolvedValue([null]);

    const result = await ChatService.getList(userA._id.toString());

    expect(result).toHaveLength(1);
    expect(result[0].unreadCount).toBe(0);
  });
});
