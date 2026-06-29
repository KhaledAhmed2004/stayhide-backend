"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.SupportTicketService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importStar(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_1 = require("../../../enums/user");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const support_ticket_model_1 = require("./support-ticket.model");
const support_ticket_utils_1 = require("./support-ticket.utils");
const ADMIN_TICKETS_ROOM = 'admin-tickets';
const isAdminRole = (role) => role === user_1.USER_ROLES.ADMIN;
const senderTypeFromRole = (role) => isAdminRole(role) ? 'ADMIN' : 'USER';
const ticketRoom = (ticketId) => `ticket::${ticketId}`;
const userRoom = (userId) => `user::${userId}`;
const emit = (event, rooms, payload) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = global.io;
    if (!io)
        return;
    for (const room of rooms) {
        io.to(room).emit(event, payload);
    }
};
const assertTicketAccess = (ticket, requester) => {
    if (isAdminRole(requester.role))
        return;
    if (String(ticket.userId) !== String(requester.id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You do not have access to this ticket');
    }
};
const findTicketOrThrow = (ticketId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(ticketId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid ticketId');
    }
    const ticket = yield support_ticket_model_1.SupportTicket.findById(ticketId);
    if (!ticket) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Ticket not found');
    }
    return ticket.toObject();
});
const createTicket = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const ticketNumber = yield (0, support_ticket_utils_1.generateTicketNumber)();
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const [created] = yield support_ticket_model_1.SupportTicket.create([
            {
                ticketNumber,
                userId: new mongoose_1.Types.ObjectId(input.userId),
                subject: input.subject,
                category: input.category,
                priority: input.priority || 'MEDIUM',
                status: 'OPEN',
                lastReplyAt: new Date(),
                lastReplyBy: 'USER',
                messagesCount: 1,
            },
        ], { session });
        const [firstMessage] = yield support_ticket_model_1.TicketMessage.create([
            {
                ticketId: created._id,
                senderType: 'USER',
                senderId: new mongoose_1.Types.ObjectId(input.userId),
                message: input.message,
                attachments: input.attachments,
            },
        ], { session });
        yield session.commitTransaction();
        const ticketObj = created.toObject();
        const messageObj = firstMessage.toObject();
        emit('TICKET_CREATED', [userRoom(input.userId), ADMIN_TICKETS_ROOM], { ticket: ticketObj, message: messageObj });
        return { ticket: ticketObj, firstMessage: messageObj };
    }
    catch (err) {
        yield session.abortTransaction();
        throw err;
    }
    finally {
        session.endSession();
    }
});
const replyToTicket = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketOrThrow(input.ticketId);
    assertTicketAccess(ticket, input.requester);
    const senderType = senderTypeFromRole(input.requester.role);
    // Compute the next status from the reply, then apply the update with a
    // single atomic findOneAndUpdate so we don't race against another writer.
    let nextStatus = ticket.status;
    if (senderType === 'USER') {
        if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
            nextStatus = 'REOPENED';
        }
    }
    else if (senderType === 'ADMIN') {
        if (ticket.status === 'OPEN' || ticket.status === 'REOPENED') {
            nextStatus = 'IN_PROGRESS';
        }
    }
    const message = yield support_ticket_model_1.TicketMessage.create({
        ticketId: ticket._id,
        senderType,
        senderId: new mongoose_1.Types.ObjectId(input.requester.id),
        message: input.message,
        attachments: input.attachments,
    });
    const update = {
        status: nextStatus,
        lastReplyAt: new Date(),
        lastReplyBy: senderType,
        $inc: { messagesCount: 1 },
    };
    if (senderType === 'ADMIN' && !ticket.assignedAdminId) {
        update.assignedAdminId = new mongoose_1.Types.ObjectId(input.requester.id);
    }
    const updated = yield support_ticket_model_1.SupportTicket.findByIdAndUpdate(ticket._id, update, { new: true });
    const ticketObj = updated.toObject();
    const messageObj = message.toObject();
    emit('TICKET_REPLY', [
        ticketRoom(String(ticket._id)),
        userRoom(String(ticket.userId)),
        ADMIN_TICKETS_ROOM,
    ], { ticket: ticketObj, message: messageObj });
    if (nextStatus !== ticket.status) {
        emit('TICKET_STATUS_CHANGED', [ticketRoom(String(ticket._id)), userRoom(String(ticket.userId))], {
            ticketId: String(ticket._id),
            from: ticket.status,
            to: nextStatus,
        });
    }
    return { ticket: ticketObj, message: messageObj };
});
const getMyTickets = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const builder = new QueryBuilder_1.default(support_ticket_model_1.SupportTicket.find({ userId: new mongoose_1.Types.ObjectId(userId) }), query)
        .search(['subject', 'ticketNumber'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield builder.modelQuery.lean();
    const pagination = yield builder.getPaginationInfo();
    return { data, pagination };
});
const getAllTickets = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const builder = new QueryBuilder_1.default(support_ticket_model_1.SupportTicket.find().populate('userId', 'name email profileImage'), query)
        .search(['subject', 'ticketNumber'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield builder.modelQuery;
    const pagination = yield builder.getPaginationInfo();
    return { data, pagination };
});
const getTicketById = (ticketId, requester) => __awaiter(void 0, void 0, void 0, function* () {
    // Authorize against the raw (un-populated) ticket so the ObjectId
    // comparison in assertTicketAccess is reliable. Populated documents
    // turn `userId` into an object, which breaks String(...) equality.
    const ticket = yield findTicketOrThrow(ticketId);
    assertTicketAccess(ticket, requester);
    const detailed = yield support_ticket_model_1.SupportTicket.findById(ticketId)
        .populate('userId', 'name email profileImage')
        .populate('assignedAdminId', 'name email profileImage')
        .lean();
    return detailed;
});
const getTicketMessages = (ticketId, query, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketOrThrow(ticketId);
    assertTicketAccess(ticket, requester);
    // Default to chronological order (oldest first) for ticket threads,
    // overridable via ?sort=
    const querySort = query.sort ? query : Object.assign(Object.assign({}, query), { sort: 'createdAt' });
    const builder = new QueryBuilder_1.default(support_ticket_model_1.TicketMessage.find({ ticketId: ticket._id }).populate('senderId', 'name email profileImage role'), querySort)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield builder.modelQuery;
    const pagination = yield builder.getPaginationInfo();
    return { data, pagination };
});
const updateTicketStatus = (ticketId, nextStatus, adminId) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketOrThrow(ticketId);
    if (!(0, support_ticket_utils_1.isValidStatusTransition)(ticket.status, nextStatus)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid status transition from ${ticket.status} to ${nextStatus}`);
    }
    const update = { status: nextStatus };
    if (!ticket.assignedAdminId) {
        update.assignedAdminId = new mongoose_1.Types.ObjectId(adminId);
    }
    const updated = yield support_ticket_model_1.SupportTicket.findByIdAndUpdate(ticket._id, update, {
        new: true,
    });
    const ticketObj = updated.toObject();
    emit('TICKET_STATUS_CHANGED', [
        ticketRoom(String(ticket._id)),
        userRoom(String(ticket.userId)),
        ADMIN_TICKETS_ROOM,
    ], { ticketId: String(ticket._id), from: ticket.status, to: nextStatus });
    return ticketObj;
});
const updateTicketPriority = (ticketId, priority) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketOrThrow(ticketId);
    const updated = yield support_ticket_model_1.SupportTicket.findByIdAndUpdate(ticket._id, { priority }, { new: true });
    const ticketObj = updated.toObject();
    emit('TICKET_PRIORITY_CHANGED', [ticketRoom(String(ticket._id)), ADMIN_TICKETS_ROOM], {
        ticketId: String(ticket._id),
        from: ticket.priority,
        to: priority,
    });
    return ticketObj;
});
const assignTicket = (ticketId, adminId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(adminId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid adminId');
    }
    const ticket = yield findTicketOrThrow(ticketId);
    const updated = yield support_ticket_model_1.SupportTicket.findByIdAndUpdate(ticket._id, { assignedAdminId: new mongoose_1.Types.ObjectId(adminId) }, { new: true });
    return updated.toObject();
});
const getTicketStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const [byStatus, byPriority, byCategory, total] = yield Promise.all([
        support_ticket_model_1.SupportTicket.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        support_ticket_model_1.SupportTicket.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        support_ticket_model_1.SupportTicket.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ]),
        support_ticket_model_1.SupportTicket.countDocuments(),
    ]);
    const reshape = (rows) => rows.reduce((acc, r) => {
        acc[r._id] = r.count;
        return acc;
    }, {});
    return {
        total,
        byStatus: reshape(byStatus),
        byPriority: reshape(byPriority),
        byCategory: reshape(byCategory),
    };
});
exports.SupportTicketService = {
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
