import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload, Secret } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { sendVerificationOTP } from '../../../helpers/authHelpers';
import { emailHelper } from '../../../helpers/emailHelper';
import { jwtHelper } from '../../../helpers/jwtHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import {
  IAuthResetPassword,
  IChangePassword,
  ILoginData,
  ISocialLogin,
  IVerifyEmail,
} from '../../../types/auth';
import cryptoToken from '../../../util/cryptoToken';
import generateOTP from '../../../util/generateOTP';
import { ResetToken } from './resetToken/resetToken.model';
import { User } from '../user/user.model';
import { DeviceTokenService } from '../device-token/device-token.service';
import { USER_STATUS, USER_ROLES } from '../../../enums/user';
import { logger } from '../../../shared/logger';
import {
  OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
  PASSWORD_HISTORY_DEPTH,
} from '../../../config/auth.constants';

const googleClient = new OAuth2Client();

// All valid Google client IDs â€” iOS, Android, Web each get a separate one.
// verifyIdToken accepts an array; token is valid if aud matches ANY of them.
const googleAudience = [
  config.google.clientIdIos,
  config.google.clientIdAndroid,
  config.google.clientIdWeb,
].filter(Boolean);

const loginUserFromDB = async (
  payload: ILoginData,
  sessionMetadata?: { ip?: string; userAgent?: string },
) => {
  const { email, password, deviceToken, platform, appVersion } = payload;
  // `tokenVersion` is `select: false` on the schema â€” pull it explicitly
  // here so the issued JWT carries the current rotation counter.
  const isExistUser = await User.findOne({ email }).select('+password +tokenVersion');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
  }

  if (isExistUser.status === USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been deleted. Contact support.'
    );
  }

  if (isExistUser.status === USER_STATUS.PENDING) {
    if (!isExistUser.isVerified) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account is pending verification. Please verify your email.'
      );
    } else {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Admin Verification Pending. Your account is currently under review.'
      );
    }
  }

  if (isExistUser.status === USER_STATUS.REJECTED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account was rejected.'
    );
  }

  if (isExistUser.status === USER_STATUS.SUSPENDED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been suspended.'
    );
  }

  if (isExistUser.status === USER_STATUS.RESTRICTED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account is restricted. Contact support.'
    );
  }

  if (isExistUser.status === USER_STATUS.INACTIVE) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account is inactive. Please activate it or contact support.'
    );
  }

  if (!isExistUser.isVerified) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'Please verify your account, then try to login again'
    );
  }

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is required!');
  }

  if (!(await User.isMatchPassword(password, isExistUser.password as string))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
  }

  // JWT: access token
  const accessToken = jwtHelper.createToken(
    {
      id: isExistUser._id.toString(),
      role: isExistUser.role,
      email: isExistUser.email as string,
      tokenVersion: isExistUser.tokenVersion ?? 0,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  // JWT: refresh token
  const refreshToken = jwtHelper.createToken(
    {
      id: isExistUser._id.toString(),
      role: isExistUser.role,
      email: isExistUser.email as string,
      tokenVersion: isExistUser.tokenVersion ?? 0,
    },
    config.jwt.jwt_refresh_secret as Secret,
    config.jwt.jwt_refresh_expire_in as string
  );

  // âœ… save device token
  if (deviceToken) {
    try {
      await DeviceTokenService.addDeviceToken(
        isExistUser._id.toString(),
        deviceToken,
        platform,
        appVersion,
        sessionMetadata,
      );
    } catch (error) {
      logger.error('Failed to register device token during login', error);
      // Do not throw â€” authentication state is more critical than notification registration
    }
  }

  return { tokens: { accessToken, refreshToken } };
};

// logout
//
// `deviceToken` is OPTIONAL. A client that has lost or never registered
// its push token should still be able to end its session (clear the
// refresh cookie via the controller). When supplied, the matching entry
// in `User.deviceTokens[]` is removed; when omitted, the call is a
// no-op at the service layer and the controller-level cookie-clear
// still happens.
const logoutUserFromDB = async (user: JwtPayload, deviceToken?: string) => {
  if (!deviceToken) {
    return; // no-op â€” controller still wipes the refresh-token cookie
  }

  try {
    await DeviceTokenService.removeDeviceToken(user.id, deviceToken, user.iat ? user.iat * 1000 : undefined);
  } catch (error) {
    logger.error('Failed to remove device token during logout', error);
    // Do not throw â€” logout must succeed even if token cleanup fails
  }
};

//forget password
const forgetPasswordToDB = async (email: string) => {
  const isExistUser = await User.findOne({ email });

  // Silent success: if user doesn't exist, don't throw error
  if (!isExistUser) {
    return;
  }

  // Clear any existing reset tokens for this user (invalidate old requests)
  await ResetToken.deleteMany({ user: isExistUser._id });

  const otp = generateOTP();
  const value = {
    otp,
    email: isExistUser.email,
  };

  // Persist the OTP BEFORE enqueuing the email. Race fix: previously
  // the email went out first, then the user-doc was updated, leaving
  // a window where a fast user could submit the OTP before it was
  // committed (and hit "Invalid or expired"). The `console.log` that
  // used to live here leaked the OTP to stdout â€” removed.
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + OTP_TTL_MS),
  };
  await User.findOneAndUpdate(
    { email, status: { $ne: USER_STATUS.DELETED } },
    { $set: { authentication } }
  );

  const forgetPassword = emailTemplate.resetPassword(value);
  await emailHelper.enqueue(forgetPassword, { kind: 'forgot_password_otp' });
};

