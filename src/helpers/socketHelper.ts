import colors from 'colors';
import { Server } from 'socket.io';
import { errorLogger, logger } from '../shared/logger';
import { jwtHelper } from './jwtHelper';
import config from '../config';
import { redisClient } from '../shared/redisClient';
import { Message } from '../app/modules/message/message.model';
import { Chat } from '../app/modules/chat/chat.model';
import { SupportTicket } from '../app/modules/support-ticket/support-ticket.model';
import {
  setOnline,
  setOffline,
  addUserRoom,
  removeUserRoom,
  updateLastActive,
  getUserRooms,
  getLastActive,
  incrConnCount,
  decrConnCount,
  clearUserRooms,
} from '../app/helpers/presenceHelper';

// -------------------------
// 🔹 Room Name Generators
// -------------------------
// USER_ROOM: unique private room for each user (for personal notifications)
// CHAT_ROOM: group room for each chat conversation
const USER_ROOM = (userId: string) => `user::${userId}`;
const CHAT_ROOM = (chatId: string) => `chat::${chatId}`;
const TICKET_ROOM = (ticketId: string) => `ticket::${ticketId}`;
const ADMIN_TICKETS_ROOM = 'admin-tickets';
const TYPING_KEY = (chatId: string, userId: string) => `typing:${chatId}:${userId}`;
const TYPING_TTL_SECONDS = 5; // throttle window

// -------------------------
// 🔹 Rate Limiting Helper (Req 12)
// -------------------------
/**
 * Increments the rate-limit counter for an event+user pair.
 * Returns true if the limit has been exceeded (caller should reject).
 * Fails open on Redis errors — logs the error and allows the request through.
 */
