"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_ATTACHMENT_TYPES = exports.TICKET_SENDER_TYPES = exports.TICKET_CATEGORIES = exports.TICKET_PRIORITIES = exports.TICKET_STATUSES = void 0;
exports.TICKET_STATUSES = [
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
];
exports.TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
exports.TICKET_CATEGORIES = [
    'BILLING',
    'ACCOUNT',
    'BUG',
    'FEATURE',
    'OTHER',
];
exports.TICKET_SENDER_TYPES = ['USER', 'ADMIN'];
exports.TICKET_ATTACHMENT_TYPES = ['image', 'audio', 'video', 'file'];
