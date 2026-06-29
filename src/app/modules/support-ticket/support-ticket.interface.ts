import { Model, Types } from 'mongoose';

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'BILLING',
  'ACCOUNT',
  'BUG',
  'FEATURE',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_SENDER_TYPES = ['USER', 'ADMIN'] as const;
export type SenderType = (typeof TICKET_SENDER_TYPES)[number];

export const TICKET_ATTACHMENT_TYPES = ['image', 'audio', 'video', 'file'] as const;
export type TicketAttachmentType = (typeof TICKET_ATTACHMENT_TYPES)[number];

export type ITicketAttachment = {
  type: TicketAttachmentType;
  url: string;
  name?: string;
  size?: number;
  mime?: string;
};

export type ISupportTicket = {
  _id?: Types.ObjectId;
  ticketNumber: string;
  userId: Types.ObjectId;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAdminId?: Types.ObjectId | null;
  lastReplyAt: Date;
  lastReplyBy: SenderType;
  messagesCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ITicketMessage = {
  _id?: Types.ObjectId;
  ticketId: Types.ObjectId;
  senderType: SenderType;
  senderId: Types.ObjectId;
  message: string;
  attachments?: ITicketAttachment[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type SupportTicketModel = Model<ISupportTicket>;
export type TicketMessageModel = Model<ITicketMessage>;
