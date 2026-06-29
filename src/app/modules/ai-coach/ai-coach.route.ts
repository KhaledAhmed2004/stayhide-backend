import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import { auth, validateRequest } from '../../middlewares';
import { AiCoachController } from './ai-coach.controller';
import { AiCoachValidation } from './ai-coach.validation';

const router = express.Router();

router.use(auth(USER_ROLES.USER));

router.get('/sessions', AiCoachController.getAllSessions);
router.get('/sessions/:sessionId', AiCoachController.getSessionById);

router.post(
  '/message',
  validateRequest(AiCoachValidation.sendMessageZodSchema),
  AiCoachController.sendMessage
);

export const AiCoachRoutes = router;
