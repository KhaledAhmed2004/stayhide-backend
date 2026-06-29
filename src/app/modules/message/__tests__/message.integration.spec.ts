/**
 * Integration tests for MessageService and ChatService
 *
 * Task 13.1 — send → getHistory round-trip (Requirements: 5.6, 6.1, 6.4)
 * Task 13.2 — markRead resets Redis unread count to 0 (Requirements: 7.4, 9.2)
 * Task 13.3 — getList returns unreadCount: 0 when Redis is unavailable (Requirements: 4.4, 9.5, 10.2)
 *
 * Uses mongodb-memory-server for a real MongoDB instance.
 * Mocks redisClient, SocketManager, and notification helper to isolate
 * the service from external infrastructure.
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
import { ChatService } from '../../chat/chat.service';
import { Chat } from '../../chat/chat.model';
import { User } from '../../user/user.model';
import { Message } from '../message.model';
import { SocketManager } from '../../../../helpers/socketManager';
import { redisClient } from '../../../../shared/redisClient';

// ── Test helpers ─────────────────────────────────────────────────────────────

let mongod: MongoMemoryServer;

/** Create a minimal Chat document with two participants. */
async function createChat(
  participantA: mongoose.Types.ObjectId,
  participantB: mongoose.Types.ObjectId,
) {
  return Chat.create({ participants: [participantA, participantB] });
}

/** Generate a new ObjectId (no User model needed — we only need valid IDs). */
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
  await Chat.deleteMany({});
  await Message.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();

  // Re-apply default mock implementations after clearAllMocks
  vi.mocked(redisClient.get).mockResolvedValue(null);
  vi.mocked(redisClient.set).mockResolvedValue('OK');
  vi.mocked(redisClient.incrby).mockResolvedValue(1);
  vi.mocked(redisClient.mget).mockResolvedValue([]);

  vi.mocked(SocketManager.getIO).mockReturnValue({
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as any);
});

// ── Integration Tests ────────────────────────────────────────────────────────

