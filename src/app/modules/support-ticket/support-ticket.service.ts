import { StatusCodes } from 'http-status-codes';
import mongoose, { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { USER_ROLES } from '../../../enums/user';
import QueryBuilder from '../../builder/QueryBuilder';
import {
  ISupportTicket,
  ITicketAttachment,
  ITicketMessage,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  SenderType,
} from './support-ticket.interface';
import { SupportTicket, TicketMessage } from './support-ticket.model';
import {
  generateTicketNumber,
  isValidStatusTransition,
} from './support-ticket.utils';

const ADMIN_TICKETS_ROOM = 'admin-tickets';

const isAdminRole = (role: string | undefined): boolean =>
  role === USER_ROLES.ADMIN;

const senderTypeFromRole = (role: string): SenderType =>
  isAdminRole(role) ? 'ADMIN' : 'USER';

const ticketRoom = (ticketId: string) => `ticket::${ticketId}`;
const userRoom = (userId: string) => `user::${userId}`;

const emit = (event: string, rooms: string[], payload: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io = (global as any).io;
  if (!io) return;
  for (const room of rooms) {
    io.to(room).emit(event, payload);
  }
};

const assertTicketAccess = (
  ticket: ISupportTicket,
  requester: { id: string; role: string },
) => {
  if (isAdminRole(requester.role)) return;
  if (String(ticket.userId) !== String(requester.id)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have access to this ticket',
    );
  }
};

const findTicketOrThrow = async (ticketId: string): Promise<ISupportTicket> => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid ticketId');
  }
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Ticket not found');
  }
  return ticket.toObject() as ISupportTicket;
};

type CreateTicketInput = {
  userId: string;
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  message: string;
  attachments: ITicketAttachment[];
};

