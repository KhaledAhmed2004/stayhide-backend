import { model, Schema } from 'mongoose';
import {
  ISentNotification,
  SentNotificationModel,
} from './sentNotification.interface';

const sentNotificationSchema = new Schema<
  ISentNotification,
  SentNotificationModel
>(
  {
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true },
    audience: {
      type: String,
      required: true,
    },
    recipientCount: { type: Number, required: true },
  },
  { timestamps: true },
);

sentNotificationSchema.index({ createdAt: -1 });

export const SentNotification = model<
  ISentNotification,
  SentNotificationModel
>('SentNotification', sentNotificationSchema);
