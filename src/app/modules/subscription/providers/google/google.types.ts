// Local type aliases for the Google Play Billing provider.
// These wrap the googleapis Android Publisher response shapes into a
// narrower, internal contract so the rest of the subscription module does
// not depend directly on library internals. If googleapis ever changes its
// types, only this module adapts.

export type GoogleEnvironment = 'sandbox' | 'production';

// Mirrors Google Play subscriptionsv2.get → SubscriptionPurchaseV2 shape.
export type DecodedGoogleSubscription = {
  purchaseToken: string;
  productId: string; // base plan / product
  orderId?: string; // latestOrderId
  // Subscription state values from Google:
  //   SUBSCRIPTION_STATE_ACTIVE
  //   SUBSCRIPTION_STATE_CANCELED
  //   SUBSCRIPTION_STATE_IN_GRACE_PERIOD
  //   SUBSCRIPTION_STATE_ON_HOLD
  //   SUBSCRIPTION_STATE_PAUSED
  //   SUBSCRIPTION_STATE_EXPIRED
  //   SUBSCRIPTION_STATE_PENDING
  subscriptionState: string;
  startTime?: string; // ISO timestamp
  expiryTime?: string; // ISO timestamp
  autoRenewing?: boolean;
  acknowledgementState?: string; // ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED | _PENDING
  linkedPurchaseToken?: string; // set on upgrade/downgrade
  testPurchase?: boolean;
  environment: GoogleEnvironment;
};

export type GoogleWebhookResult = {
  processed: boolean;
  notificationType?: string; // textual: SUBSCRIPTION_RENEWED, etc.
  rawNotificationType?: number; // numeric per Google docs
  reason?:
    | 'duplicate'
    | 'no_subscription_notification'
    | 'queued_as_orphan'
    | 'applied'
    | 'test'
    | 'unauthorized'
    | 'google_api_error';
};