const createTicket = async (
  input: CreateTicketInput,
): Promise<{ ticket: ISupportTicket; firstMessage: ITicketMessage }> => {
  const ticketNumber = await generateTicketNumber();

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [created] = await SupportTicket.create(
      [
        {
          ticketNumber,
          userId: new Types.ObjectId(input.userId),
          subject: input.subject,
          category: input.category,
          priority: input.priority || 'MEDIUM',
          status: 'OPEN',
          lastReplyAt: new Date(),
          lastReplyBy: 'USER',
          messagesCount: 1,
        },
      ],
      { session },
    );

    const [firstMessage] = await TicketMessage.create(
      [
        {
          ticketId: created._id,
          senderType: 'USER',
          senderId: new Types.ObjectId(input.userId),
          message: input.message,
          attachments: input.attachments,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    const ticketObj = created.toObject() as ISupportTicket;
    const messageObj = firstMessage.toObject() as ITicketMessage;

    emit(
      'TICKET_CREATED',
      [userRoom(input.userId), ADMIN_TICKETS_ROOM],
      { ticket: ticketObj, message: messageObj },
    );

    return { ticket: ticketObj, firstMessage: messageObj };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

type ReplyInput = {
  ticketId: string;
  requester: { id: string; role: string };
  message: string;
  attachments: ITicketAttachment[];
};

const replyToTicket = async (
  input: ReplyInput,
): Promise<{ ticket: ISupportTicket; message: ITicketMessage }> => {
  const ticket = await findTicketOrThrow(input.ticketId);
  assertTicketAccess(ticket, input.requester);

  const senderType: SenderType = senderTypeFromRole(input.requester.role);

  // Compute the next status from the reply, then apply the update with a
  // single atomic findOneAndUpdate so we don't race against another writer.
  let nextStatus: TicketStatus = ticket.status;
  if (senderType === 'USER') {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      nextStatus = 'REOPENED';
    }
  } else if (senderType === 'ADMIN') {
    if (ticket.status === 'OPEN' || ticket.status === 'REOPENED') {
      nextStatus = 'IN_PROGRESS';
    }
  }

  const message = await TicketMessage.create({
    ticketId: ticket._id,
    senderType,
    senderId: new Types.ObjectId(input.requester.id),
    message: input.message,
    attachments: input.attachments,
  });

  const update: Record<string, unknown> = {
    status: nextStatus,
    lastReplyAt: new Date(),
    lastReplyBy: senderType,
    $inc: { messagesCount: 1 },
  };
  if (senderType === 'ADMIN' && !ticket.assignedAdminId) {
    update.assignedAdminId = new Types.ObjectId(input.requester.id);
  }

  const updated = await SupportTicket.findByIdAndUpdate(
    ticket._id,
    update,
    { new: true },
  );

  const ticketObj = updated!.toObject() as ISupportTicket;
  const messageObj = message.toObject() as ITicketMessage;

  emit(
    'TICKET_REPLY',
    [
      ticketRoom(String(ticket._id)),
      userRoom(String(ticket.userId)),
      ADMIN_TICKETS_ROOM,
    ],
    { ticket: ticketObj, message: messageObj },
  );

  if (nextStatus !== ticket.status) {
    emit(
      'TICKET_STATUS_CHANGED',
      [ticketRoom(String(ticket._id)), userRoom(String(ticket.userId))],
      {
        ticketId: String(ticket._id),
        from: ticket.status,
        to: nextStatus,
      },
    );
  }

  return { ticket: ticketObj, message: messageObj };
};

const getMyTickets = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const builder = new QueryBuilder(
    SupportTicket.find({ userId: new Types.ObjectId(userId) }),
    query,
  )
    .search(['subject', 'ticketNumber'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await builder.modelQuery.lean();
  const pagination = await builder.getPaginationInfo();
  return { data, pagination };
};

const getAllTickets = async (query: Record<string, unknown>) => {
  const builder = new QueryBuilder(
    SupportTicket.find().populate('userId', 'name email profileImage'),
    query,
  )
    .search(['subject', 'ticketNumber'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await builder.modelQuery;
  const pagination = await builder.getPaginationInfo();
  return { data, pagination };
};

const getTicketById = async (
  ticketId: string,
  requester: { id: string; role: string },
): Promise<ISupportTicket> => {
  // Authorize against the raw (un-populated) ticket so the ObjectId
  // comparison in assertTicketAccess is reliable. Populated documents
  // turn `userId` into an object, which breaks String(...) equality.
  const ticket = await findTicketOrThrow(ticketId);
  assertTicketAccess(ticket, requester);

  const detailed = await SupportTicket.findById(ticketId)
    .populate('userId', 'name email profileImage')
    .populate('assignedAdminId', 'name email profileImage')
    .lean();

  return detailed as unknown as ISupportTicket;
};

const getTicketMessages = async (
  ticketId: string,
  query: Record<string, unknown>,
  requester: { id: string; role: string },
) => {
  const ticket = await findTicketOrThrow(ticketId);
  assertTicketAccess(ticket, requester);

  // Default to chronological order (oldest first) for ticket threads,
  // overridable via ?sort=
  const querySort = query.sort ? query : { ...query, sort: 'createdAt' };

  const builder = new QueryBuilder(
    TicketMessage.find({ ticketId: ticket._id }).populate(
      'senderId',
      'name email profileImage role',
    ),
    querySort,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await builder.modelQuery;
  const pagination = await builder.getPaginationInfo();
  return { data, pagination };
};

const updateTicketStatus = async (
  ticketId: string,
  nextStatus: TicketStatus,
  adminId: string,
): Promise<ISupportTicket> => {
  const ticket = await findTicketOrThrow(ticketId);
  if (!isValidStatusTransition(ticket.status, nextStatus)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Invalid status transition from ${ticket.status} to ${nextStatus}`,
    );
  }

  const update: Record<string, unknown> = { status: nextStatus };
  if (!ticket.assignedAdminId) {
    update.assignedAdminId = new Types.ObjectId(adminId);
  }

  const updated = await SupportTicket.findByIdAndUpdate(ticket._id, update, {
    new: true,
  });
  const ticketObj = updated!.toObject() as ISupportTicket;

  emit(
    'TICKET_STATUS_CHANGED',
    [
      ticketRoom(String(ticket._id)),
      userRoom(String(ticket.userId)),
      ADMIN_TICKETS_ROOM,
    ],
    { ticketId: String(ticket._id), from: ticket.status, to: nextStatus },
  );

  return ticketObj;
};

const updateTicketPriority = async (
  ticketId: string,
  priority: TicketPriority,
): Promise<ISupportTicket> => {
  const ticket = await findTicketOrThrow(ticketId);
  const updated = await SupportTicket.findByIdAndUpdate(
    ticket._id,
    { priority },
    { new: true },
  );
  const ticketObj = updated!.toObject() as ISupportTicket;

  emit(
    'TICKET_PRIORITY_CHANGED',
    [ticketRoom(String(ticket._id)), ADMIN_TICKETS_ROOM],
    {
      ticketId: String(ticket._id),
      from: ticket.priority,
      to: priority,
    },
  );

  return ticketObj;
};

const assignTicket = async (
  ticketId: string,
  adminId: string,
): Promise<ISupportTicket> => {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid adminId');
  }
  const ticket = await findTicketOrThrow(ticketId);
  const updated = await SupportTicket.findByIdAndUpdate(
    ticket._id,
    { assignedAdminId: new Types.ObjectId(adminId) },
    { new: true },
  );
  return updated!.toObject() as ISupportTicket;
};

const getTicketStats = async () => {
  const [byStatus, byPriority, byCategory, total] = await Promise.all([
    SupportTicket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    SupportTicket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    SupportTicket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    SupportTicket.countDocuments(),
  ]);

  const reshape = (rows: { _id: string; count: number }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {});

  return {
    total,
    byStatus: reshape(byStatus),
    byPriority: reshape(byPriority),
    byCategory: reshape(byCategory),
  };
};

export const SupportTicketService = {
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
