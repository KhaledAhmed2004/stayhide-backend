import { JwtPayload } from 'jsonwebtoken';
import { IMessage, IMessageAttachment } from './message.interface';
import { Message } from './message.model';
import { Chat } from '../chat/chat.model';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../builder/QueryBuilder';
import { isOnline } from '../../helpers/presenceHelper';
import { incrementUnreadCount, setUnreadCount } from '../../helpers/unreadHelper';
import { sendNotifications } from '../notification/notificationsHelper';
import { SocketManager } from '../../../helpers/socketManager';
import { redisClient } from '../../../shared/redisClient';
import { errorLogger } from '../../../shared/logger';

const getUnreadCount = async (chatId: string, userId: string) => {
  const count = await Message.countDocuments({
    chatId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });
  return count;
};

// ─── send ─────────────────────────────────────────────────────────────────────
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.11, 10.3, 10.4, 11.2

export interface ISendPayload {
  text?: string;
  type: 'text' | 'image' | 'media' | 'doc' | 'mixed';
  attachments?: IMessageAttachment[];
}

const send = async (
  chatId: string,
  senderId: string,
  payload: ISendPayload,
): Promise<IMessage> => {
  // Req 10.4 — validate chatId as ObjectId before any DB query
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid chatId');
  }

  // Validate senderId as ObjectId before any DB query
  if (!mongoose.Types.ObjectId.isValid(senderId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid senderId');
  }

  // Req 5.1 — fetch Chat; throw 404 if not found (critical — re-throw on failure per 10.3)
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  // Req 5.2 — throw 403 if senderId not in participants
  const participantIds = chat.participants.map(p => String(p));
  if (!participantIds.includes(String(senderId))) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
  }

  // Req 5.3 — validate payload: must have non-empty text or at least one attachment
  const hasText = typeof payload.text === 'string' && payload.text.trim().length > 0;
  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;
  if (!hasText && !hasAttachments) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Message must contain text or at least one attachment');
  }

  // Req 5.4 — text must not exceed 10,000 characters
  if (typeof payload.text === 'string' && payload.text.length > 10000) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Message text exceeds maximum length');
  }

  // Req 5.5 — attachments must not exceed 10 items
  if (Array.isArray(payload.attachments) && payload.attachments.length > 10) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Attachments cannot exceed 10 items');
  }

  // Req 11.2 — save Message; critical path — re-throw on failure per 10.3
  const created = await Message.create({
    chatId,
    sender: senderId,
    text: payload.text,
    type: payload.type,
    attachments: payload.attachments ?? [],
  });

  // Req 11.2 — explicitly populate sender at the call site
  const populatedMessage = await created.populate('sender', '_id name profilePicture');

  // Req 5.11 / 1.3 — atomically update Chat.lastMessage; critical — re-throw on failure per 10.3
  const lastMessage = {
    text: payload.text ?? '',
    sender: senderId,
    createdAt: created.createdAt,
  };
  await Chat.findByIdAndUpdate(chatId, {
    $set: { lastMessage },
  });

  // ── Side-effects (Req 5.6–5.12, 9.1, 10.1) ──────────────────────────────
  // Each step is wrapped in its own try/catch. Failures are logged but never
  // propagated — the saved message is always returned regardless.

  // Determine the receiver: the participant whose ID is NOT senderId (Req 5.7)
  const receiverId = participantIds.find(id => id !== String(senderId)) ?? null;

  // Side-effect 1: Emit MESSAGE_SENT to the chat room only (Req 4).
  // Clients not yet in the chat room are notified via CHAT_UPDATED (user room).
  try {
    const io = SocketManager.getIO();
    io.to(`chat::${chatId}`).emit('MESSAGE_SENT', { message: populatedMessage });
  } catch (err) {
    errorLogger.error(`[send] Failed to emit MESSAGE_SENT for chat ${chatId}: ${err}`);
  }

  // Side-effect 2: Increment receiver's unread count in Redis (Req 5.11, 9.1)
  // Done before routing so CHAT_UPDATED carries the up-to-date count.
  let newUnreadCount = 0;
  if (receiverId) {
    try {
      newUnreadCount = await incrementUnreadCount(chatId, receiverId, 1);
    } catch (err) {
      errorLogger.error(`[send] Failed to increment unread count for user ${receiverId} in chat ${chatId}: ${err}`);
    }
  }

  // Side-effect 3 & 4: Read receiver's active chat from Redis and route accordingly
  // (Req 5.8, 5.9, 5.10)
  if (receiverId) {
    try {
      const activeChat = await redisClient.get(`active:${receiverId}:chat`);

      if (activeChat === chatId) {
        // Req 5.8 — receiver has this chat open: no push, no CHAT_UPDATED
      } else if (activeChat !== null) {
        // Req 5.9 — receiver is online but in a different chat: emit CHAT_UPDATED
        try {
          SocketManager.getIO()
            .to(`user::${receiverId}`)
            .emit('CHAT_UPDATED', { lastMessage, unreadCount: newUnreadCount });
        } catch (err) {
          errorLogger.error(`[send] Failed to emit CHAT_UPDATED to user ${receiverId}: ${err}`);
        }
      } else {
        // Req 5.10 — receiver is offline: send push notification with 60-second dedup
        try {
          const dedupKey = `notif:dedup:${chatId}:${receiverId}`;
          // SET NX EX 60 — only set if key doesn't exist; returns "OK" or null
          const acquired = await redisClient.set(dedupKey, '1', 'EX', 60, 'NX');
          if (acquired === 'OK') {
            await sendNotifications({
              title: 'New Message',
              text: payload.text || 'New message',
              receiver: new mongoose.Types.ObjectId(receiverId),
              isRead: false,
              type: 'SYSTEM',
            });
          }
        } catch (err) {
          errorLogger.error(`[send] Failed to send push notification to user ${receiverId}: ${err}`);
        }
      }
    } catch (err) {
      errorLogger.error(`[send] Failed to read active chat for user ${receiverId}: ${err}`);
    }
  }

  return populatedMessage as unknown as IMessage;
};

