"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketMessage = exports.SupportTicket = void 0;
const mongoose_1 = require("mongoose");
const support_ticket_interface_1 = require("./support-ticket.interface");
const AttachmentSchema = new mongoose_1.Schema({
    type: { type: String, enum: support_ticket_interface_1.TICKET_ATTACHMENT_TYPES, required: true },
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number },
    mime: { type: String },
}, { _id: false });
const supportTicketSchema = new mongoose_1.Schema({
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: support_ticket_interface_1.TICKET_CATEGORIES, default: 'OTHER', required: true },
    status: { type: String, enum: support_ticket_interface_1.TICKET_STATUSES, default: 'OPEN', required: true },
    priority: { type: String, enum: support_ticket_interface_1.TICKET_PRIORITIES, default: 'MEDIUM', required: true },
    assignedAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    lastReplyAt: { type: Date, default: Date.now, required: true },
    lastReplyBy: { type: String, enum: support_ticket_interface_1.TICKET_SENDER_TYPES, default: 'USER', required: true },
    messagesCount: { type: Number, default: 0, required: true },
}, { timestamps: true });
supportTicketSchema.index({ userId: 1, status: 1, lastReplyAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, lastReplyAt: -1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ assignedAdminId: 1 }, { sparse: true });
supportTicketSchema.index({ subject: 'text', ticketNumber: 'text' });
exports.SupportTicket = (0, mongoose_1.model)('SupportTicket', supportTicketSchema);
const ticketMessageSchema = new mongoose_1.Schema({
    ticketId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'SupportTicket',
        required: true,
    },
    senderType: { type: String, enum: support_ticket_interface_1.TICKET_SENDER_TYPES, required: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: { type: [AttachmentSchema], default: [] },
}, { timestamps: true });
ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });
ticketMessageSchema.index({ ticketId: 1, senderType: 1 });
exports.TicketMessage = (0, mongoose_1.model)('TicketMessage', ticketMessageSchema);
