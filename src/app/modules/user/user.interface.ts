import { Model } from 'mongoose';
import {
  USER_ROLES,
  USER_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TIER,
} from '../../../enums/user';

export interface IUser {
  name: string;
  email: string;
  password?: string;
  role: USER_ROLES;

  dateOfBirth: Date;
  profileImage?: string;
  isVerified: boolean;
  googleId?: string;
  appleId?: string;
  subscriptionTier: SUBSCRIPTION_TIER;
  subscriptionStatus: SUBSCRIPTION_STATUS;
  subscriptionExpiryDate?: Date;
  appleOriginalTransactionId?: string;
  googlePurchaseToken?: string;
  authentication?: {
    isResetPassword: boolean;
    oneTimeCode: string;
    expireAt: Date;
  };
  passwordHistory?: Array<{
    hash: string;
    changedAt: Date;
  }>;
  emailChange?: {
    newEmail: string | null;
    otp: string | null;
    expireAt: Date | null;
  };

  tokenVersion: number;
  deletedAt?: Date;
  recoveryDeadline?: Date;
  isDailySymptomReminderEnabled?: boolean;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUserProjection = {
  _id: any;
  name: string;
  profileImage: string;
  role: USER_ROLES;
  isDeleted: boolean;
};

export type UserModal = {
  isExistUserById(id: string): any;
  isExistUserByEmail(email: string): any;
  isMatchPassword(password: string, hashPassword: string): boolean;
  isPasswordReused(
    plain: string,
    history: Array<{ hash: string }> | undefined,
  ): Promise<boolean>;

} & Model<IUser>;
