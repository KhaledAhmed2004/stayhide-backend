import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../errors/ApiError';
import { getUserEntitlement } from '../modules/subscription/helpers/entitlement';
import { SUBSCRIPTION_PLAN } from '../modules/subscription/subscription.interface';
import { USER_ROLES } from '../../enums/user';

/**
 * Middleware to enforce subscription plan requirements.
 * Should be used AFTER the auth() middleware.
 *
 * @param requiredPlan The minimum subscription plan required to access the route.
 */
const subscriptionGate = (requiredPlan: SUBSCRIPTION_PLAN) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      // Super admins bypass all subscription gates — they are the builders.
      if (user.role === USER_ROLES.ADMIN) {
        return next();
      }

      const entitlement = await getUserEntitlement((user as any).id);

      // 1. Basic status check (block inactive/expired/revoked)
      if (!entitlement.isActive) {
        throw new ApiError(
          StatusCodes.PAYMENT_REQUIRED,
          'Your subscription is inactive. Please subscribe to access this feature.'
        );
      }

      // 2. Plan hierarchy check
      // Hierarchy: FREE < PREMIUM < ENTERPRISE

      if (requiredPlan === SUBSCRIPTION_PLAN.FREE) {
        // Everyone with active status can access FREE features
        return next();
      }

      if (requiredPlan === SUBSCRIPTION_PLAN.PREMIUM) {
        // Premium or Enterprise allowed
        if (entitlement.isPremium || entitlement.isEnterprise) {
          return next();
        }
      }

      if (requiredPlan === SUBSCRIPTION_PLAN.ENTERPRISE) {
        // Only Enterprise allowed
        if (entitlement.isEnterprise) {
          return next();
        }
      }

      // If we reach here, the user's plan is insufficient
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        `This feature requires a ${requiredPlan} subscription plan.`
      );
    } catch (error) {
      next(error);
    }
  };
};

export default subscriptionGate;
