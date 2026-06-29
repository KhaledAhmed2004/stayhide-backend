import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AdminService } from './admin.service';

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getAdminDashboardStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin dashboard metrics',
    data: result,
  });
});

const getRecentActivities = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getRecentActivities();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Recent activities fetched successfully',
    data: result,
  });
});

export const AdminController = {
  getDashboardStats,
  getRecentActivities,
};