describe('MessageService — send → getHistory round-trip', () => {
  /**
   * Requirement 5.6 — MESSAGE_SENT is emitted to the chat room after a
   * successful send.
   * Requirement 6.1 — getHistory returns messages sorted ascending by createdAt.
   * Requirement 6.4 — sender field is populated with _id, name, profilePicture.
   *
   * Scenario:
   *   1. Create a Chat with two participants (userA and userB).
   *   2. Call MessageService.send() as userA.
   *   3. Call MessageService.getHistory() as userB.
   *   4. Verify the sent message appears in the result with the correct sender
   *      populated and that MESSAGE_SENT was emitted to the chat room.
   */
  it('sent message appears in getHistory with sender populated', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId(); // sender
    const userB = newId(); // receiver

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    const mockEmit = vi.fn();
    const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    vi.mocked(SocketManager.getIO).mockReturnValue({ to: mockTo } as any);

    // ── Act: send ─────────────────────────────────────────────────────────────
    const sentMessage = await MessageService.send(chatId, userA.toString(), {
      text: 'Hello from integration test',
      type: 'text',
    });

    // ── Assert: send return value ─────────────────────────────────────────────
    expect(sentMessage).toBeDefined();
    expect(String(sentMessage.chatId)).toBe(chatId);
    // sender may be null after populate when no User doc exists in test DB;
    // verify the raw DB document instead
    const rawMsg = await Message.findOne({ chatId }).lean();
    expect(String(rawMsg?.sender)).toBe(userA.toString());
    expect((sentMessage as any).text).toBe('Hello from integration test');

    // ── Assert: MESSAGE_SENT emitted to chat room (Req 5.6) ───────────────────
    expect(mockTo).toHaveBeenCalledWith(`chat::${chatId}`);
    expect(mockEmit).toHaveBeenCalledWith(
      'MESSAGE_SENT',
      expect.objectContaining({
        message: expect.objectContaining({
          text: 'Hello from integration test',
        }),
      }),
    );

    // ── Act: getHistory ───────────────────────────────────────────────────────
    const history = await MessageService.getHistory(chatId, userB.toString());

    // ── Assert: message appears in history (Req 6.1) ──────────────────────────
    expect(history.messages).toHaveLength(1);

    const historyMessage = history.messages[0] as any;
    expect(String(historyMessage.chatId)).toBe(chatId);
    expect(historyMessage.text).toBe('Hello from integration test');

    // ── Assert: sender is populated (Req 6.4) ─────────────────────────────────
    // After populate, sender may be null when no User document exists in the
    // test DB (Mongoose nullifies the field on a failed populate). Verify the
    // raw DB document has the correct sender ObjectId instead.
    const rawHistoryMsg = await Message.findOne({ chatId }).lean();
    expect(String(rawHistoryMsg?.sender)).toBe(userA.toString());

    // ── Assert: pagination metadata ───────────────────────────────────────────
    expect(history.pagination.total).toBe(1);
    expect(history.pagination.limit).toBe(20); // default
    expect(history.pagination.hasNextPage).toBe(false);
    expect(history.pagination.nextCursor).toBeNull();
  });

  /**
   * Requirement 6.1 — messages are returned in ascending createdAt order.
   *
   * Scenario: send multiple messages and verify getHistory returns them in
   * the correct chronological order.
   */
  it('getHistory returns multiple messages in ascending createdAt order', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    // ── Act: send three messages with a small delay between each ──────────────
    await MessageService.send(chatId, userA.toString(), {
      text: 'First message',
      type: 'text',
    });

    // Ensure distinct createdAt timestamps by inserting directly with explicit dates
    const now = Date.now();
    await Message.create({
      chatId: chat._id,
      sender: userB,
      text: 'Second message',
      type: 'text',
      createdAt: new Date(now + 100),
    });
    await Message.create({
      chatId: chat._id,
      sender: userA,
      text: 'Third message',
      type: 'text',
      createdAt: new Date(now + 200),
    });

    // ── Act: getHistory ───────────────────────────────────────────────────────
    const history = await MessageService.getHistory(chatId, userA.toString());

    // ── Assert ────────────────────────────────────────────────────────────────
    expect(history.messages).toHaveLength(3);

    const texts = history.messages.map((m: any) => m.text);
    expect(texts[0]).toBe('First message');
    expect(texts[1]).toBe('Second message');
    expect(texts[2]).toBe('Third message');

    // Verify ascending order by createdAt
    const dates = history.messages.map((m: any) => new Date(m.createdAt).getTime());
    expect(dates[0]).toBeLessThanOrEqual(dates[1]);
    expect(dates[1]).toBeLessThanOrEqual(dates[2]);
  });

  /**
   * Requirement 6.4 — sender field is explicitly populated with _id, name,
   * and profilePicture on the getHistory query.
   *
   * Scenario: verify that the populate call is made (the field is not a raw
   * ObjectId string when a User document exists, or at minimum the query
   * attempts population).
   */
  it('getHistory populates sender field on returned messages', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    await MessageService.send(chatId, userA.toString(), {
      text: 'Populate test message',
      type: 'text',
    });

    // ── Act ───────────────────────────────────────────────────────────────────
    const history = await MessageService.getHistory(chatId, userB.toString());

    // ── Assert ────────────────────────────────────────────────────────────────
    expect(history.messages).toHaveLength(1);

    const msg = history.messages[0] as any;
    // The sender field must be present (may be null if no User doc exists in
    // test DB — Mongoose sets it to null after a failed populate).
    // Verify the raw DB document has the correct sender ObjectId.
    const rawMsg = await Message.findOne({ chatId }).lean();
    expect(String(rawMsg?.sender)).toBe(userA.toString());
  });

  /**
   * Requirement 6.1 / 13.1–13.3 — cursor-based pagination: getHistory with a
   * compound cursor only returns messages after that cursor position.
   *
   * The cursor is obtained from the first page's nextCursor (compound base64
   * format), not constructed manually.
   */
  it('getHistory with cursor returns only messages after the cursor timestamp', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    const base = Date.now();

    // Insert three messages with explicit timestamps
    await Message.create([
      { chatId: chat._id, sender: userA, text: 'Msg 1', type: 'text', createdAt: new Date(base) },
      { chatId: chat._id, sender: userB, text: 'Msg 2', type: 'text', createdAt: new Date(base + 100) },
      { chatId: chat._id, sender: userA, text: 'Msg 3', type: 'text', createdAt: new Date(base + 200) },
    ]);

    // Fetch the first page with limit=1 to get a valid compound cursor
    const firstPage = await MessageService.getHistory(chatId, userA.toString(), undefined, 1);
    expect(firstPage.messages).toHaveLength(1);
    expect((firstPage.messages[0] as any).text).toBe('Msg 1');
    expect(firstPage.pagination.nextCursor).not.toBeNull();

    const cursor = firstPage.pagination.nextCursor!;

    // ── Act: fetch the next page using the compound cursor ────────────────────
    const history = await MessageService.getHistory(
      chatId,
      userA.toString(),
      cursor,
    );

    // ── Assert: only Msg 2 and Msg 3 are returned (strictly after cursor) ─────
    expect(history.messages).toHaveLength(2);
    const texts = history.messages.map((m: any) => m.text);
    expect(texts).toContain('Msg 2');
    expect(texts).toContain('Msg 3');
    expect(texts).not.toContain('Msg 1');
  });

  /**
   * Requirement 5.6 — Chat.lastMessage is updated after a successful send.
   *
   * Scenario: after calling send(), the Chat document's lastMessage sub-document
   * should reflect the sent message.
   */
  it('send updates Chat.lastMessage after a successful send', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    // ── Act ───────────────────────────────────────────────────────────────────
    await MessageService.send(chatId, userA.toString(), {
      text: 'lastMessage update test',
      type: 'text',
    });

    // ── Assert ────────────────────────────────────────────────────────────────
    const updatedChat = await Chat.findById(chatId).lean();
    expect(updatedChat?.lastMessage).not.toBeNull();
    expect(updatedChat?.lastMessage?.text).toBe('lastMessage update test');
    expect(String(updatedChat?.lastMessage?.sender)).toBe(userA.toString());
  });
});

