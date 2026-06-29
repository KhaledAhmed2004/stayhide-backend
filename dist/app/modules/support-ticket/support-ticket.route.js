"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const support_ticket_controller_1 = require("./support-ticket.controller");
const support_ticket_validation_1 = require("./support-ticket.validation");
const router = express_1.default.Router();
const ATTACHMENT_FIELDS = [{ name: 'attachments', maxCount: 5 }];
const FILE_OPTS = { maxFileSizeMB: 25 };
router.get('/admin/list', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), support_ticket_controller_1.SupportTicketController.getAllTickets);
router.get('/admin/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), support_ticket_controller_1.SupportTicketController.getTicketStats);
router.patch('/admin/:ticketId/status', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.updateStatusZodSchema), support_ticket_controller_1.SupportTicketController.updateTicketStatus);
router.patch('/admin/:ticketId/priority', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.updatePriorityZodSchema), support_ticket_controller_1.SupportTicketController.updateTicketPriority);
router.patch('/admin/:ticketId/assign', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.assignTicketZodSchema), support_ticket_controller_1.SupportTicketController.assignTicket);
// Create a new ticket (with optional attachments)
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.USER), (0, fileHandler_1.fileHandler)(ATTACHMENT_FIELDS, FILE_OPTS), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.createTicketZodSchema), support_ticket_controller_1.SupportTicketController.createTicket);
// List my tickets (BROTHER/SISTER only — admins use /admin/list)
router.get('/my', (0, auth_1.default)(user_1.USER_ROLES.USER), support_ticket_controller_1.SupportTicketController.getMyTickets);
// Reply to a ticket (any participant — ownership / admin checked in service)
router.post('/:ticketId/reply', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, fileHandler_1.fileHandler)(ATTACHMENT_FIELDS, FILE_OPTS), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.replyTicketZodSchema), support_ticket_controller_1.SupportTicketController.replyToTicket);
// Paginated message list for a single ticket
router.get('/:ticketId/messages', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.ticketIdParamSchema), support_ticket_controller_1.SupportTicketController.getTicketMessages);
// Single ticket detail (no messages — paginated separately)
router.get('/:ticketId', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(support_ticket_validation_1.SupportTicketValidation.ticketIdParamSchema), support_ticket_controller_1.SupportTicketController.getTicketById);
exports.SupportTicketRoutes = router;
