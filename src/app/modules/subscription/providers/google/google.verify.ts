import httpStatus from 'http-status';
import ApiError from '../../../../../errors/ApiError';
import config from '../../../../../config';
import { logger } from '../../../../../shared/logger';
import { getAndroidPublisher } from './google.client';
import { DecodedGoogleSubscription, GoogleEnvironment } from './google.types';

// Pulls the latest subscription state for a purchase token from the Google
// Play Developer API and normalizes it into our internal shape.
export const verifyGoogleSubscription = async (
  purchaseToken: string,
  productId?: string
): Promise<DecodedGoogleSubscription> => {
  if (!purchaseToken || typeof purchaseToken !== 'string') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'purchaseToken is required and must be a string'
    );
  }

  const publisher = getAndroidPublisher();
  const packageName = config.googlePlay.packageName;

  let response;
  try {
    response = await publisher.purchases.subscriptionsv2.get({
      packageName,
      token: purchaseToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Google purchase verification failed: ${message}`
    );
  }

  const data = response.data;
  if (!data) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Google API returned an empty subscription payload'
    );
  }

  const subscriptionState = String(data.subscriptionState || '');
  if (!subscriptionState) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Decoded Google subscription is missing subscriptionState'
    );
  }

  // Resolve the productId from lineItems[0] when not supplied by the caller.
  // Google's v2 API places the actual productId per line item.
  const lineItems = data.lineItems || [];
  const firstLine = lineItems[0];
  const resolvedProductId =
    productId || firstLine?.productId || (firstLine as any)?.product_id || '';

  if (!resolvedProductId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Decoded Google subscription is missing productId'
    );
  }

  const expiryTime = firstLine?.expiryTime || undefined;
  const autoRenewing = Boolean(firstLine?.autoRenewingPlan?.autoRenewEnabled);

  // Reject if already expired (defensive — caller may also re-check).
  if (expiryTime && Date.now() > new Date(expiryTime).getTime()) {
    if (
      subscriptionState !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' &&
      subscriptionState !== 'SUBSCRIPTION_STATE_ON_HOLD'
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Google subscription has already expired'
      );
    }
  }

  // testPurchase indicates a license-tester / sandbox transaction.
  const testPurchase = Boolean((data as any).testPurchase);
  const environment: GoogleEnvironment = testPurchase ? 'sandbox' : 'production';

  // ✅ Google Policy: purchases must be acknowledged within 72 hours or
  // Google automatically refunds the user. We acknowledge here (after confirming
  // the subscription is valid) using the Publisher API. We do NOT block the
  // verify response on a transient ack failure — the subscription IS valid at
  // this point, and the 72-hour window gives room for a retry.
  //
  // Note: acknowledgement uses `purchases.subscriptions.acknowledge` (v1 endpoint)
  // because `purchases.subscriptionsv2` has no separate acknowledge method.
  try {
    await publisher.purchases.subscriptions.acknowledge({
      packageName,
      subscriptionId: resolvedProductId,
      token: purchaseToken,
      requestBody: {},
    });
  } catch (ackErr) {
    const msg = ackErr instanceof Error ? ackErr.message : 'unknown';
    // This is not fatal — the user gets access. Log so ops can monitor.
    logger.warn(
      `[Google IAP] Purchase acknowledgement failed for token ${purchaseToken.slice(0, 12)}...: ${msg}. ` +
        'Will need manual re-acknowledgement within 72h to prevent auto-refund.'
    );
  }

  return {
    purchaseToken,
    productId: resolvedProductId,
    orderId: data.latestOrderId || undefined,
    subscriptionState,
    startTime: data.startTime || undefined,
    expiryTime,
    autoRenewing,
    acknowledgementState: data.acknowledgementState || undefined,
    linkedPurchaseToken: data.linkedPurchaseToken || undefined,
    testPurchase,
    environment,
  };
};
