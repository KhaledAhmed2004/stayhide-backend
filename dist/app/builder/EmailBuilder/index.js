"use strict";
/**
 * EmailBuilder - Main Export
 *
 * A chainable email builder for creating beautiful, responsive emails.
 *
 * @example Basic Usage
 * ```typescript
 * import { EmailBuilder } from '@/app/builder/EmailBuilder';
 *
 * // Using a pre-built template
 * const { html, subject } = new EmailBuilder()
 *   .setTheme('default')
 *   .useTemplate('welcome', { name: 'John', otp: '123456' })
 *   .build();
 *
 * // Send directly
 * await EmailBuilder.send({ to: 'user@example.com', subject, html });
 * ```
 *
 * @example Custom Email with Components
 * ```typescript
 * const { html } = new EmailBuilder()
 *   .setTheme('default')
 *   .setSubject('Your Order Update')
 *   .addComponent('header', { title: 'Order Shipped!' })
 *   .addText('Your order #12345 has been shipped.')
 *   .addComponent('button', { text: 'Track Order', href: 'https://...' })
 *   .addComponent('footer')
 *   .build();
 * ```
 *
 * @example Registering Custom Theme
 * ```typescript
 * EmailBuilder.registerTheme('corporate', {
 *   name: 'corporate',
 *   colors: { primary: '#003366', ... },
 *   ...
 * });
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplates = exports.emailComponents = exports.darkTheme = exports.defaultTheme = exports.default = exports.EmailBuilder = void 0;
// Main class export
var EmailBuilder_1 = require("./EmailBuilder");
Object.defineProperty(exports, "EmailBuilder", { enumerable: true, get: function () { return EmailBuilder_1.EmailBuilder; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(EmailBuilder_1).default; } });
// Theme exports (for reference/extension)
var default_1 = require("./themes/default");
Object.defineProperty(exports, "defaultTheme", { enumerable: true, get: function () { return default_1.defaultTheme; } });
var dark_1 = require("./themes/dark");
Object.defineProperty(exports, "darkTheme", { enumerable: true, get: function () { return dark_1.darkTheme; } });
// Component exports (for direct use if needed)
exports.emailComponents = __importStar(require("./components"));
// Template exports (for reference)
exports.emailTemplates = __importStar(require("./templates"));
