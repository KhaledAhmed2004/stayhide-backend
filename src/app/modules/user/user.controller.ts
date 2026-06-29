import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { USER_ROLES } from '../../../enums/user';
import { JwtPayload, Secret } from 'jsonwebtoken';
import { jwtHelper } from '../../../helpers/jwtHelper';
import config from '../../../config';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const { profileImage, ...userData } = req.body;

  // Check if requester is an admin (optional auth for this specific endpoint)
  let isAdmin = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const verifiedUser = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as Secret,
      );
      if (verifiedUser && verifiedUser.role === USER_ROLES.ADMIN) {
        isAdmin = true;
      }
    } catch (err) {
      // Ignore token errors; fallback to public registration flow
    }
  }

  const result = await UserService.createUserToDB(
    {
      ...userData,
      profileImage,
    },
    isAdmin,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message:
      'User created successfully. Please verify your email with the OTP sent.',
    data: {
      email: result.email,
      isVerified: result.isVerified,
      status: result.status,
    },
  });
});

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await UserService.getUserProfileFromDB(user as JwtPayload);

  // Private payload (email, dateOfBirth, verification artefacts). Forbid
  // any shared cache and disable disk persistence. Clients may still keep
  // an in-memory copy for the session.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile data retrieved successfully',
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;

  // All files + text data are in req.body
  const { profileImage, ...rest } = req.body;

  const payload = {
    ...rest,
    ...(profileImage ? { profileImage } : {}),
  };

  const result = await UserService.updateProfileToDB(
    user as JwtPayload,
    payload,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: {
      id: (result as any)?._id,
      ...payload,
      updatedAt: result?.updatedAt,
    },
  });
});

const updatePreferences = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const payload = req.body;

  const result = await UserService.updatePreferencesToDB(user as JwtPayload, payload);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Preferences updated successfully',
    data: result,
  });
});

const adminUpdateUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const payload = { ...req.body };
  const result = await UserService.updateUserByAdminInDB(userId, payload);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully',
    data: {
      id: (result as any)?._id,
      updatedAt: result?.updatedAt,
    },
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await UserService.deleteUserPermanentlyFromDB(userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted permanently',
    data: { id: result?._id },
  });
});

const getAllUserRoles = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUserRolesFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User list fetched',
    meta: result.meta,
    data: result.data,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requester = req.user as JwtPayload;

  const result = await UserService.getUserByIdFromDB(userId, requester);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User data retrieved',
    data: result,
  });
});

const getUserMetrics = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserMetricsFromDB();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User metrics retrieved',
    data: result,
  });
});

const requestAccountDeletion = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const { password } = req.body as { password: string };

    const result = await UserService.requestAccountDeletionFromDB(
      user,
      password,
    );

    // The user's tokens were just invalidated server-side; clear the cookie too.
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message:
        'Account scheduled for deletion. You can restore it within the recovery window.',
      data: result,
    });
  },
);

const requestEmailChange = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { newEmail, password } = req.body as {
    newEmail: string;
    password: string;
  };

  const result = await UserService.requestEmailChangeFromDB(user, {
    newEmail,
    password,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Verification code sent to the new email. Confirm within the OTP window to complete the change.',
    data: result,
  });
});

const listMySessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.listMySessionsFromDB(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Active sessions retrieved.',
    data: result,
  });
});

const revokeMySession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { tokenId } = req.params;

  const result = await UserService.revokeMySessionFromDB(user, tokenId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Session revoked.',
    data: result,
  });
});

const revokeAllMySessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.revokeAllMySessionsFromDB(user);

  // tokenVersion was bumped — wipe the refresh cookie so the current
  // browser can't ride its old refresh token.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All sessions revoked. Please log in again.',
    data: result,
  });
});

const exportMyData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.exportMyDataFromDB(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Personal data export generated.',
    data: result,
  });
});

const confirmEmailChange = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { otp } = req.body as { otp: string };

  const result = await UserService.confirmEmailChangeFromDB(user, otp);

  // tokenVersion was bumped — wipe the refresh-token cookie so the browser
  // can't retry with stale credentials.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Email changed successfully. Please log in again with the new email.',
    data: result,
  });
});

export const UserController = {
  createUser,
  getUserProfile,
  updateProfile,
  getAllUserRoles,
  updatePreferences,
  adminUpdateUser,
  deleteUser,
  getUserById,
  getUserMetrics,
  requestAccountDeletion,
  requestEmailChange,
  confirmEmailChange,
  exportMyData,
  listMySessions,
  revokeMySession,
  revokeAllMySessions,
};