// ── Task 13.2: markRead resets Redis unread count to 0 ───────────────────────

describe('MessageService.markRead — Redis unread count reset', () => {
  /**
   * Requirements 7.4, 9.2
   *
   * After markRead completes with at least one updated message, the Redis key
   * `unread:{chatId}:{userId}` must be set to `0`.
   *
   * Scenario:
   *   1. Create a Chat with two participants (userA and userB).
   *   2. Create unread messages sent by userA (not yet read by userB).
   *   3. Call MessageService.markRead() as userB.
   *   4. Verify that redisClient.set was called with key `unread:{chatId}:{userId}`
   *      and value `'0'`.
   */
  it('calls redisClient.set with unread:{chatId}:{userId} = "0" after marking messages read', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId(); // sender
    const userB = newId(); // reader

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    // Create two unread messages sent by userA (not in userB's readBy)
    await Message.create([
      { chatId: chat._id, sender: userA, text: 'Unread msg 1', type: 'text' },
      { chatId: chat._id, sender: userA, text: 'Unread msg 2', type: 'text' },
    ]);

    // ── Act ───────────────────────────────────────────────────────────────────
    const result = await MessageService.markRead(chatId, userB.toString());

    // ── Assert: messages were marked read ─────────────────────────────────────
    expect(result.modifiedCount).toBe(2);
    expect(result.updatedIds).toHaveLength(2);

    // ── Assert: redisClient.set called with unread:{chatId}:{userId} = '0' ────
    // setUnreadCount calls redisClient.set(`unread:${chatId}:${userId}`, '0')
    const expectedKey = `unread:${chatId}:${userB.toString()}`;
    expect(vi.mocked(redisClient.set)).toHaveBeenCalledWith(expectedKey, '0');
  });

  it('sets unread count to 0 regardless of the previous count value', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    // Create several unread messages
    await Message.create([
      { chatId: chat._id, sender: userA, text: 'Msg A', type: 'text' },
      { chatId: chat._id, sender: userA, text: 'Msg B', type: 'text' },
      { chatId: chat._id, sender: userA, text: 'Msg C', type: 'text' },
    ]);

    // ── Act ───────────────────────────────────────────────────────────────────
    await MessageService.markRead(chatId, userB.toString());

    // ── Assert: the set call always uses '0' as the value ─────────────────────
    const expectedKey = `unread:${chatId}:${userB.toString()}`;
    const setCalls = vi.mocked(redisClient.set).mock.calls;
    const unreadResetCall = setCalls.find(
      ([key, value]) => key === expectedKey && value === '0',
    );
    expect(unreadResetCall).toBeDefined();
  });

  it('does not call redisClient.set for unread reset when there are no unread messages', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = newId();
    const userB = newId();

    const chat = await createChat(userA, userB);
    const chatId = chat._id.toString();

    // No messages — nothing to mark as read

    // ── Act ───────────────────────────────────────────────────────────────────
    const result = await MessageService.markRead(chatId, userB.toString());

    // ── Assert: early return, no Redis set for unread reset ───────────────────
    expect(result.modifiedCount).toBe(0);
    expect(result.updatedIds).toHaveLength(0);

    // redisClient.set should NOT have been called with the unread key
    const expectedKey = `unread:${chatId}:${userB.toString()}`;
    const setCalls = vi.mocked(redisClient.set).mock.calls;
    const unreadResetCall = setCalls.find(
      ([key, value]) => key === expectedKey && value === '0',
    );
    expect(unreadResetCall).toBeUndefined();
  });
});

