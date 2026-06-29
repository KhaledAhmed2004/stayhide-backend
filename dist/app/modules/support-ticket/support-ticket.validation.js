"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketValidation = void 0;
const zod_1 = require("zod");
const support_ticket_interface_1 = require("./support-ticket.interface");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const createTicketZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z
            .string({ required_error: 'Subject is required' })
            .trim()
            .min(3, 'Subject must be at least 3 characters')
            .max(200, 'Subject must be at most 200 characters'),
        category: zod_1.z
            .enum(support_ticket_interface_1.TICKET_CATEGORIES, { required_error: 'Category is required' })
            .default('OTHER'),
        priority: zod_1.z.enum(support_ticket_interface_1.TICKET_PRIORITIES).optional(),
        message: zod_1.z
            .string({ required_error: 'Message is required' })
            .trim()
            .min(5, 'Message must be at least 5 characters')
            .max(5000, 'Message must be at most 5000 characters'),
    }),
});
const replyTicketZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        ticketId: zod_1.z
            .string({ required_error: 'ticketId is required' })
            .regex(objectIdRegex, 'Invalid ticketId format'),
    }),
    body: zod_1.z.object({
        message: zod_1.z
            .string({ required_error: 'Message is required' })
            .trim()
            .min(1, 'Message cannot be empty')
            .max(5000, 'Message must be at most 5000 characters'),
    }),
});
const ticketIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        ticketId: zod_1.z
            .string({ required_error: 'ticketId is required' })
            .regex(objectIdRegex, 'Invalid ticketId format'),
    }),
});
const updateStatusZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        ticketId: zod_1.z
            .string({ required_error: 'ticketId is required' })
            .regex(objectIdRegex, 'Invalid ticketId format'),
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(support_ticket_interface_1.TICKET_STATUSES, { required_error: 'status is required' }),
    }),
});
const updatePriorityZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        ticketId: zod_1.z
            .string({ required_error: 'ticketId is required' })
            .regex(objectIdRegex, 'Invalid ticketId format'),
    }),
    body: zod_1.z.object({
        priority: zod_1.z.enum(support_ticket_interface_1.TICKET_PRIORITIES, {
            required_error: 'priority is required',
        }),
    }),
});
const assignTicketZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        ticketId: zod_1.z
            .string({ required_error: 'ticketId is required' })
            .regex(objectIdRegex, 'Invalid ticketId format'),
    }),
    body: zod_1.z.object({
        adminId: zod_1.z
            .string()
            .regex(objectIdRegex, 'Invalid adminId format')
            .optional(),
    }),
});
exports.SupportTicketValidation = {
    createTicketZodSchema,
    replyTicketZodSchema,
    ticketIdParamSchema,
    updateStatusZodSchema,
    updatePriorityZodSchema,
    assignTicketZodSchema,
};
