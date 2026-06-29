import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from './support-ticket.interface';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createTicketZodSchema = z.object({
  body: z.object({
    subject: z
      .string({ required_error: 'Subject is required' })
      .trim()
      .min(3, 'Subject must be at least 3 characters')
      .max(200, 'Subject must be at most 200 characters'),
    category: z
      .enum(TICKET_CATEGORIES, { required_error: 'Category is required' })
      .default('OTHER'),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(5, 'Message must be at least 5 characters')
      .max(5000, 'Message must be at most 5000 characters'),
  }),
});

const replyTicketZodSchema = z.object({
  params: z.object({
    ticketId: z
      .string({ required_error: 'ticketId is required' })
      .regex(objectIdRegex, 'Invalid ticketId format'),
  }),
  body: z.object({
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(5000, 'Message must be at most 5000 characters'),
  }),
});

const ticketIdParamSchema = z.object({
  params: z.object({
    ticketId: z
      .string({ required_error: 'ticketId is required' })
      .regex(objectIdRegex, 'Invalid ticketId format'),
  }),
});

const updateStatusZodSchema = z.object({
  params: z.object({
    ticketId: z
      .string({ required_error: 'ticketId is required' })
      .regex(objectIdRegex, 'Invalid ticketId format'),
  }),
  body: z.object({
    status: z.enum(TICKET_STATUSES, { required_error: 'status is required' }),
  }),
});

const updatePriorityZodSchema = z.object({
  params: z.object({
    ticketId: z
      .string({ required_error: 'ticketId is required' })
      .regex(objectIdRegex, 'Invalid ticketId format'),
  }),
  body: z.object({
    priority: z.enum(TICKET_PRIORITIES, {
      required_error: 'priority is required',
    }),
  }),
});

const assignTicketZodSchema = z.object({
  params: z.object({
    ticketId: z
      .string({ required_error: 'ticketId is required' })
      .regex(objectIdRegex, 'Invalid ticketId format'),
  }),
  body: z.object({
    adminId: z
      .string()
      .regex(objectIdRegex, 'Invalid adminId format')
      .optional(),
  }),
});

export const SupportTicketValidation = {
  createTicketZodSchema,
  replyTicketZodSchema,
  ticketIdParamSchema,
  updateStatusZodSchema,
  updatePriorityZodSchema,
  assignTicketZodSchema,
};
