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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const entitlement_1 = require("../modules/subscription/helpers/entitlement");
const subscription_interface_1 = require("../modules/subscription/subscription.interface");
const user_1 = require("../../enums/user");
/**
 * Middleware to enforce subscription plan requirements.
 * Should be used AFTER the auth() middleware.
 *
 * @param requiredPlan The minimum subscription plan required to access the route.
 */
const subscriptionGate = (requiredPlan) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = req.user;
            if (!user) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authentication required');
            }
            // Super admins bypass all subscription gates — they are the builders.
            if (user.role === user_1.USER_ROLES.ADMIN) {
                return next();
            }
            const entitlement = yield (0, entitlement_1.getUserEntitlement)(user.id);
            // 1. Basic status check (block inactive/expired/revoked)
            if (!entitlement.isActive) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, 'Your subscription is inactive. Please subscribe to access this feature.');
            }
            // 2. Plan hierarchy check
            // Hierarchy: FREE < PREMIUM < ENTERPRISE
            if (requiredPlan === subscription_interface_1.SUBSCRIPTION_PLAN.FREE) {
                // Everyone with active status can access FREE features
                return next();
            }
            if (requiredPlan === subscription_interface_1.SUBSCRIPTION_PLAN.PREMIUM) {
                // Premium or Enterprise allowed
                if (entitlement.isPremium || entitlement.isEnterprise) {
                    return next();
                }
            }
            if (requiredPlan === subscription_interface_1.SUBSCRIPTION_PLAN.ENTERPRISE) {
                // Only Enterprise allowed
                if (entitlement.isEnterprise) {
                    return next();
                }
            }
            // If we reach here, the user's plan is insufficient
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, `This feature requires a ${requiredPlan} subscription plan.`);
        }
        catch (error) {
            next(error);
        }
    });
};
exports.default = subscriptionGate;
