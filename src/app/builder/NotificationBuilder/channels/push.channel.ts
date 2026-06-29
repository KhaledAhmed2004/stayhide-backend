/**
 * Push Channel - Firebase Cloud Messaging
 *
 * Sends push notifications via Firebase FCM to user devices.
 * Uses the existing pushNotificationHelper internally.
 */

import { pushNotificationHelper } from '../../../modules/notification/pushNotificationHelper';
import { DeviceToken } from '../../../modules/device-token/device-token.model';

interface IUser {
  _id: any;
}

interface PushContent {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  data?: Record<string, string>;
}

interface PushResult {
  sent: number;
  failed: string[];
}

/**
 * Send push notifications to users via Firebase FCM
 */
export const sendPush = async (
  users: IUser[],
  content: PushContent
): Promise<PushResult> => {
  const result: PushResult = { sent: 0, failed: [] };
  if (!users.length) return result;

  const userIds = users.map(u => u._id.toString());
  
  // TTL check: skip sending to tokens where lastSeenAt is older than 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const activeDeviceTokens = await DeviceToken.find({
    user: { $in: userIds },
    lastSeenAt: { $gte: sixMonthsAgo }
  }).select('token user').lean();

  const validTokens: string[] = [];
  const usersWithTokens = new Set<string>();

  for (const dt of activeDeviceTokens) {
    if (dt.token) {
      validTokens.push(dt.token);
      usersWithTokens.add(dt.user.toString());
    }
  }

  // Gracefully skip if no tokens are found (e.g., users exist but are logged out / no devices)
  if (validTokens.length === 0) {
    return { sent: users.length, failed: [] };
  }

  const message: any = {
    notification: {
      title: content.title,
      body: content.body,
    },
    tokens: validTokens, // FCM supports up to 500 tokens per batch via sendEachForMulticast
  };

  if (content.icon) message.notification.icon = content.icon;
  if (content.image) message.notification.image = content.image;
  if (content.data) message.data = content.data;

  try {
    // sendEachForMulticast internally handles batching and partial failures cleanly
    await pushNotificationHelper.sendPushNotifications(message);

    result.sent = usersWithTokens.size;
    const usersWithoutTokens = users.filter(u => !usersWithTokens.has(u._id.toString()));
    result.sent += usersWithoutTokens.length;
  } catch (error) {
    console.error('Push notification error:', error);
    result.failed = Array.from(usersWithTokens);
    const usersWithoutTokens = users.filter(u => !usersWithTokens.has(u._id.toString()));
    result.sent = usersWithoutTokens.length;
  }

  return result;
};

export default sendPush;
