import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';
import QueryBuilder from '../../builder/QueryBuilder';
import { INotification } from './notification.interface';
import { Notification } from './notification.model';
import { SentNotification } from './sentNotification.model';
import { User } from '../user/user.model';
import { USER_ROLES } from '../../../enums/user';

// ── Notification formatter ────────────────────────────────────────────────────
//
// v1 typed notifications (schemaVersion === 1) store a rich payload in `metadata`
// at write time: { actor, subject, actions }. The formatter reads that directly —
// zero extra DB joins at read time.
//
// Legacy notifications (schemaVersion === 0 or missing) fall back to the old flat
// shape so existing records keep rendering correctly.
//
const formatNotification = (doc: any) => {
  const base = {
    id: doc._id,
    type: doc.type,
    isRead: doc.isRead,
    readAt: doc.readAt ?? null,
    createdAt: doc.createdAt,
    schemaVersion: doc.schemaVersion ?? 0,
  };

  if (doc.schemaVersion === 1 && doc.metadata?.actor) {
    // Typed notification — return structured actor/subject/actions
    return {
      ...base,
      actor: doc.metadata.actor,
      subject: doc.metadata.subject ?? null,
      actions: doc.metadata.actions ?? [],
    };
  }

  // Legacy flat notification — keep title/text/resource for backward compatibility
  return {
    ...base,
    title: doc.title,
    text: doc.text,
    subject: doc.resourceType
      ? { type: doc.resourceType, id: doc.resourceId }
      : null,
    actor: null,
    actions: [],
  };
};

// get notifications — cursor-based pagination
//
// Offset/page pagination is intentionally NOT used here. Notification feeds are
// high-frequency real-time streams: new items arrive between page loads, causing
// page drift (skipped or duplicated items) with skip/limit. Cursor pagination
// anchors each page to the last-seen document ID, making it drift-proof.
//
// Client usage:
//   First page : GET /api/v1/notifications/me
//   Next page  : GET /api/v1/notifications/me?nextCursor=<token>
//   No more    : meta.hasNext === false
const getNotificationFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>
) => {
  const notificationQuery = new QueryBuilder<INotification>(
    Notification.find({ receiver: user.id }),
    query
  )
    .search(['title', 'text'])
    .filter()
    .sort()
    .fields();

  // cursorPaginate executes the query internally and returns { data, meta }
  const { data, meta } = await notificationQuery.cursorPaginate('_id');

  const formattedData = data.map((item: any) => formatNotification(item.toObject()));

  const unreadCount = await Notification.countDocuments({
    receiver: user.id,
    isRead: false,
  });

  // Flatten cursor fields and unreadCount into a single meta object.
  // unreadCount is notification-domain data; limit/nextCursor/hasNext are
  // transport metadata. Both live at the same level — no nested `pagination`
  // wrapper — matching the Twitter v2 pattern: { meta: { result_count, next_token } }.
  return {
    data: formattedData,
    meta: {
      limit: meta.limit,
      nextCursor: meta.nextCursor,
      hasNext: meta.hasNext,
      unreadCount,
    },
  };
};

const markNotificationAsReadIntoDB = async (
  notificationId: string,
  userId: string
) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, receiver: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }

  return notification;
};

const markAllNotificationsAsRead = async (userId: string) => {
  const result = await Notification.updateMany(
    { receiver: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return {
    modifiedCount: result.modifiedCount,
    message: 'All notifications marked as read',
  };
};

// Send notification via NotificationBuilder + save sent record
const sendAdminNotification = async (
  title: string,
  text: string,
  audience: string,
) => {
  const builder = new NotificationBuilder()
    .setTitle(title)
    .setText(text)
    .setType('ADMIN')
    .viaDatabase()
    .viaSocket()
    .viaPush();

  if (audience === 'ALL') {
    // Target all common user roles
    const users = await User.find({
      role: { $in: [USER_ROLES.USER] },
    }).select('_id');
    builder.toMany(users.map(u => u._id));
  } else if ([USER_ROLES.USER].includes(audience as USER_ROLES)) {
    // Dynamic role targeting (restricted to BROTHER and SISTER)
    builder.toRole(audience);
  } else {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid audience type');
  }

  const result = await builder.sendNow();
  const recipientCount = result.sent.database || result.sent.socket || 0;

  // Save sent record for history
  await SentNotification.create({
    title,
    text,
    audience,
    recipientCount,
  });

  return { recipientCount };
};

// Get sent notification history
const getSentHistory = async (query: Record<string, unknown>) => {
  const sentQuery = new QueryBuilder(
    SentNotification.find(),
    query,
  )
    .search(['title', 'text'])
    .filter()
    .sort()
    .paginate();

  const data = await sentQuery.modelQuery;
  const pagination = await sentQuery.getPaginationInfo();
  return { pagination, data };
};

export const NotificationService = {
  getNotificationFromDB,
  markNotificationAsReadIntoDB,
  markAllNotificationsAsRead,
  sendAdminNotification,
  getSentHistory,
};
