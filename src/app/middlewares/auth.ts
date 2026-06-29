import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { USER_STATUS } from '../../enums/user';
import ApiError from '../../errors/ApiError';
import { jwtHelper } from '../../helpers/jwtHelper';
import { JwtUser } from '../../types';
import { User } from '../modules/user/user.model';

const auth =
  (...allowedRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      // 1ï¸âƒ£ No token provided â€” require authentication for all protected routes
      if (!authHeader) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized access');
      }

      // 2ï¸âƒ£ Validate Bearer format
      if (!authHeader.startsWith('Bearer ')) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Authorization header must start with "Bearer "',
        );
      }

      // 3ï¸âƒ£ Extract token and ensure it's not empty
      const token = authHeader.split(' ')[1];
      if (!token || token.trim() === '') {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized access');
      }

      // 4ï¸âƒ£ Verify JWT token
      const verifiedUser = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as Secret,
      );

      if (!verifiedUser || !verifiedUser.role) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token payload');
      }

      // 5ï¸âƒ£ tokenVersion check â€” ensure the JWT's version still matches the
      //     current DB value. This is what makes force-logout / password
      //     reset / status flip actually invalidate live access tokens
      //     instead of waiting for them to expire naturally.
      //
      //     `tokenVersion` is `select: false` on the schema, so we must pull
      //     it explicitly. `.lean()` keeps this ~1ms indexed `_id` lookup.
      const dbUser = await User.findById(verifiedUser.id)
        .select('+tokenVersion status')
        .lean();

      if (!dbUser) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'User no longer exists');
      }

      // Block access for non-active accounts at the middleware level so
      // every protected route gets the guarantee for free.
      if (
        dbUser.status === USER_STATUS.DELETED ||
        dbUser.status === USER_STATUS.RESTRICTED ||
        dbUser.status === USER_STATUS.SUSPENDED ||
        dbUser.status === USER_STATUS.REJECTED ||
        dbUser.status === USER_STATUS.INACTIVE ||
        dbUser.status === USER_STATUS.PENDING
      ) {
        let message: string;
        if (dbUser.status === USER_STATUS.SUSPENDED) {
          message = 'Account is suspended. Please contact support.';
        } else if (dbUser.status === USER_STATUS.REJECTED) {
          message = 'Account verification was rejected. Please re-submit your documents.';
        } else if (dbUser.status === USER_STATUS.PENDING) {
          message = 'Admin Verification Pending. Your account is currently under review.';
        } else {
          message = 'Account is no longer active';
        }
        throw new ApiError(StatusCodes.FORBIDDEN, message);
      }

      const jwtTokenVersion = (verifiedUser as any).tokenVersion as
        | number
        | undefined;

      // Handle the case where tokenVersion might be missing in DB (legacy users)
      // or missing in the lean object. Treat missing as 0 to match schema default.
      const dbTokenVersion = dbUser.tokenVersion ?? 0;

      if (
        typeof jwtTokenVersion === 'number' &&
        dbTokenVersion !== jwtTokenVersion
      ) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Session invalidated â€” please log in again',
        );
      }

      // 6ï¸âƒ£ Attach verified user to request
      req.user = verifiedUser as JwtUser;

      // 7ï¸âƒ£ Role-based access check
      if (allowedRoles.length && !allowedRoles.includes(verifiedUser.role)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to access this API",
        );
      }

      // 8ï¸âƒ£ Proceed
      next();
    } catch (error: any) {
      // Handle JWT-specific errors
      if (error.name === 'JsonWebTokenError') {
        return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token'));
      }
      if (error.name === 'TokenExpiredError') {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, 'Token has expired'),
        );
      }
      if (error.name === 'NotBeforeError') {
        return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Token not active'));
      }

      // Pass other errors
      next(error);
    }
  };

export default auth;