// ─── getHistory ──────────────────────────────────────────────────────────────
// Requirements: 6.1–6.7, 11.3, 13.1–13.4, 19.1–19.2

interface IHistoryPagination {
  total: number;
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

interface IHistoryResult {
  messages: IMessage[];
  pagination: IHistoryPagination;
}

// Req 13.1 — encode compound cursor as base64("{ts}_{id}")
const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(`${createdAt.toISOString()}_${id}`).toString('base64');

// Req 13.4 — decode compound cursor; throw ApiError 400 on any parse failure
const decodeCursor = (cursor: string): { ts: Date; id: string } => {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  const underscoreIdx = decoded.indexOf('_');
  if (underscoreIdx === -1) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  const tsStr = decoded.slice(0, underscoreIdx);
  const id = decoded.slice(underscoreIdx + 1);
  const ts = new Date(tsStr);
  if (isNaN(ts.getTime()) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  return { ts, id };
};

const getHistory = async (
  chatId: string,
  userId: string,
  cursor?: string,
  limit?: number,
): Promise<IHistoryResult> => {
  // Req 6.6 — validate chatId
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid chatId');
  }

  // Req 6.7 / 19.2 — validate userId (used in participant check below, not discarded)
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }

  // Req 6.1 / 19.1 — participant authorization check
  const isParticipant = await Chat.exists({ _id: chatId, participants: userId });
  if (!isParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
  }

  // Req 6.2 — clamp limit to 1–100, default 20
  const clampedLimit = Math.min(100, Math.max(1, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 20));

  // Req 13.2 — build base query; add compound cursor filter when provided
  const query: Record<string, unknown> = { chatId };
  if (cursor) {
    const { ts, id } = decodeCursor(cursor);
    query.$or = [
      { createdAt: { $gt: ts } },
      { createdAt: ts, _id: { $gt: new mongoose.Types.ObjectId(id) } },
    ];
  }

  // Req 6.5 — total matching messages (with cursor filter applied)
  const total = await Message.countDocuments(query);

  // Req 6.1, 6.4 — fetch page, sort ascending by (createdAt, _id), populate sender explicitly
  const messages = await Message.find(query)
    .sort({ createdAt: 1, _id: 1 })
    .limit(clampedLimit)
    .populate('sender', '_id name profilePicture')
    .lean();

  // Req 6.5 — hasNextPage: true if more messages exist after this page
  const hasNextPage = messages.length === clampedLimit && messages.length < total;

  // Req 13.3 — nextCursor: compound cursor from last message, or null
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const nextCursor =
    hasNextPage && lastMsg
      ? encodeCursor(
          new Date((lastMsg as any).createdAt),
          String((lastMsg as any)._id),
        )
      : null;

  return {
    messages: messages as unknown as IMessage[],
    pagination: {
      total,
      limit: clampedLimit,
      hasNextPage,
      nextCursor,
    },
  };
};

// ─── markRead ────────────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 9.2, 10.5

interface IMarkReadResult {
  modifiedCount: number;
  updatedIds: string[];
}

const markRead = async (
  chatId: string,
  userId: string,
): Promise<IMarkReadResult> => {
  // Req 7.6 / 10.5 — validate chatId as ObjectId before any DB query
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid chatId');
  }

  // Req 7.7 / 10.5 — validate userId as ObjectId before any DB query
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }

  // Req 7.2 — verify userId is a participant of the chat; throw 403 if not
  const isParticipant = await Chat.exists({
    _id: chatId,
    participants: userId,
  });
  if (!isParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
  }

  // Req 7.1 — query for Message IDs where sender !== userId AND readBy does not contain userId
  const unreadMessages = await Message.find({
    chatId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  }).select('_id');

  // Req 7.5 — if no unread messages, return early without emitting socket event
  if (unreadMessages.length === 0) {
    return { modifiedCount: 0, updatedIds: [] };
  }

  const messageIds = unreadMessages.map(m => m._id);

  // Req 7.1 — perform single updateMany using those IDs to $addToSet: { readBy: userId }
  const result = await Message.updateMany(
    { _id: { $in: messageIds } },
    { $addToSet: { readBy: userId } },
  );

  const modifiedCount = result.modifiedCount;
  const updatedIds = messageIds.map(id => String(id));

  // Req 7.5 — if modifiedCount === 0, return without emitting socket event
  if (modifiedCount === 0) {
    return { modifiedCount: 0, updatedIds: [] };
  }

  // Req 7.4 / 9.2 — set unread count to 0 in Redis; log error if Redis fails (no empty catch)
  try {
    await setUnreadCount(chatId, userId, 0);
  } catch (err) {
    errorLogger.error(`markRead: failed to reset unread count for chat=${chatId} user=${userId}`, err);
  }

  // Req 7.3 — emit MESSAGES_READ to chat::{chatId} room with { chatId, userId, updatedIds }
  try {
    SocketManager.getIO()
      .to(`chat::${chatId}`)
      .emit('MESSAGES_READ', { chatId, userId, updatedIds });
  } catch (err) {
    errorLogger.error(`markRead: failed to emit MESSAGES_READ for chat=${chatId}`, err);
  }

  // Req 7.8 — return { modifiedCount, updatedIds }
  return { modifiedCount, updatedIds };
};

export const MessageService = {
  send,
  getHistory,
  markRead,
  getUnreadCount,
};
