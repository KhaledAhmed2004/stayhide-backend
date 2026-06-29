import { Model } from 'mongoose';

export type ISentNotification = {
  title: string;
  text: string;
  audience: string;
  recipientCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SentNotificationModel = Model<ISentNotification>;
