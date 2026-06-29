import { Schema, model } from 'mongoose';
import { IDeviceToken } from './device-token.interface';

const DeviceTokenSchema = new Schema<IDeviceToken>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: { type: String, required: false },
  tokenHash: { type: String, required: true },
  tokenPrefix: { type: String, required: false },
  platform: { type: String, enum: ['ios', 'android', 'web'] },
  appVersion: { type: String },
  firstSeenAt: { type: Date, default: () => new Date() },
  lastSeenAt: { type: Date, default: () => new Date() },
  lastSeenIpHash: { type: String, required: false },
  lastSeenCity: { type: String, required: false },
  userAgent: { type: String, required: false },
}, {
  timestamps: true,
});

// Fast lookup for sending push notifications.
DeviceTokenSchema.index({ user: 1 });

// Guarantees a physical device token only belongs to one user at a time
DeviceTokenSchema.index({ tokenHash: 1 }, { unique: true });

export const DeviceToken = model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