//verify email
const verifyEmailToDB = async (payload: IVerifyEmail) => {
  const { email, otp } = payload;

  if (!otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP is required');
  }

  // Atomic find and update to prevent race conditions (double-submit)
  // We use current time in query to ensure the OTP is still valid
  const filter = {
    email,
    'authentication.oneTimeCode': otp,
    'authentication.expireAt': { $gt: new Date() },
    status: { $ne: USER_STATUS.DELETED },
  };

  const isExistUser = await User.findOne(filter).select('+authentication +tokenVersion');

  if (!isExistUser) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid or expired verification code'
    );
  }

  let message;
  let data;
  let tokens;

  if (!isExistUser.isVerified) {
    // Mark as verified and clear OTP
    const updatedUser = await User.findOneAndUpdate(
      { _id: isExistUser._id },
      {
        $set: {
          isVerified: true,
          'authentication.oneTimeCode': null,
          'authentication.expireAt': null,
        },
      },
      { new: true }
    );

    if (updatedUser?.status === USER_STATUS.PENDING) {
      if (updatedUser.role === USER_ROLES.USER) {
        // Automatically make them ACTIVE since they do not need admin approval
        await User.findOneAndUpdate(
          { _id: updatedUser._id },
          { $set: { status: USER_STATUS.ACTIVE } }
        );
      } else {
        message =
          'Email verified successfully. Your account is now pending admin approval. You will receive an email once an administrator approves your account.';
        return {
          data: {
            email: updatedUser.email,
            isVerified: updatedUser.isVerified,
            status: updatedUser.status,
          },
          message,
          tokens: null,
        };
      }
    }

    // Auto-login for users who are already ACTIVE (e.g. email change or re-verify)
    const accessToken = jwtHelper.createToken(
      {
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
        tokenVersion: isExistUser.tokenVersion ?? 0,
      },
      config.jwt.jwt_secret as Secret,
      config.jwt.jwt_expire_in as string
    );

    const refreshToken = jwtHelper.createToken(
      {
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
        tokenVersion: isExistUser.tokenVersion ?? 0,
      },
      config.jwt.jwt_refresh_secret as Secret,
      config.jwt.jwt_refresh_expire_in as string
    );

    tokens = { accessToken, refreshToken };
    message = 'Email verify successfully';
    return {
      data: {
        ...tokens,
      },
      message,
      tokens,
    };
  } else {
    // For password reset flow
    await User.findOneAndUpdate(
      { _id: isExistUser._id },
      {
        $set: {
          'authentication.isResetPassword': true,
          'authentication.oneTimeCode': null,
          'authentication.expireAt': null,
        },
      }
    );

    //create token ;
    const createToken = cryptoToken();
    await ResetToken.create({
      user: isExistUser._id,
      token: createToken,
      expireAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    message =
      'Verification Successful: Please securely store and utilize this code for reset password';
    data = { resetToken: createToken };
  }
  return { data, message, tokens };
};

//reset password
const resetPasswordToDB = async (
  token: string,
  payload: IAuthResetPassword
) => {
  const { newPassword } = payload;

  if (!token) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Reset token is required');
  }

  // Use a transaction or atomic approach:
  // Find valid token and its user in one go
  const isExistToken = await ResetToken.findOne({
    token,
    expireAt: { $gt: new Date() },
  });

  if (!isExistToken) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'Invalid or expired reset token'
    );
  }

  // Check user permission (one-time flag). Pull password + passwordHistory
  // so we can run the reuse check below.
  const isExistUser = await User.findOne({
    _id: isExistToken.user,
    'authentication.isResetPassword': true,
    status: { $ne: USER_STATUS.DELETED },
  }).select('+authentication +password +passwordHistory');

  if (!isExistUser) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Invalid request or session. Please click 'Forgot Password' again."
    );
  }

  // Reuse check â€” block the current password AND any of the previous
  // N-1 in history. Reset-password has no "current password" challenge
  // from the user, so we compare against the stored hash directly here.
  if (
    isExistUser.password &&
    (await User.isMatchPassword(newPassword, isExistUser.password))
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have recently used this password. Please choose a different one.',
    );
  }
  const recentlyUsed = await User.isPasswordReused(
    newPassword,
    (isExistUser as any).passwordHistory,
  );
  if (recentlyUsed) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have recently used this password. Please choose a different one.',
    );
  }

  // Hash new password
  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  // Push the OLD hash onto history, FIFO-trim to the configured depth.
  const updatedHistory = [
    { hash: isExistUser.password, changedAt: new Date() },
    ...(((isExistUser as any).passwordHistory ?? []) as Array<{
      hash: string;
      changedAt: Date;
    }>),
  ].slice(0, PASSWORD_HISTORY_DEPTH);

  // Update user AND increment tokenVersion to invalidate all existing sessions
  // Also clear the reset flag atomically
  await User.findOneAndUpdate(
    { _id: isExistUser._id },
    {
      $set: {
        password: hashPassword,
        passwordHistory: updatedHistory,
        'authentication.isResetPassword': false,
      },
      $inc: { tokenVersion: 1 },
    }
  );

  // Delete the used token immediately
  await ResetToken.deleteOne({ _id: isExistToken._id });

  // Optional: Invalidate all other reset tokens for this user
  await ResetToken.deleteMany({ user: isExistUser._id });
};

