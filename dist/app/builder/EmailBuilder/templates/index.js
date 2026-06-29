"use strict";
/**
 * Template Exports
 *
 * All email templates are exported from here.
 * To add a new template:
 * 1. Create a new file (e.g., myTemplate.ts)
 * 2. Export it here
 * 3. It will automatically be available in EmailBuilder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notification = exports.invoice = exports.resetPassword = exports.otp = exports.welcome = void 0;
var welcome_1 = require("./welcome");
Object.defineProperty(exports, "welcome", { enumerable: true, get: function () { return welcome_1.welcome; } });
var otp_1 = require("./otp");
Object.defineProperty(exports, "otp", { enumerable: true, get: function () { return otp_1.otpTemplate; } });
var resetPassword_1 = require("./resetPassword");
Object.defineProperty(exports, "resetPassword", { enumerable: true, get: function () { return resetPassword_1.resetPassword; } });
var invoice_1 = require("./invoice");
Object.defineProperty(exports, "invoice", { enumerable: true, get: function () { return invoice_1.invoice; } });
var notification_1 = require("./notification");
Object.defineProperty(exports, "notification", { enumerable: true, get: function () { return notification_1.notification; } });
