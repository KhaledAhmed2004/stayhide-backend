import { model, Schema } from 'mongoose';
import { IResetToken, ResetTokenModel } from './resetToken.interface';

const resetTokenSchema = new Schema<IResetToken, ResetTokenModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true, // implicit index
    },
    // TTL index — MongoDB auto-deletes the document at `expireAt`.
    // Zero-ops cleanup of stale reset tokens.
    expireAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

// token check
resetTokenSchema.statics.isExistToken = async function (
  this: ResetTokenModel,
  token: string,
): Promise<IResetToken | null> {
  return await this.findOne({ token });
};

// token validity check
resetTokenSchema.statics.isExpireToken = async function (
  this: ResetTokenModel,
  token: string,
): Promise<boolean> {
  const currentDate = new Date();
  const resetToken = await this.findOne({
    token,
    expireAt: { $gt: currentDate },
  });
  return !!resetToken;
};

export const ResetToken = model<IResetToken, ResetTokenModel>(
  'ResetToken',
  resetTokenSchema,
);
