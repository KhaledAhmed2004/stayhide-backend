"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnownProductIds = exports.isKnownProductId = exports.mapGoogleProductToPlan = exports.mapAppleProductToPlan = void 0;
const subscription_interface_1 = require("../subscription.interface");
// Explicit product-ID → plan mapping.
//
// This is deliberately NOT a fuzzy string match. Every store-configured
// product ID should appear here exactly. Unknown IDs resolve to FREE so
// verification code can detect and reject them cleanly.
//
// When adding a new subscription product in App Store Connect or Google
// Play Console, add the exact product identifier here.
const PRODUCT_ID_TO_PLAN = {
    // Apple & Google share the same product identifiers by convention.
    // PREMIUM — $5.99/mo, $3.99/mo billed yearly
    premium_monthly: subscription_interface_1.SUBSCRIPTION_PLAN.PREMIUM,
    premium_yearly: subscription_interface_1.SUBSCRIPTION_PLAN.PREMIUM,
    // ENTERPRISE — $9.99/mo, $5.99/mo billed yearly
    enterprise_monthly: subscription_interface_1.SUBSCRIPTION_PLAN.ENTERPRISE,
    enterprise_yearly: subscription_interface_1.SUBSCRIPTION_PLAN.ENTERPRISE,
};
const mapAppleProductToPlan = (productId) => {
    var _a;
    return (_a = PRODUCT_ID_TO_PLAN[productId]) !== null && _a !== void 0 ? _a : subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
};
exports.mapAppleProductToPlan = mapAppleProductToPlan;
const mapGoogleProductToPlan = (productId) => {
    var _a;
    return (_a = PRODUCT_ID_TO_PLAN[productId]) !== null && _a !== void 0 ? _a : subscription_interface_1.SUBSCRIPTION_PLAN.FREE;
};
exports.mapGoogleProductToPlan = mapGoogleProductToPlan;
const isKnownProductId = (productId) => {
    return productId in PRODUCT_ID_TO_PLAN;
};
exports.isKnownProductId = isKnownProductId;
const getKnownProductIds = () => {
    return Object.keys(PRODUCT_ID_TO_PLAN);
};
exports.getKnownProductIds = getKnownProductIds;
