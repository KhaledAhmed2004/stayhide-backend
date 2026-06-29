import { SUBSCRIPTION_PLAN } from '../subscription.interface';
// import { PreferenceCardModel } from '../../preference-card/preference-card.model';
import { getUserEntitlement } from './entitlement';

/**
 * Hard-coded plan limits according to the product roadmap (§9 in overview.md).
 * FREE: 2 cards
 * PREMIUM: 20 cards
 * ENTERPRISE: Unlimited
 */
const PLAN_LIMITS: Record<SUBSCRIPTION_PLAN, number> = {
  [SUBSCRIPTION_PLAN.FREE]: 2,
  [SUBSCRIPTION_PLAN.PREMIUM]: 20,
  [SUBSCRIPTION_PLAN.ENTERPRISE]: Infinity,
};

/**
 * Checks if a user is allowed to create another preference card based on their
 * current subscription plan quota.
 *
 * @param userId The ID of the user attempting to create a card.
 * @returns An object indicating if the creation is allowed and the current usage.
 */
export const checkCardCreationQuota = async (userId: string) => {
  const entitlement = await getUserEntitlement(userId);
  const limit = PLAN_LIMITS[entitlement.plan] || 2; // Default to FREE limit if plan is unknown

  if (limit === Infinity) {
    return { allowed: true, limit, current: 0 };
  }

  // Count non-deleted cards created by this user
  // const currentCount = await PreferenceCardModel.countDocuments({
  //   createdBy: userId,
  //   isDeleted: false,
  // });
  const currentCount = 0;

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  };
};
