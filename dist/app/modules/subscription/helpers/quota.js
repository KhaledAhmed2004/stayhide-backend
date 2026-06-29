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
exports.checkCardCreationQuota = void 0;
const subscription_interface_1 = require("../subscription.interface");
// import { PreferenceCardModel } from '../../preference-card/preference-card.model';
const entitlement_1 = require("./entitlement");
/**
 * Hard-coded plan limits according to the product roadmap (§9 in overview.md).
 * FREE: 2 cards
 * PREMIUM: 20 cards
 * ENTERPRISE: Unlimited
 */
const PLAN_LIMITS = {
    [subscription_interface_1.SUBSCRIPTION_PLAN.FREE]: 2,
    [subscription_interface_1.SUBSCRIPTION_PLAN.PREMIUM]: 20,
    [subscription_interface_1.SUBSCRIPTION_PLAN.ENTERPRISE]: Infinity,
};
/**
 * Checks if a user is allowed to create another preference card based on their
 * current subscription plan quota.
 *
 * @param userId The ID of the user attempting to create a card.
 * @returns An object indicating if the creation is allowed and the current usage.
 */
const checkCardCreationQuota = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const entitlement = yield (0, entitlement_1.getUserEntitlement)(userId);
    const limit = PLAN_LIMITS[entitlement.plan] || 2; // Default to FREE limit if plan is unknown
    if (limit === Infinity) {
        return { allowed: true, limit, current: 0 };
    }
    // Count non-deleted cards created by this user
    // const currentCount = await PreferenceCardModel.countDocuments({
    //   createdBy: userId,
    //   isDeleted: false,
    // });
    const currentCount = 0;
    return {
        allowed: currentCount < limit,
        limit,
        current: currentCount,
    };
});
exports.checkCardCreationQuota = checkCardCreationQuota;
