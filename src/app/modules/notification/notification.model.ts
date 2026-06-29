import { Schema, model } from 'mongoose';
import { INotification, NOTIFICATION_TYPES } from './notification.interface';

const NotificationSchema = new Schema<INotification>(
  {
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true },
    text: { type: String, required: true },

    // 0 = legacy flat notification, 1 = typed notification with actor/subject/actions in metadata
    schemaVersion: { type: Number, default: 0 },

    resourceType: { type: String },
    resourceId: { type: String },

    link: {
      label: { type: String },
      url: { type: String },
    },
    metadata: { type: Schema.Types.Mixed },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },

    icon: { type: String },
  },
  { timestamps: true },
);

// Indexes for performance
NotificationSchema.index({ receiver: 1, createdAt: -1 });
NotificationSchema.index({ receiver: 1, isRead: 1 });
NotificationSchema.index({ resourceType: 1, resourceId: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
export const NotificationModel = Notification;
