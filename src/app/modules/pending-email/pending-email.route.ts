import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { PendingEmailController } from './pending-email.controller';
import { PendingEmailValidation } from './pending-email.validation';

const router = express.Router();

// All endpoints SUPER_ADMIN only (G7 — explicit role guard).
// Fixed paths before param paths.

// `/stats` is a fixed path; declare before `:pendingEmailId`.
router.get(
  '/stats',
  auth(USER_ROLES.ADMIN),
  PendingEmailController.getPendingEmailStats,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  validateRequest(PendingEmailValidation.listPendingEmailsZodSchema),
  PendingEmailController.listPendingEmails,
);

router.post(
  '/:pendingEmailId/requeue',
  auth(USER_ROLES.ADMIN),
  validateRequest(PendingEmailValidation.requeuePendingEmailZodSchema),
  PendingEmailController.requeuePendingEmail,
);

export const PendingEmailRoutes = router;
