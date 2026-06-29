import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { SupportTicketService } from './support-ticket.service';
import { buildAttachmentsFromBody } from './support-ticket.utils';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './support-ticket.interface';

const createTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { subject, category, priority, message } = req.body as {
    subject: string;
    category: TicketCategory;
    priority?: TicketPriority;
    message: string;
  };

  const attachments = buildAttachmentsFromBody(
    (req.body as { attachments?: unknown }).attachments,
  );

  const result = await SupportTicketService.createTicket({
    userId: user.id as string,
    subject,
    category,
    priority,
    message,
    attachments,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Ticket created successfully',
    data: result,
  });
});

const replyToTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { ticketId } = req.params;
  const { message } = req.body as { message: string };

  const attachments = buildAttachmentsFromBody(
    (req.body as { attachments?: unknown }).attachments,
  );

  const result = await SupportTicketService.replyToTicket({
    ticketId,
    requester: { id: user.id as string, role: user.role },
    message,
    attachments,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Reply sent successfully',
    data: result,
  });
});

const getMyTickets = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await SupportTicketService.getMyTickets(
    user.id as string,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'My tickets fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getAllTickets = catchAsync(async (req: Request, res: Response) => {
  const result = await SupportTicketService.getAllTickets(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Tickets fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getTicketById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { ticketId } = req.params;

  const ticket = await SupportTicketService.getTicketById(ticketId, {
    id: user.id as string,
    role: user.role,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket fetched successfully',
    data: ticket,
  });
});

const getTicketMessages = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { ticketId } = req.params;

  const result = await SupportTicketService.getTicketMessages(
    ticketId,
    req.query,
    { id: user.id as string, role: user.role },
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket messages fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const updateTicketStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { ticketId } = req.params;
  const { status } = req.body as { status: TicketStatus };

  const ticket = await SupportTicketService.updateTicketStatus(
    ticketId,
    status,
    user.id as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket status updated successfully',
    data: ticket,
  });
});

const updateTicketPriority = catchAsync(async (req: Request, res: Response) => {
  const { ticketId } = req.params;
  const { priority } = req.body as { priority: TicketPriority };

  const ticket = await SupportTicketService.updateTicketPriority(
    ticketId,
    priority,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket priority updated successfully',
    data: ticket,
  });
});

const assignTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { ticketId } = req.params;
  const { adminId } = (req.body || {}) as { adminId?: string };

  const ticket = await SupportTicketService.assignTicket(
    ticketId,
    adminId || (user.id as string),
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket assigned successfully',
    data: ticket,
  });
});

const getTicketStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await SupportTicketService.getTicketStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Ticket stats fetched successfully',
    data: stats,
  });
});

export const SupportTicketController = {
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
