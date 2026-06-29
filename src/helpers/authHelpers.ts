import { StatusCodes } from 'http-status-codes';
import { User } from '../app/modules/user/user.model';
import ApiError from '../errors/ApiError';
import generateOTP from '../util/generateOTP';
import { emailHelper } from './emailHelper';
import { emailTemplate } from '../shared/emailTemplate';

import { ClientSession } from 'mongoose';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000; // 60 seconds

/**
 * Generates OTP, saves to user record, and sends verification email
 * @param email - User's email address
 * @param session - Optional Mongoose session for atomicity
 */
export const sendVerificationOTP = async (email: string, session?: ClientSession) => {
  const user = await User.findOne({ email }).session(session || null);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (user.isVerified) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User is already verified!');
  }

  // Check for resend cooldown
  const lastSent = user.authentication?.expireAt 
    ? new Date(user.authentication.expireAt.getTime() - OTP_EXPIRY_MINUTES * 60000)
    : null;
    
  if (lastSent && Date.now() - lastSent.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Please wait 60 seconds before requesting another OTP');
  }

  const otp = generateOTP();
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000),
  };

  await User.findOneAndUpdate(
    { email }, 
    { $set: { authentication } },
    { session }
  );

  const emailData = emailTemplate.createAccount({
    name: user.name,
    email: user.email,
    otp,
  });
  // Durable enqueue — see system-concepts.md → Email Delivery & Retry
  // Queue. Never throws; falls back to best-effort send if Mongo is
  // down. Replaces the legacy fire-and-forget `sendEmail` call.
  await emailHelper.enqueue(emailData, { kind: 'registration_otp' });

  return { otp };
};
