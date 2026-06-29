import { Schema, model } from 'mongoose';
import {
  ISupportTicket,
  ITicketMessage,
  SupportTicketModel,
  TicketMessageModel,
  TICKET_ATTACHMENT_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SENDER_TYPES,
  TICKET_STATUSES,
} from './support-ticket.interface';

const AttachmentSchema = new Schema(
  {
    type: { type: String, enum: TICKET_ATTACHMENT_TYPES, required: true },
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number },
    mime: { type: String },
  },
  { _id: false },
);

const supportTicketSchema = new Schema<ISupportTicket, SupportTicketModel>(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'OTHER', required: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'OPEN', required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'MEDIUM', required: true },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastReplyAt: { type: Date, default: Date.now, required: true },
    lastReplyBy: { type: String, enum: TICKET_SENDER_TYPES, default: 'USER', required: true },
    messagesCount: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

supportTicketSchema.index({ userId: 1, status: 1, lastReplyAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, lastReplyAt: -1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ assignedAdminId: 1 }, { sparse: true });
supportTicketSchema.index({ subject: 'text', ticketNumber: 'text' });

export const SupportTicket = model<ISupportTicket, SupportTicketModel>(
  'SupportTicket',
  supportTicketSchema,
);

const ticketMessageSchema = new Schema<ITicketMessage, TicketMessageModel>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
    },
    senderType: { type: String, enum: TICKET_SENDER_TYPES, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true },
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });
ticketMessageSchema.index({ ticketId: 1, senderType: 1 });

export const TicketMessage = model<ITicketMessage, TicketMessageModel>(
  'TicketMessage',
  ticketMessageSchema,
);
