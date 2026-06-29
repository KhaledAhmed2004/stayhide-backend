import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { PendingEmailService } from './pending-email.service';

const listPendingEmails = catchAsync(async (req: Request, res: Response) => {
  const result = await PendingEmailService.listPendingEmailsFromDB(
    req.query as Record<string, unknown>,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Pending emails retrieved',
    data: result.data,
    meta: result.meta,
  });
});

const requeuePendingEmail = catchAsync(async (req: Request, res: Response) => {
  const { pendingEmailId } = req.params;
  const result = await PendingEmailService.requeuePendingEmailInDB(
    pendingEmailId,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Pending email requeued',
    data: result,
  });
});

const getPendingEmailStats = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await PendingEmailService.getPendingEmailStatsFromDB();
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Pending email stats retrieved',
      data: result,
    });
  },
);

export const PendingEmailController = {
  listPendingEmails,
  requeuePendingEmail,
  getPendingEmailStats,
};
