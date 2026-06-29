"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_EVENT_TYPES = void 0;
/**
 * SubscriptionEvent — append-only audit log for subscription state changes.
 *
 * Why a separate collection?
 *   `subscriptions.userId` is `unique: true`, so `subscriptions` holds only
 *   the *current* state for each user. Every upgrade, downgrade, renewal,
 *   cancel, refund, or status flip overwrites the previous record and loses
 *   history. This collection preserves each transition so refund disputes,
 *   abuse detection, churn analytics, and forensic debugging have something
 *   to read.
 */
exports.SUBSCRIPTION_EVENT_TYPES = [
    'CREATED',
    'UPGRADED',
    'DOWNGRADED',
    'RENEWED',
    'CANCELED',
    'EXPIRED',
    'REFUNDED',
    'GRACE_STARTED',
    'GRACE_RESOLVED',
    'STATUS_CHANGED',
    'PLAN_CHANGED',
];
