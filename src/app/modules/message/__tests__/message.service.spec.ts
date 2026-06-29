/**
 * Unit tests for MessageService
 * Task 12.2 — Requirements: 5.1, 5.2, 6.6, 7.2, 7.5
 *
 * Uses mongodb-memory-server for DB-touching tests.
 * Mocks redisClient and SocketManager to isolate service logic.
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
  },
}));

vi.mock('../../../../helpers/socketManager', () => ({
  SocketManager: {
    init: vi.fn(),
    getIO: vi.fn().mockReturnValue({
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    }),
  },
}));

// Mock notification helper to avoid Firebase initialisation in tests
vi.mock('../../notification/notificationsHelper', () => ({
  sendNotifications: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { MessageService } from '../message.service';
import { Chat } from '../../chat/chat.model';
import { Message } from '../message.model';
import { SocketManager } from '../../../../helpers/socketManager';

// ── Test helpers ─────────────────────────────────────────────────────────────

let mongod: MongoMemoryServer;

/** Create a minimal Chat document with two participants. */
async function createChat(participantA: mongoose.Types.ObjectId, participantB: mongoose.Types.ObjectId) {
  return Chat.create({ participants: [participantA, participantB] });
}

/** Create a minimal User-like ObjectId (no User model needed for these tests). */
function newId() {
  return new mongoose.Types.ObjectId();
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
  // Clear collections between tests
  await Chat.deleteMany({});
  await Message.deleteMany({});
  vi.clearAllMocks();

  // Re-apply default mock implementations after clearAllMocks
  const { redisClient } = await import('../../../../shared/redisClient');
  vi.mocked(redisClient.get).mockResolvedValue(null);
  vi.mocked(redisClient.set).mockResolvedValue('OK');
  vi.mocked(redisClient.incrby).mockResolvedValue(1);

  vi.mocked(SocketManager.getIO).mockReturnValue({
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as any);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessageService.send', () => {
  /**
   * Requirement 5.1 — send with non-existent chatId → 404
   */
  it('throws 404 when chatId does not exist in the database', async () => {
    const nonExistentChatId = newId().toString();
    const senderId = newId().toString();

    await expect(
      MessageService.send(nonExistentChatId, senderId, {
        text: 'Hello',
        type: 'text',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  /**
   * Requirement 5.2 — send with sender not in participants → 403
   */
  it('throws 403 when senderId is not a participant of the chat', async () => {
    const participantA = newId();
    const participantB = newId();
    const outsider = newId();

    const chat = await createChat(participantA, participantB);

    await expect(
      MessageService.send(chat._id.toString(), outsider.toString(), {
        text: 'Hello',
        type: 'text',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('MessageService.getHistory', () => {
  /**
   * Requirement 6.6 — getHistory with invalid ObjectId → 400
   */
  it('throws 400 when chatId is not a valid ObjectId', async () => {
    const invalidChatId = 'not-a-valid-objectid';
    const validUserId = newId().toString();

    await expect(
      MessageService.getHistory(invalidChatId, validUserId),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 400 when userId is not a valid ObjectId', async () => {
    const validChatId = newId().toString();
    const invalidUserId = 'also-not-valid';

    await expect(
      MessageService.getHistory(validChatId, invalidUserId),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('MessageService.markRead', () => {
  /**
   * Requirement 7.2 — markRead with user not a participant → 403
   */
  it('throws 403 when userId is not a participant of the chat', async () => {
    const participantA = newId();
    const participantB = newId();
    const outsider = newId();

    const chat = await createChat(participantA, participantB);

    await expect(
      MessageService.markRead(chat._id.toString(), outsider.toString()),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  /**
   * Requirement 7.5 — markRead with no unread messages → { modifiedCount: 0, updatedIds: [] },
   * no socket event emitted.
   */
  it('returns { modifiedCount: 0, updatedIds: [] } and does not emit a socket event when there are no unread messages', async () => {
    const participantA = newId();
    const participantB = newId();

    const chat = await createChat(participantA, participantB);

    // Create a message already read by participantB (so nothing is unread for them)
    await Message.create({
      chatId: chat._id,
      sender: participantA,
      text: 'Already read',
      type: 'text',
      readBy: [participantB],
    });

    const mockEmit = vi.fn();
    const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    vi.mocked(SocketManager.getIO).mockReturnValue({ to: mockTo } as any);

    const result = await MessageService.markRead(
      chat._id.toString(),
      participantB.toString(),
    );

    expect(result).toEqual({ modifiedCount: 0, updatedIds: [] });
    // No socket event should have been emitted
    expect(mockTo).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('returns { modifiedCount: 0, updatedIds: [] } when the chat has no messages at all', async () => {
    const participantA = newId();
    const participantB = newId();

    const chat = await createChat(participantA, participantB);

    const mockEmit = vi.fn();
    const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    vi.mocked(SocketManager.getIO).mockReturnValue({ to: mockTo } as any);

    const result = await MessageService.markRead(
      chat._id.toString(),
      participantA.toString(),
    );

    expect(result).toEqual({ modifiedCount: 0, updatedIds: [] });
    expect(mockTo).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
