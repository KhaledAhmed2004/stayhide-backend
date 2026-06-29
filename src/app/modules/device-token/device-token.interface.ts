import { Types } from 'mongoose';
import { IUser } from '../user/user.interface';

export type DevicePlatform = 'ios' | 'android' | 'web';

export type DeviceMetadata = {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
};

export interface IDeviceToken {
  user: Types.ObjectId | IUser;
  token?: string;
  tokenHash: string; // Made required based on our logic
  tokenPrefix?: string;
  platform?: DevicePlatform;
  appVersion?: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  lastSeenIpHash?: string;
  lastSeenCity?: string;
  userAgent?: string;
}
