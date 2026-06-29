import { Model, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'ADMIN',
  'SYSTEM',
  // ── Connection events ──────────────────────────────────────────────────────
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  // ── Messaging events ───────────────────────────────────────────────────────
  'NEW_MESSAGE',
  // ── Community events ───────────────────────────────────────────────────────
  'QUESTION_ANSWERED',
  'NEW_QUESTION',
  'POST_LIKED',
  'POST_COMMENTED',
  'COMMENT_REPLIED',
  'CONTENT_LIKED',
  'CONTENT_COMMENTED',
  'NEW_CONTENT',
  'NEW_KHUTBAH',
  'MOSQUE_UPDATE',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationResourceType =
  | 'AskQuestion'
  | 'GroupPost'
  | 'LearningContent'
  | 'Khutbah'
  | 'Mosque'
  | 'User'
  | string;

export type NotificationLink = {
  label: string;
  url: string;
};

export type INotification = {
  _id?: Types.ObjectId;
  receiver: Types.ObjectId;
  type: NotificationType;
  title: string;
  text: string;
  isRead: boolean;
  readAt?: Date | null;

  // Schema version — used to distinguish typed v1 notifications (with actor/subject/actions
  // stored in metadata) from legacy flat notifications. Defaults to 0 for old records.
  schemaVersion?: number;

  // Polymorphic reference (legacy + used as fallback for old records)
  resourceType?: NotificationResourceType;
  resourceId?: string;

  link?: NotificationLink;

  // v1 typed payload — stored here at write time so reads are zero-join.
  // Shape for CONNECTION_REQUEST / CONNECTION_ACCEPTED:
  //   { actor: { id, name, profileImage }, subject: { type, id, chatId? }, actions: { type }[] }
  metadata?: Record<string, unknown>;

  icon?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Notification = INotification;
export type NotificationModel = Model<INotification, Record<string, unknown>>;
