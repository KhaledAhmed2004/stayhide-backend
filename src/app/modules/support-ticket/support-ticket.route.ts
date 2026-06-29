import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { SupportTicketController } from './support-ticket.controller';
import { SupportTicketValidation } from './support-ticket.validation';

const router = express.Router();

const ATTACHMENT_FIELDS = [{ name: 'attachments', maxCount: 5 }];
const FILE_OPTS = { maxFileSizeMB: 25 };

router.get(
  '/admin/list',
  auth(USER_ROLES.ADMIN),
  SupportTicketController.getAllTickets,
);

router.get(
  '/admin/stats',
  auth(USER_ROLES.ADMIN),
  SupportTicketController.getTicketStats,
);

router.patch(
  '/admin/:ticketId/status',
  auth(USER_ROLES.ADMIN),
  validateRequest(SupportTicketValidation.updateStatusZodSchema),
  SupportTicketController.updateTicketStatus,
);

router.patch(
  '/admin/:ticketId/priority',
  auth(USER_ROLES.ADMIN),
  validateRequest(SupportTicketValidation.updatePriorityZodSchema),
  SupportTicketController.updateTicketPriority,
);

router.patch(
  '/admin/:ticketId/assign',
  auth(USER_ROLES.ADMIN),
  validateRequest(SupportTicketValidation.assignTicketZodSchema),
  SupportTicketController.assignTicket,
);

// Create a new ticket (with optional attachments)
router.post(
  '/',
  auth(USER_ROLES.USER),
  fileHandler(ATTACHMENT_FIELDS, FILE_OPTS),
  validateRequest(SupportTicketValidation.createTicketZodSchema),
  SupportTicketController.createTicket,
);

// List my tickets (BROTHER/SISTER only — admins use /admin/list)
router.get(
  '/my',
  auth(USER_ROLES.USER),
  SupportTicketController.getMyTickets,
);

// Reply to a ticket (any participant — ownership / admin checked in service)
router.post(
  '/:ticketId/reply',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  fileHandler(ATTACHMENT_FIELDS, FILE_OPTS),
  validateRequest(SupportTicketValidation.replyTicketZodSchema),
  SupportTicketController.replyToTicket,
);

// Paginated message list for a single ticket
router.get(
  '/:ticketId/messages',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(SupportTicketValidation.ticketIdParamSchema),
  SupportTicketController.getTicketMessages,
);

// Single ticket detail (no messages — paginated separately)
router.get(
  '/:ticketId',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(SupportTicketValidation.ticketIdParamSchema),
  SupportTicketController.getTicketById,
);

export const SupportTicketRoutes = router;