const changePasswordToDB = async (
  user: JwtPayload,
  payload: IChangePassword
) => {
  const { currentPassword, newPassword } = payload;
  const isExistUser = await User.findById(user.id).select(
    '+password +passwordHistory',
  );
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //current password match
  if (
    currentPassword &&
    !(await User.isMatchPassword(currentPassword, isExistUser.password as string))
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is incorrect');
  }

  //newPassword and current password
  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please give different password from current password'
    );
  }

  // Reuse check â€” block recently-used passwords. The current password
  // is NOT in history (gets pushed below), so this catches the previous
  // N-1 passwords. Combined with the same-as-current check above, the
  // user is blocked from reusing any of their last N passwords.
  const recentlyUsed = await User.isPasswordReused(
    newPassword,
    (isExistUser as any).passwordHistory,
  );
  if (recentlyUsed) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have recently used this password. Please choose a different one.',
    );
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  // Push the OLD hash onto history, FIFO-trim to the configured depth.
  // We push the OLD (not the new) because the new is now `password`.
  const updatedHistory = [
    { hash: isExistUser.password, changedAt: new Date() },
    ...(((isExistUser as any).passwordHistory ?? []) as Array<{
      hash: string;
      changedAt: Date;
    }>),
  ].slice(0, PASSWORD_HISTORY_DEPTH);

  // Update user AND increment tokenVersion to invalidate all existing sessions
  // Also clear the reset flag atomically
  await User.findOneAndUpdate(
    { _id: user.id },
    {
      $set: {
        password: hashPassword,
        passwordHistory: updatedHistory,
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );
};

const resendVerifyEmailToDB = async (email: string) => {
  return sendVerificationOTP(email);
};

// Social login (Google / Apple ID token verification)
const socialLoginToDB = async (
  payload: ISocialLogin,
  sessionMetadata?: { ip?: string; userAgent?: string },
) => {
  const { provider, idToken, nonce, deviceToken, platform, appVersion } = payload;

  let email: string | undefined;
  let name: string | undefined;
  let providerId: string;

  if (provider === 'google') {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleAudience,
    });
    const tokenPayload = ticket.getPayload();
    if (!tokenPayload || !tokenPayload.email) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        'Invalid Google ID token'
      );
    }

    // Reject tokens where Google has not verified the email. Prevents an
    // attacker from minting tokens for arbitrary unverified addresses.
    if (!tokenPayload.email_verified) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        'Google account email is not verified',
      );
    }

    // Nonce replay protection: Google echoes the raw nonce in the token
    // when the client passes it to the SDK. Flutter's google_sign_in
    // plugin doesn't expose nonce, so we only enforce the check if the
    // client actually sent one.
    if (nonce && tokenPayload.nonce !== nonce) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Nonce mismatch');
    }

    email = tokenPayload.email;
    name = tokenPayload.name || email.split('@')[0];
    providerId = tokenPayload.sub;
  } else {
    // Apple â€” nonce is mandatory (Apple best practice + plugin supports it)
    if (!nonce) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Nonce is required for Apple sign-in',
      );
    }

    const applePayload = await appleSignin.verifyIdToken(idToken, {
      audience: config.apple_client_id,
      ignoreExpiration: false,
    });
    if (!applePayload.sub) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        'Invalid Apple ID token'
      );
    }

    // Apple puts SHA256(nonce) in the token â€” hash the client-provided
    // raw nonce and compare.
    const expectedHash = crypto
      .createHash('sha256')
      .update(nonce)
      .digest('hex');
    if (applePayload.nonce !== expectedHash) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Nonce mismatch');
    }

    email = applePayload.email;
    providerId = applePayload.sub;
    name = email ? email.split('@')[0] : 'Apple User';
  }

  // Find user strictly by provider ID. Matching on email here would let an
  // attacker who controls a provider account with the same email address
  // hijack a local/password account â€” see OWASP "Account Linking" guidance.
  const providerField = provider === 'google' ? 'googleId' : 'appleId';
  let user = await User.findOne({ [providerField]: providerId }).select(
    '+tokenVersion'
  );

  if (user) {
    // Status checks â€” same messages as POST /auth/login so the two
    // sign-in surfaces behave uniformly. Without this block a SUSPENDED
    // user could still get tokens here and would only be stopped on the
    // next protected call by the auth middleware.
    if (user.status === USER_STATUS.DELETED) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account has been deleted. Contact support.'
      );
    }
      if (user.status === USER_STATUS.PENDING) {
        if (!user.isVerified) {
          throw new ApiError(
            StatusCodes.FORBIDDEN,
            'Your account is pending verification. Please verify your email.'
          );
        } else {
          throw new ApiError(
            StatusCodes.FORBIDDEN,
            'Admin Verification Pending. Your account is currently under review.'
          );
        }
      }
    if (user.status === USER_STATUS.REJECTED) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account was rejected.'
      );
    }
    if (user.status === USER_STATUS.SUSPENDED) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account has been suspended.'
      );
    }
    if (user.status === USER_STATUS.RESTRICTED) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account is restricted. Contact support.'
      );
    }
    if (user.status === USER_STATUS.INACTIVE) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Your account is inactive. Please activate it or contact support.'
      );
    }
  } else {
    // No user linked to this provider identity. If the email already
    // belongs to another account, refuse to auto-link â€” the user must
    // authenticate with that account first and link the provider
    // explicitly from a settings flow.
    if (email) {
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'An account with this email already exists. Please sign in with your password and link your social account from settings.',
        );
      }
    }
    // Create new user
    if (!email) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Email is required to create an account. Please allow email sharing.'
      );
    }

    user = await User.create({
      name: name,
      email,
      isVerified: true,
      status: USER_STATUS.PENDING,
      [providerField]: providerId,
    });

    // Re-fetch with tokenVersion
    user = await User.findById(user._id).select('+tokenVersion');
    if (!user) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create user');
    }
  }

  // Register device token
  if (deviceToken) {
    try {
      await DeviceTokenService.addDeviceToken(
        user._id.toString(),
        deviceToken,
        platform,
        appVersion,
        sessionMetadata,
      );
    } catch (error) {
      logger.error('Failed to register device token during social login', error);
      // Do not throw
    }
  }

  // Issue tokens
  const accessToken = jwtHelper.createToken(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  const refreshToken = jwtHelper.createToken(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    },
    config.jwt.jwt_refresh_secret as Secret,
    config.jwt.jwt_refresh_expire_in as string
  );

  return { tokens: { accessToken, refreshToken } };
};

