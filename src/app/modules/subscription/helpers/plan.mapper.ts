import {
  SUBSCRIPTION_PLAN,
  SubscriptionPlanType,
} from '../subscription.interface';

// Explicit product-ID → plan mapping.
//
// This is deliberately NOT a fuzzy string match. Every store-configured
// product ID should appear here exactly. Unknown IDs resolve to FREE so
// verification code can detect and reject them cleanly.
//
// When adding a new subscription product in App Store Connect or Google
// Play Console, add the exact product identifier here.
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlanType> = {
  // Apple & Google share the same product identifiers by convention.
  // PREMIUM — $5.99/mo, $3.99/mo billed yearly
  premium_monthly: SUBSCRIPTION_PLAN.PREMIUM,
  premium_yearly: SUBSCRIPTION_PLAN.PREMIUM,

  // ENTERPRISE — $9.99/mo, $5.99/mo billed yearly
  enterprise_monthly: SUBSCRIPTION_PLAN.ENTERPRISE,
  enterprise_yearly: SUBSCRIPTION_PLAN.ENTERPRISE,
};

export const mapAppleProductToPlan = (
  productId: string
): SubscriptionPlanType => {
  return PRODUCT_ID_TO_PLAN[productId] ?? SUBSCRIPTION_PLAN.FREE;
};

export const mapGoogleProductToPlan = (
  productId: string
): SubscriptionPlanType => {
  return PRODUCT_ID_TO_PLAN[productId] ?? SUBSCRIPTION_PLAN.FREE;
};

export const isKnownProductId = (productId: string): boolean => {
  return productId in PRODUCT_ID_TO_PLAN;
};

export const getKnownProductIds = (): string[] => {
  return Object.keys(PRODUCT_ID_TO_PLAN);
};
