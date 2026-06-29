import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { model, Schema } from 'mongoose';
import config from '../../../config';
import {
  USER_ROLES,
  USER_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TIER,
} from '../../../enums/user';
import { IUser, UserModal } from './user.interface';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return !this.googleId && !this.appleId;
      },
      minlength: 8,
      select: false,
    },
    passwordHistory: {
      type: [
        {
          hash: { type: String, required: true },
          changedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
      select: false,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },
    profileImage: {
      type: String,
      required: true,
      // Self-hosted SVG — served by `app.use(express.static('public'))`
      // in src/app.ts. Relative path; clients resolve against {{baseUrl}}.
      // Replaces the previous external CDN dependency on i.ibb.co (SPOF).
      default: '/default-avatar.svg',
    },

    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    appleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    subscriptionTier: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TIER),
      default: SUBSCRIPTION_TIER.FREE,
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.NONE,
    },
    subscriptionExpiryDate: {
      type: Date,
    },
    appleOriginalTransactionId: {
      type: String,
      sparse: true,
      unique: true,
    },
    googlePurchaseToken: {
      type: String,
      sparse: true,
      unique: true,
    },
    authentication: {
      type: {
        isResetPassword: {
          type: Boolean,
          default: false,
        },
        oneTimeCode: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: false,
    },
    // Pending email-change request. Held server-side between
    // POST /users/me/email-change/request and /confirm. Cleared on commit
    // or expiry. Kept in a separate subdoc from `authentication` so the
    // password-reset OTP and email-change OTP can coexist for one user.
    emailChange: {
      type: {
        newEmail: {
          type: String,
          default: null,
          lowercase: true,
          trim: true,
        },
        otp: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: false,
    },

    deletedAt: {
      type: Date,
    },
    recoveryDeadline: {
      type: Date,
    },
    isDailySymptomReminderEnabled: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
    },
  },
  { timestamps: true },
);

// Cron purge query: find users whose recovery window has expired.
// Compound index speeds up `find({ status: DELETED, recoveryDeadline: { $lt: now } })`.
userSchema.index({ status: 1, recoveryDeadline: 1 });



userSchema.statics.isExistUserById = async (id: string) => {
  return await User.findById(id);
};

userSchema.statics.isExistUserByEmail = async (email: string) => {
  return await User.findOne({ email });
};

userSchema.statics.isMatchPassword = async (
  password: string,
  hashPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashPassword);
};

// Returns true if `plain` matches any hash in the history list. Used by
// change-password and reset-password to block reuse. O(n) bcrypt
// compares — n is capped at PASSWORD_HISTORY_DEPTH (5) so this stays
// fast even at scale.
userSchema.statics.isPasswordReused = async (
  plain: string,
  history: Array<{ hash: string }> | undefined,
): Promise<boolean> => {
  if (!history || history.length === 0) return false;
  for (const entry of history) {
    if (entry && entry.hash && (await bcrypt.compare(plain, entry.hash))) {
      return true;
    }
  }
  return false;
};

userSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    );
  }

  next();
});

export const User = model<IUser, UserModal>('User', userSchema);
