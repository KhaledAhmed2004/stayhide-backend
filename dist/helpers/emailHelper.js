"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailHelper = exports.enqueue = void 0;
const pending_email_service_1 = require("../app/modules/pending-email/pending-email.service");
const enqueue = (template, opts) => (0, pending_email_service_1.enqueueAndTrySend)(template, opts);
exports.enqueue = enqueue;
exports.emailHelper = {
    /**
     * Enqueue an email for durable delivery.
     * Returns `{ id, status }`. Never throws.
     */
    enqueue: exports.enqueue,
};
