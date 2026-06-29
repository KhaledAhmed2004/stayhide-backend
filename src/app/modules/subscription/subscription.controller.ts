import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';
import SubscriptionService from './subscription.service';

export const getMySubscriptionController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const result = await SubscriptionService.getMySubscription(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription retrieved successfully',
      data: result,
    });
  }
);

export const verifyApplePurchaseController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { signedTransactionInfo } = req.body as {
      signedTransactionInfo: string;
    };
    const result = await SubscriptionService.verifyApplePurchase(
      id,
      signedTransactionInfo
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Apple subscription verified successfully',
      data: result,
    });
  }
);

// Apple Server Notifications V2 webhook. No auth because signature
// verification inside the service replaces caller trust.
export const appleWebhookController = catchAsync(
  async (req: Request, res: Response) => {
    // The /apple/webhook route uses express.raw() so req.body is a Buffer
    // — parse it manually without mutating the raw bytes.
    let body: { signedPayload?: string };
    if (Buffer.isBuffer(req.body)) {
      try {
        body = JSON.parse(req.body.toString('utf8'));
      } catch {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid webhook body JSON');
      }
    } else {
      body = req.body as { signedPayload?: string };
    }

    const signedPayload = body?.signedPayload;
    if (!signedPayload) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'signedPayload missing from webhook body'
      );
    }

    await SubscriptionService.processAppleWebhook(signedPayload);
    res.sendStatus(httpStatus.OK);
  }
);

export const verifyGooglePurchaseController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { purchaseToken, productId } = req.body as {
      purchaseToken: string;
      productId: string;
    };
    const result = await SubscriptionService.verifyGooglePurchase(
      id,
      purchaseToken,
      productId
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Google subscription verified successfully',
      data: result,
    });
  }
);

// Google Play RTDN webhook (Pub/Sub push). No app-level auth — the
// service verifies the Pub/Sub JWT internally.
export const googleWebhookController = catchAsync(
  async (req: Request, res: Response) => {
    // The /google/webhook route uses express.raw() so req.body is a Buffer.
    // The service handles JSON parsing + JWT verification.
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const authorizationHeader = req.header('authorization');

    await SubscriptionService.processGoogleWebhook(
      rawBody,
      authorizationHeader
    );
    res.sendStatus(httpStatus.OK);
  }
);

export const chooseFreePlanController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const result = await SubscriptionService.setFreePlan(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Switched to Free plan successfully',
      data: result,
    });
  }
);

// --- Admin Controllers ---

export const getAllSubscriptionsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SubscriptionService.getAllSubscriptions(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscriptions retrieved successfully',
      data: result,
    });
  }
);

export const getSubscriptionAnalyticsController = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await SubscriptionService.getSubscriptionAnalytics();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription analytics retrieved successfully',
      data: result,
    });
  }
);

export const getPendingWebhooksController = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await SubscriptionService.getPendingWebhooks();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Pending webhooks retrieved successfully',
      data: result,
    });
  }
);

export const getSubscriptionByIdController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SubscriptionService.getSubscriptionById(req.params.subscriptionId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription retrieved successfully',
      data: result,
    });
  }
);

export const getSubscriptionEventsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SubscriptionService.getSubscriptionEvents(req.params.userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription events retrieved successfully',
      data: result,
    });
  }
);

export const adminGrantPlanController = catchAsync(
  async (req: Request, res: Response) => {
    const { userId, plan } = req.body;
    const result = await SubscriptionService.adminGrantPlan(userId, plan);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: `${plan} plan granted successfully`,
      data: result,
    });
  }
);

export const adminResetPlanController = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const result = await SubscriptionService.adminResetPlan(userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription reset to FREE successfully',
      data: result,
    });
  }
);

// --- End Admin Controllers ---

const SubscriptionController = {
  getMySubscriptionController,
  verifyApplePurchaseController,
  appleWebhookController,
  verifyGooglePurchaseController,
  googleWebhookController,
  chooseFreePlanController,
  getAllSubscriptionsController,
  getSubscriptionAnalyticsController,
  getPendingWebhooksController,
  getSubscriptionByIdController,
  getSubscriptionEventsController,
  adminGrantPlanController,
  adminResetPlanController,
};

export default SubscriptionController;