// Refresh token: verify and issue new tokens with rotation
const refreshTokenToDB = async (token: string) => {
  if (!token) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Refresh token is required');
  }

  // Verify the refresh token
  const decoded = jwtHelper.verifyToken(
    token,
    config.jwt.jwt_refresh_secret as Secret
  );

  const userId = decoded.id as string;
  const tokenVersion = decoded.tokenVersion as number;

  // Pull the hidden `tokenVersion` so we can compare against the
  // version baked into the refresh token.
  const user = await User.findById(userId).select('+tokenVersion');
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }

  if (user.status === USER_STATUS.DELETED) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'User account is deleted');
  }

  // Reuse Detection: If the token version in the JWT doesn't match the DB version,
  // it means the token was already used (rotated) or invalidated.
  if (user.tokenVersion !== tokenVersion) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'Refresh token expired or already used. Please login again.'
    );
  }

  // Conditional update guards the verify-then-bump race. Without it,
  // two parallel valid refreshes both pass the version check above and
  // both run $inc â€” only the second client's tokens would actually
  // match the new DB version, the first client gets dead tokens.
  //
  // With the `tokenVersion: tokenVersion` filter, only the FIRST update
  // matches; subsequent parallel updates find no document and return
  // null, surfacing as the same 401 the natural reuse-detection
  // produces â€” which is the correct outcome (one of them used a
  // refresh token that's now stale).
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, tokenVersion },
    { $inc: { tokenVersion: 1 } },
    { new: true }
  ).select('+tokenVersion');

  if (!updatedUser) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'Refresh token expired or already used. Please login again.'
    );
  }

  // Issue new tokens with the NEW tokenVersion
  const accessToken = jwtHelper.createToken(
    {
      id: updatedUser._id.toString(),
      role: updatedUser.role,
      email: updatedUser.email,
      tokenVersion: updatedUser.tokenVersion ?? 0,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string
  );

  const newRefreshToken = jwtHelper.createToken(
    {
      id: updatedUser._id.toString(),
      role: updatedUser.role,
      email: updatedUser.email,
      tokenVersion: updatedUser.tokenVersion ?? 0,
    },
    config.jwt.jwt_refresh_secret as Secret,
    config.jwt.jwt_refresh_expire_in as string
  );

  return { tokens: { accessToken, refreshToken: newRefreshToken } };
};

