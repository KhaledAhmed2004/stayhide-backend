"use strict";
/**
 * Email Channel - EmailBuilder Integration
 *
 * Sends email notifications using the EmailBuilder.
 * Templates must exist in EmailBuilder/templates/.
 */
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
exports.sendEmail = void 0;
const EmailBuilder_1 = require("../../EmailBuilder");
/**
 * Send email notifications via EmailBuilder
 */
const sendEmail = (users, content) => __awaiter(void 0, void 0, void 0, function* () {
    const result = { sent: 0, failed: [] };
    for (const user of users) {
        // Skip users without email
        if (!user.email) {
            continue;
        }
        try {
            // Merge user data with variables
            const variables = Object.assign(Object.assign({}, content.variables), { name: user.name || 'User', email: user.email, userId: user._id.toString() });
            // Build email using EmailBuilder
            const builder = new EmailBuilder_1.EmailBuilder();
            // Set theme if specified
            if (content.theme) {
                builder.setTheme(content.theme);
            }
            // Try to use template, fall back to manual if template doesn't exist
            try {
                builder.useTemplate(content.template, variables);
            }
            catch (templateError) {
                // Template doesn't exist in EmailBuilder, create simple email
                console.warn(`EmailBuilder template "${content.template}" not found, using fallback`);
                builder
                    .setSubject(content.subject)
                    .setVariables(variables)
                    .addComponent('header', { title: content.subject })
                    .addText(variables.message || variables.text || 'You have a new notification.')
                    .addComponent('footer');
            }
            const { html, subject } = builder.build();
            // Send email
            yield EmailBuilder_1.EmailBuilder.send({
                to: user.email,
                subject: content.subject || subject,
                html,
            });
            result.sent++;
        }
        catch (error) {
            console.error(`Email send error for user ${user._id}:`, error);
            result.failed.push(user._id.toString());
        }
    }
    return result;
});
exports.sendEmail = sendEmail;
exports.default = exports.sendEmail;