const isRateLimited = async (
  event: string,
  userId: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> => {
  try {
    const key = `ratelimit:${event}:${userId}`;
    const count = await redisClient.incr(key);
    if (count === 1) {
      // First increment — set TTL for the window
      await redisClient.expire(key, windowSeconds);
    }
    return count > limit;
  } catch (err) {
    errorLogger.error(`isRateLimited: Redis error for event=${event} user=${userId}: ${String(err)}`);
    return false; // fail open
  }
};

// -------------------------
// 🔹 Main Socket Handler
// -------------------------
const socket = (io: Server) => {
  io.on('connection', async socket => {
    try {
      // -----------------------------
      // 🧩 STEP 1 — Authenticate Socket
      // -----------------------------
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;

      if (!token || typeof token !== 'string') {
        logger.warn(
          colors.yellow('Socket connection without token. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      let payload: any;
      try {
        payload = jwtHelper.verifyToken(token, config.jwt.jwt_secret as any);
      } catch (err) {
        logger.warn(
          colors.red('Invalid JWT on socket connection. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      const userId = payload?.id as string;
      if (!userId) {
        logger.warn(colors.red('JWT payload missing id. Disconnecting.'));
        return socket.disconnect(true);
      }

      // -----------------------------
      // 🧩 STEP 2 — Mark Online & Join Personal Room
      // -----------------------------
      await setOnline(userId);
      await incrConnCount(userId);
      await updateLastActive(userId);
      socket.join(USER_ROOM(userId)); // join user's personal private room
      logger.info(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`);
      logger.info(`🔔 Event processed: socket_connected for user_id: ${userId}`);

      // Admins auto-join the global support-ticket broadcast room so they
      // receive TICKET_CREATED/TICKET_REPLY events without needing to
      // subscribe per-ticket. Per-ticket rooms (ticket::{id}) are still
      // joined on demand via JOIN_TICKET for the detail view.
      const role = (payload as any)?.role as string | undefined;
      if (role === 'SUPER_ADMIN') {
        socket.join(ADMIN_TICKETS_ROOM);
      }

      // ---------------------------------------------
      // 🔹 Chat Room Join / Leave Events
      // ---------------------------------------------
      socket.on('JOIN_CHAT', async ({ chatId }: { chatId: string }) => {
        // Requirement 8.2: ignore event if chatId is absent or empty string
        if (!chatId) return;

        // Req 7: participant authorization
        const isParticipant = await Chat.exists({ _id: chatId, participants: userId });
        if (!isParticipant) {
          socket.emit('ACK_ERROR', {
            message: 'You are not a participant of this chat',
            chatId,
          });
          return;
        }

        // Write active:{userId}:chat = chatId with 3600-second TTL (Requirement 8.1)
        try {
          await redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
        } catch (err) {
          errorLogger.error(
            colors.red(`JOIN_CHAT: failed to write active-chat key for user ${userId}: ${String(err)}`)
          );
        }

        // Join the socket room for this chat
        socket.join(CHAT_ROOM(chatId));
        await addUserRoom(userId, chatId);
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: JOIN_CHAT for chat_id: ${chatId}`);

        // Broadcast to others in the chat that this user is now online
        const lastActive = await getLastActive(userId);
        io.to(CHAT_ROOM(chatId)).emit('USER_ONLINE', {
          userId,
          chatId,
          lastActive,
        });
        logger.info(`User ${userId} joined chat room ${CHAT_ROOM(chatId)}`);
      });

      socket.on('LEAVE_CHAT', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;

        // Delete active:{userId}:chat from Redis (Requirement 8.3)
        try {
          await redisClient.del(`active:${userId}:chat`);
        } catch (err) {
          errorLogger.error(
            colors.red(`LEAVE_CHAT: failed to delete active-chat key for user ${userId}: ${String(err)}`)
          );
        }

        socket.leave(CHAT_ROOM(chatId));
        await removeUserRoom(userId, chatId);
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: LEAVE_CHAT for chat_id: ${chatId}`);

        // Notify others that user went offline in this chat
        const lastActive = await getLastActive(userId);
        io.to(CHAT_ROOM(chatId)).emit('USER_OFFLINE', {
          userId,
          chatId,
          lastActive,
        });
        logger.info(
          colors.yellow(`User ${userId} left chat room ${CHAT_ROOM(chatId)}`)
        );
      });

      // ---------------------------------------------
      // 🔹 Support Ticket Room Join / Leave Events
      // ---------------------------------------------
      socket.on('JOIN_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        try {
          const ticket = await SupportTicket.findById(ticketId).select(
            '_id userId'
          );
          if (!ticket) {
            socket.emit('ACK_ERROR', {
              message: 'Ticket not found',
              ticketId: String(ticketId),
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: JOIN_TICKET_DENIED not_found ticket_id: ${ticketId}`);
            return;
          }
          const isAdmin = role === 'SUPER_ADMIN';
          const isOwner = String(ticket.userId) === String(userId);
          if (!isAdmin && !isOwner) {
            socket.emit('ACK_ERROR', {
              message: 'You do not have access to this ticket',
              ticketId: String(ticketId),
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: JOIN_TICKET_DENIED forbidden ticket_id: ${ticketId}`);
            return;
          }
          socket.join(TICKET_ROOM(String(ticketId)));
          updateLastActive(userId).catch(() => {});
          logger.info(`🔔 Event processed: JOIN_TICKET for ticket_id: ${ticketId}`);
        } catch (err) {
          logger.error(colors.red(`JOIN_TICKET error: ${String(err)}`));
        }
      });

      socket.on('LEAVE_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        socket.leave(TICKET_ROOM(String(ticketId)));
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: LEAVE_TICKET for ticket_id: ${ticketId}`);
      });

      // ---------------------------------------------
      // 🔹 Typing Indicators
      // ---------------------------------------------
      socket.on('TYPING_START', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;

        // Req 12: rate limit TYPING_START (60 per 60s)
        if (await isRateLimited('TYPING_START', userId, 60, 60)) {
          socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: 'TYPING_START' });
          return;
        }

        // Guard: Only participants can emit typing events for a chat
        const allowed = await Chat.exists({ _id: chatId, participants: userId });
        if (!allowed) {
          updateLastActive(userId).catch(() => {});
          logger.info(`🔔 Event processed: TYPING_START_DENIED for chat_id: ${chatId}`);
          return;
        }

        // Req 2: Throttle typing events per user per chat using Redis SET NX
        const key = TYPING_KEY(chatId, userId);
        const acquired = await redisClient.set(key, '1', 'EX', TYPING_TTL_SECONDS, 'NX');
        if (acquired === null) {
          // Already throttled — suppress broadcast
          updateLastActive(userId).catch(() => {});
          logger.info(`🔔 Event processed: TYPING_START_THROTTLED_SKIP for chat_id: ${chatId}`);
          return;
        }

        io.to(CHAT_ROOM(chatId)).emit('TYPING_START', { userId, chatId });
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: TYPING_START for chat_id: ${chatId}`);
      });

      socket.on('TYPING_STOP', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;
        // Guard: Only participants can emit typing stop events
        const allowed = await Chat.exists({ _id: chatId, participants: userId });
        if (!allowed) {
          updateLastActive(userId).catch(() => {});
          logger.info(`🔔 Event processed: TYPING_STOP_DENIED for chat_id: ${chatId}`);
          return;
        }
        // Req 2.5: Clear throttle key so next start can emit immediately
        await redisClient.del(TYPING_KEY(chatId, userId));

        io.to(CHAT_ROOM(chatId)).emit('TYPING_STOP', { userId, chatId });
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: TYPING_STOP for chat_id: ${chatId}`);
      });

      // ---------------------------------------------
      // 🔹 Message Delivery & Read Acknowledgements
      // ---------------------------------------------
      socket.on(
        'DELIVERED_ACK',
        async ({ messageId }: { messageId: string }) => {
          try {
            const found = await Message.findById(messageId).select('_id chatId');
            if (!found) {
              socket.emit('ACK_ERROR', {
                message: 'Message not found',
                messageId,
              });
              return;
            }

            const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
            if (!allowed) {
              socket.emit('ACK_ERROR', {
                message: 'You are not a participant of this chat',
                chatId: String(found.chatId),
                messageId: String(found._id),
              });
              updateLastActive(userId).catch(() => {});
              logger.info(`🔔 Event processed: DELIVERED_ACK_DENIED chat_id: ${String(found.chatId)}`);
              return;
            }

            // Req 5: emit MESSAGE_DELIVERED without any DB write
            io.to(CHAT_ROOM(String(found.chatId))).emit('MESSAGE_DELIVERED', {
              messageId: String(found._id),
              chatId: String(found.chatId),
              userId,
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: DELIVERED_ACK for message_id: ${String(found._id)}`);
          } catch (err) {
            logger.error(colors.red(`❌ DELIVERED_ACK error: ${String(err)}`));
          }
        }
      );

      socket.on('READ_ACK', async ({ messageId }: { messageId: string }) => {
        try {
          // Req 12: rate limit READ_ACK (60 per 60s)
          if (await isRateLimited('READ_ACK', userId, 60, 60)) {
            socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: 'READ_ACK' });
            return;
          }

          const found = await Message.findById(messageId).select('_id chatId');
          if (!found) {
            socket.emit('ACK_ERROR', {
              message: 'Message not found',
              messageId,
            });
            return;
          }

          const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
          if (!allowed) {
            socket.emit('ACK_ERROR', {
              message: 'You are not a participant of this chat',
              chatId: String(found.chatId),
              messageId: String(found._id),
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: READ_ACK_DENIED chat_id: ${String(found.chatId)}`);
            return;
          }

          const msg = await Message.findByIdAndUpdate(
            messageId,
            { $addToSet: { readBy: userId } },
            { new: true }
          );
          if (msg) {
            // Req 8: emit MESSAGES_READ (plural) with correct payload shape
            io.to(CHAT_ROOM(String(msg.chatId))).emit('MESSAGES_READ', {
              chatId: String(msg.chatId),
              userId,
              updatedIds: [String(msg._id)],
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: READ_ACK for message_id: ${String(msg._id)}`);
          }
        } catch (err) {
          logger.error(colors.red(`❌ READ_ACK error: ${String(err)}`));
        }
      });

      // ---------------------------------------------
      // 🔹 Handle Disconnect Event
      // ---------------------------------------------
      socket.on('disconnect', async () => {
        try {
          await updateLastActive(userId);
          const remaining = await decrConnCount(userId);
          const lastActive = await getLastActive(userId);

          // Delete active:{userId}:chat from Redis on disconnect (Requirement 8.4)
          try {
            await redisClient.del(`active:${userId}:chat`);
          } catch (err) {
            errorLogger.error(
              colors.red(`disconnect: failed to delete active-chat key for user ${userId}: ${String(err)}`)
            );
          }

          // Only mark offline and broadcast if no other sessions remain
          if (!remaining || remaining <= 0) {
            await setOffline(userId);

            // Notify all chat rooms this user participated in
            try {
              const rooms = await getUserRooms(userId);
              for (const chatId of rooms || []) {
                io.to(CHAT_ROOM(String(chatId))).emit('USER_OFFLINE', {
                  userId,
                  chatId: String(chatId),
                  lastActive,
                });
              }
              await clearUserRooms(userId);
            } catch {}
          } else {
            logger.info(colors.yellow(`User ${userId} disconnected one session; ${remaining} session(s) remain.`));
          }

          logger.info(colors.red(`User ${userId} disconnected`));
          logger.info(`🔔 Event processed: socket_disconnected for user_id: ${userId}`);
        } catch (err) {
          logger.error(
            colors.red(`❌ Disconnect handling error: ${String(err)}`)
          );
        }
      });
    } catch (err) {
      logger.error(colors.red(`Socket connection error: ${String(err)}`));
      try {
        socket.disconnect(true);
      } catch {}
    }
  });
};

export const socketHelper = { socket };
