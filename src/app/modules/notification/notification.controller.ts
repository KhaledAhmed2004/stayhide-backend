import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { NotificationService } from './notification.service';
import { JwtPayload } from 'jsonwebtoken';

const getNotificationFromDB = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const result = await NotificationService.getNotificationFromDB(
      user,
      req.query
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Notifications retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

const readNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  await NotificationService.markNotificationAsReadIntoDB(
    req.params.notificationId,
    user.id
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification marked as read successfully',
    data: null,
  });
});

const readAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await NotificationService.markAllNotificationsAsRead(user.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: { updated: result.modifiedCount },
  });
});

const sendNotification = catchAsync(async (req: Request, res: Response) => {
  const { title, text, audience } = req.body;
  const result = await NotificationService.sendAdminNotification(
    title,
    text,
    audience,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Notification sent to ${result.recipientCount} users`,
    data: result,
  });
});

const getSentHistory = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getSentHistory(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Sent notification history retrieved successfully',
    meta: result.pagination,
    data: result.data,
  });
});

export const NotificationController = {
  getNotificationFromDB,
  readAllNotifications,
  readNotification,
  sendNotification,
  getSentHistory,
};