// Restore an account that is in DELETED status and still inside its
// 30-day recovery window. Validates credentials the same way login does,
// flips status back to ACTIVE, clears soft-delete markers, bumps
// tokenVersion (so any leftover JWTs from before deletion stay invalid),
// and issues a fresh access + refresh token pair.
const restoreAccountFromDB = async (
  payload: {
    email: string;
    password: string;
    deviceToken?: string;
  },
  sessionMetadata?: { ip?: string; userAgent?: string },
) => {
  const { email, password, deviceToken } = payload;

  const isExistUser = await User.findOne({ email }).select(
    '+password +tokenVersion',
  );

  // Avoid leaking existence of soft-deleted vs purged users â€” both
  // collapse to the same generic credential failure.
  if (!isExistUser || !isExistUser.password) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
  }

  const passwordOk = await User.isMatchPassword(password, isExistUser.password);
  if (!passwordOk) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
  }

  if (isExistUser.status !== USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Account is not in recovery state',
    );
  }

  const now = new Date();
  if (
    !isExistUser.recoveryDeadline ||
    isExistUser.recoveryDeadline.getTime() <= now.getTime()
  ) {
    // Past the 30-day window. The cron should have purged this row by
    // now; if it hasn't yet, treat it as gone for the client.
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
  }

  const restored = await User.findByIdAndUpdate(
    isExistUser._id,
    {
      $set: {
        status: USER_STATUS.ACTIVE,
        deletedAt: null,
        recoveryDeadline: null,
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  ).select('+tokenVersion');

  if (!restored) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to restore account',
    );
  }

  const accessToken = jwtHelper.createToken(
    {
      id: restored._id.toString(),
      role: restored.role,
      email: restored.email,
      tokenVersion: restored.tokenVersion ?? 0,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string,
  );

  const refreshToken = jwtHelper.createToken(
    {
      id: restored._id.toString(),
      role: restored.role,
      email: restored.email,
      tokenVersion: restored.tokenVersion ?? 0,
    },
    config.jwt.jwt_refresh_secret as Secret,
    config.jwt.jwt_refresh_expire_in as string,
  );

  if (deviceToken) {
    await User.addDeviceToken(
      restored._id.toString(),
      deviceToken,
      undefined,
      undefined,
      sessionMetadata,
    );
  }

  return {
    tokens: { accessToken, refreshToken },
  };
};

export const AuthService = {
  verifyEmailToDB,
  loginUserFromDB,
  forgetPasswordToDB,
  resetPasswordToDB,
  changePasswordToDB,
  resendVerifyEmailToDB,
  logoutUserFromDB,
  socialLoginToDB,
  refreshTokenToDB,
  restoreAccountFromDB,
};
