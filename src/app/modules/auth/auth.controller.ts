import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../../config';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AuthService } from './auth.service';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';

// Pull the bits of session metadata we persist on `deviceTokens[]` —
// IP (will be hashed by the model) and User-Agent (plain). Kept here
// so every credential-issuing controller (login, social-login,
// restore) feeds the same shape into the service.
const sessionMetadataFromReq = (req: Request) => {
  const ip =
    (req.headers['cf-connecting-ip'] as string | undefined) ??
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    req.ip;
  const userAgent =
    (req.headers['user-agent'] as string | undefined) ?? undefined;
  return { ip, userAgent };
};

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { ...verifyData } = req.body;
  const result = await AuthService.verifyEmailToDB(verifyData);

  // Set refresh token in httpOnly cookie for better security
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result.data,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const { ...loginData } = req.body;
  const result = await AuthService.loginUserFromDB(
    loginData,
    sessionMetadataFromReq(req),
  );

  // Set refresh token in httpOnly cookie for better security
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged in successfully.',
    data: {
      ...result.tokens,
    },
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const { deviceToken } = req.body;
  console.log('deviceToken', deviceToken);
  const user = req.user as JwtPayload;

  await AuthService.logoutUserFromDB(user, deviceToken);

  // Clear refresh token cookie on logout
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged out successfully.',
  });
});

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const email = req.body.email;
  const result = await AuthService.forgetPasswordToDB(email);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Please check your email. We have sent you a one-time passcode (OTP).',
    data: result,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Reset token is required');
  }

  // Handle both raw token and Bearer token formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  const { ...resetData } = req.body;
  const result = await AuthService.resetPasswordToDB(token, resetData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully reset.',
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { ...passwordData } = req.body;
  await AuthService.changePasswordToDB(user, passwordData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully changed',
  });
});

const resendVerifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await AuthService.resendVerifyEmailToDB(email);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification code has been resent to your email.',
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  // Prefer reading refresh token from cookie; fallback to body if present
  const cookieToken = req.cookies?.refreshToken as string | undefined;
  const bodyToken = (req.body as { refreshToken?: string })?.refreshToken;
  const token = cookieToken || bodyToken || '';

  const result = await AuthService.refreshTokenToDB(token);

  // Rotate refresh token in httpOnly cookie
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Token refreshed successfully.',
    data: result.tokens,
  });
});

const socialLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.socialLoginToDB(
    req.body,
    sessionMetadataFromReq(req),
  );

  // Set refresh token in httpOnly cookie
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged in successfully.',
    data: {
      ...result.tokens,
    },
  });
});

const restoreAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.restoreAccountFromDB(
    req.body,
    sessionMetadataFromReq(req),
  );

  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Account restored successfully.',
    data: {
      ...result.tokens,
    },
  });
});

export const AuthController = {
  verifyEmail,
  logoutUser,
  loginUser,
  forgetPassword,
  resetPassword,
  changePassword,
  resendVerifyEmail,
  socialLogin,
  refreshToken,
  restoreAccount,
};
