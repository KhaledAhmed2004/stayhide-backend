/**
 * Socket Channel - Socket.IO Real-time Notifications
 *
 * Emits real-time events to connected users via Socket.IO.
 * Uses the global io instance from socketHelper.
 */

interface IUser {
  _id: any;
}

interface SocketContent {
  event: string;
  data: Record<string, any>;
}

interface SocketResult {
  sent: number;
  failed: string[];
}

/**
 * Send real-time notifications via Socket.IO
 */
export const sendSocket = async (
  users: IUser[],
  content: SocketContent
): Promise<SocketResult> => {
  const result: SocketResult = { sent: 0, failed: [] };

  // Get global Socket.IO instance
  // @ts-ignore - global.io is set in socketHelper.ts
  const io = global.io;

  if (!io) {
    console.warn('Socket.IO not initialized, skipping socket notifications');
    return { sent: 0, failed: users.map(u => u._id.toString()) };
  }

  const timestamp = new Date().toISOString();

  for (const user of users) {
    try {
      const userId = user._id.toString();

      // Emit to user's private room (user::{userId})
      io.to(`user::${userId}`).emit(content.event, {
        ...content.data,
        timestamp,
      });

      // Also emit using legacy format for backward compatibility
      // This matches the existing pattern: get-notification::{userId}
      io.emit(`get-notification::${userId}`, {
        ...content.data,
        timestamp,
      });

      result.sent++;
    } catch (error) {
      console.error(`Socket emit error for user ${user._id}:`, error);
      result.failed.push(user._id.toString());
    }
  }

  return result;
};

export default sendSocket;
