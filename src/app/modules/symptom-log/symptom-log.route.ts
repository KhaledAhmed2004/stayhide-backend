import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import { auth, validateRequest, rateLimitMiddleware } from '../../middlewares';
import { SymptomLogController } from './symptom-log.controller';
import { SymptomLogValidation } from './symptom-log.validation';

const router = express.Router();

// Apply auth to all routes
router.use(auth(USER_ROLES.USER));

router.get(
  '/trends',
  validateRequest(SymptomLogValidation.getTrendsZodSchema),
  SymptomLogController.getTrends,
);

router.get(
  '/summary/:date',
  validateRequest(SymptomLogValidation.getSymptomLogZodSchema),
  SymptomLogController.getDailySummary,
);

router.get(
  '/:date',
  validateRequest(SymptomLogValidation.getSymptomLogZodSchema),
  SymptomLogController.getSymptomLog,
);

router.put(
  '/:date',
  validateRequest(SymptomLogValidation.upsertSymptomLogZodSchema),
  SymptomLogController.upsertSymptomLog,
);

export const SymptomLogRoutes = router;
