import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { AdminController } from './admin.controller';

const router = express.Router();

router.get(
  '/growth-metrics',
  auth(USER_ROLES.ADMIN),
  AdminController.getDashboardStats,
);

router.get(
  '/recent-activities',
  auth(USER_ROLES.ADMIN),
  AdminController.getRecentActivities,
);

export const AdminRoutes = router;