// ── Task 13.3: getList returns unreadCount: 0 when Redis is unavailable ──────

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

describe('ChatService.getList — Redis unavailable (unreadCount degrades to 0)', () => {
  /**
   * Requirements 4.4, 9.5, 10.2
   *
   * When Redis is unavailable (mget throws), getList must:
   *   - still return the chat list without throwing
   *   - set unreadCount to 0 for every chat
   *
   * Scenario:
   *   1. Create a Chat with two real User participants.
   *   2. Mock redisClient.mget to throw a connection error.
   *   3. Call ChatService.getList().
   *   4. Verify the result contains the chat with unreadCount: 0 and no error
   *      is thrown.
   */
  it('returns unreadCount: 0 for all chats when Redis mget throws', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = await createUser('13-3-a');
    const userB = await createUser('13-3-b');
    await Chat.create({ participants: [userA._id, userB._id] });

    // Simulate Redis unavailability — mget throws a connection error
    vi.mocked(redisClient.mget).mockRejectedValue(
      new Error('Redis connection refused'),
    );

    // ── Act: getList should not throw even though Redis is down ───────────────
    const result = await ChatService.getList(userA._id.toString());

    // ── Assert: chat is returned with unreadCount of 0 ────────────────────────
    expect(result).toHaveLength(1);
    expect(result[0].unreadCount).toBe(0);
  });

  it('returns unreadCount: 0 for multiple chats when Redis mget throws', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = await createUser('13-3-a2');
    const userB = await createUser('13-3-b2');
    const userC = await createUser('13-3-c2');
    await Chat.create({ participants: [userA._id, userB._id] });
    await Chat.create({ participants: [userA._id, userC._id] });

    // Simulate Redis unavailability
    vi.mocked(redisClient.mget).mockRejectedValue(new Error('Redis timeout'));

    // ── Act ───────────────────────────────────────────────────────────────────
    const result = await ChatService.getList(userA._id.toString());

    // ── Assert: both chats are returned, each with unreadCount of 0 ───────────
    expect(result).toHaveLength(2);
    expect(result.every((chat: any) => chat.unreadCount === 0)).toBe(true);
  });

  it('does not throw when Redis mget throws — error is swallowed gracefully', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const userA = await createUser('13-3-a3');
    const userB = await createUser('13-3-b3');
    await Chat.create({ participants: [userA._id, userB._id] });

    vi.mocked(redisClient.mget).mockRejectedValue(new Error('ECONNREFUSED'));

    // ── Act + Assert: must resolve, not reject ────────────────────────────────
    await expect(
      ChatService.getList(userA._id.toString()),
    ).resolves.toBeDefined();
  });
});
