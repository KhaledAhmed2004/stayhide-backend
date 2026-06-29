"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserEnterprise = exports.isUserPremium = exports.getUserEntitlement = void 0;
const mongoose_1 = require("mongoose");
const subscription_model_1 = require("../subscription.model");
const subscription_interface_1 = require("../subscription.interface");
// Status values that grant the user their paid entitlement.
// PAST_DUE is included so users in the Apple/Google billing-retry grace
// period keep their access — this matches the industry standard.
const ACTIVE_STATUSES = new Set([
    subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
    subscription_interface_1.SUBSCRIPTION_STATUS.TRIALING,
    subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE,
]);
const getUserEntitlement = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const sub = yield subscription_model_1.Subscription.findByUser(new mongoose_1.Types.ObjectId(userId));
    if (!sub) {
        return {
            plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
            status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
            isActive: true,
            isPremium: false,
            isEnterprise: false,
        };
    }
    // Temporal consistency check: if the period end is in the past but status
    // is still ACTIVE, a lifecycle webhook (EXPIRED / GRACE_PERIOD_EXPIRED) was
    // missed — server downtime, Apple/Google outage, etc. We treat the
    // subscription as effectively expired to prevent indefinite free access.
    // PAST_DUE is intentionally exempt: grace period expiry has its own
    // GRACE_PERIOD_EXPIRED event and the user retains access during retries.
    const isExpiredByTime = sub.status === subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE &&
        sub.currentPeriodEnd != null &&
        sub.currentPeriodEnd < new Date();
    const isActive = !isExpiredByTime && ACTIVE_STATUSES.has(sub.status);
    const hasPaidPlan = sub.plan !== subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
    return {
        plan: sub.plan,
        status: sub.status,
        isActive,
        isPremium: isActive && hasPaidPlan,
        isEnterprise: isActive && sub.plan === subscription_interface_1.SUBSCRIPTION_PLAN.ENTERPRISE,
        currentPeriodEnd: sub.currentPeriodEnd,
        gracePeriodEndsAt: sub.gracePeriodEndsAt,
    };
});
exports.getUserEntitlement = getUserEntitlement;
const isUserPremium = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const entitlement = yield (0, exports.getUserEntitlement)(userId);
    return entitlement.isPremium;
});
exports.isUserPremium = isUserPremium;
const isUserEnterprise = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const entitlement = yield (0, exports.getUserEntitlement)(userId);
    return entitlement.isEnterprise;
});
exports.isUserEnterprise = isUserEnterprise;
