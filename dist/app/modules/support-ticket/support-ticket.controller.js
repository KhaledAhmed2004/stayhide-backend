"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const support_ticket_service_1 = require("./support-ticket.service");
const support_ticket_utils_1 = require("./support-ticket.utils");
const createTicket = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { subject, category, priority, message } = req.body;
    const attachments = (0, support_ticket_utils_1.buildAttachmentsFromBody)(req.body.attachments);
    const result = yield support_ticket_service_1.SupportTicketService.createTicket({
        userId: user.id,
        subject,
        category,
        priority,
        message,
        attachments,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Ticket created successfully',
        data: result,
    });
}));
const replyToTicket = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { ticketId } = req.params;
    const { message } = req.body;
    const attachments = (0, support_ticket_utils_1.buildAttachmentsFromBody)(req.body.attachments);
    const result = yield support_ticket_service_1.SupportTicketService.replyToTicket({
        ticketId,
        requester: { id: user.id, role: user.role },
        message,
        attachments,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Reply sent successfully',
        data: result,
    });
}));
const getMyTickets = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield support_ticket_service_1.SupportTicketService.getMyTickets(user.id, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'My tickets fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getAllTickets = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield support_ticket_service_1.SupportTicketService.getAllTickets(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Tickets fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getTicketById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { ticketId } = req.params;
    const ticket = yield support_ticket_service_1.SupportTicketService.getTicketById(ticketId, {
        id: user.id,
        role: user.role,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket fetched successfully',
        data: ticket,
    });
}));
const getTicketMessages = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { ticketId } = req.params;
    const result = yield support_ticket_service_1.SupportTicketService.getTicketMessages(ticketId, req.query, { id: user.id, role: user.role });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket messages fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const updateTicketStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { ticketId } = req.params;
    const { status } = req.body;
    const ticket = yield support_ticket_service_1.SupportTicketService.updateTicketStatus(ticketId, status, user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket status updated successfully',
        data: ticket,
    });
}));
const updateTicketPriority = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ticketId } = req.params;
    const { priority } = req.body;
    const ticket = yield support_ticket_service_1.SupportTicketService.updateTicketPriority(ticketId, priority);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket priority updated successfully',
        data: ticket,
    });
}));
const assignTicket = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { ticketId } = req.params;
    const { adminId } = (req.body || {});
    const ticket = yield support_ticket_service_1.SupportTicketService.assignTicket(ticketId, adminId || user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket assigned successfully',
        data: ticket,
    });
}));
const getTicketStats = (0, catchAsync_1.default)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = yield support_ticket_service_1.SupportTicketService.getTicketStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Ticket stats fetched successfully',
        data: stats,
    });
}));
exports.SupportTicketController = {
    createTicket,
    replyToTicket,
    getMyTickets,
    getAllTickets,
    getTicketById,
    getTicketMessages,
    updateTicketStatus,
    updateTicketPriority,
    assignTicket,
    getTicketStats,
};
