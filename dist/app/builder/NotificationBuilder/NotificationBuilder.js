"use strict";
/**
 * NotificationBuilder - Unified Notification API
 *
 * A chainable builder for sending notifications across multiple channels:
 * - Push (Firebase FCM)
 * - Socket (Socket.IO real-time)
 * - Email (via EmailBuilder)
 * - Database (MongoDB persistence)
 *
 * @example
 * ```typescript
 * await new NotificationBuilder()
 *   .to(userId)
 *   .useTemplate('orderShipped', { orderNumber: '#12345' })
 *   .viaPush()
 *   .viaSocket()
 *   .viaEmail()
 *   .viaDatabase()
 *   .send();
 * ```
 *
 * @see doc/notification-builder-complete-guide-bn.md for full documentation
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
exports.NotificationBuilder = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../../modules/user/user.model");
const templates = __importStar(require("./templates"));
const push_channel_1 = require("./channels/push.channel");
const socket_channel_1 = require("./channels/socket.channel");
const email_channel_1 = require("./channels/email.channel");
const database_channel_1 = require("./channels/database.channel");
const ScheduledNotification_model_1 = __importDefault(require("./scheduler/ScheduledNotification.model"));
// ==================== TEMPLATE REGISTRY ====================
const templateRegistry = new Map();
// Initialize built-in templates
Object.entries(templates).forEach(([name, template]) => {
    if (typeof template === 'object' && 'name' in template) {
        templateRegistry.set(template.name, template);
    }
});
// ==================== NOTIFICATION BUILDER CLASS ====================
class NotificationBuilder {
    // ==================== STATIC METHODS ====================
    /**
     * Register a custom notification template
     */
    static registerTemplate(name, template) {
        templateRegistry.set(name, template);
    }
    /**
     * Get a registered template
     */
    static getTemplate(name) {
        return templateRegistry.get(name);
    }
    /**
     * List all registered templates
     */
    static listTemplates() {
        return Array.from(templateRegistry.keys());
    }
    /**
     * Cancel a scheduled notification
     */
    static cancelScheduled(scheduledId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield ScheduledNotification_model_1.default.updateOne({ _id: scheduledId, status: 'pending' }, { status: 'cancelled' });
            return result.modifiedCount > 0;
        });
    }
    /**
     * Get pending scheduled notifications
     */
    static getPending(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { status: 'pending' };
            if (userId) {
                query.recipients = userId;
            }
            return ScheduledNotification_model_1.default.find(query).sort({ scheduledFor: 1 });
        });
    }
    // ==================== CONSTRUCTOR ====================
    constructor(options) {
        var _a;
        // Recipients
        this.userIds = [];
        this.excludeIds = [];
        this.variables = {};
        this.content = {};
        // Channels
        this.channels = new Set();
        this.options = Object.assign({ defaultChannels: [], throwOnError: false }, options);
        // Apply default channels
        (_a = this.options.defaultChannels) === null || _a === void 0 ? void 0 : _a.forEach(channel => {
            this.channels.add(channel);
        });
    }
    // ==================== RECIPIENT METHODS ====================
    /**
     * Set single recipient by ID or User object
     */
    to(recipient) {
        if (typeof recipient === 'string') {
            this.userIds = [recipient];
        }
        else if (recipient instanceof mongoose_1.Types.ObjectId) {
            this.userIds = [recipient.toString()];
        }
        else {
            this.userIds = [recipient._id.toString()];
        }
        return this;
    }
    /**
     * Set multiple recipients
     */
    toMany(recipients) {
        this.userIds = recipients.map(r => typeof r === 'string' ? r : r.toString());
        return this;
    }
    /**
     * Target all users with a specific role
     */
    toRole(role) {
        this.targetRole = role;
        return this;
    }
    /**
     * Exclude specific users (use with toMany or toRole)
     */
    except(userIds) {
        this.excludeIds = userIds.map(id => typeof id === 'string' ? id : id.toString());
        return this;
    }
    // ==================== CONTENT METHODS ====================
    /**
     * Use a pre-built or custom template
     */
    useTemplate(templateName, variables) {
        const template = templateRegistry.get(templateName);
        if (!template) {
            throw new Error(`Template "${templateName}" not found. Available: ${Array.from(templateRegistry.keys()).join(', ')}`);
        }
        this.template = template;
        if (variables) {
            this.variables = Object.assign(Object.assign({}, this.variables), variables);
        }
        return this;
    }
    /**
     * Set notification title (manual content)
     */
    setTitle(title) {
        this.content.title = title;
        return this;
    }
    /**
     * Set notification text/body (manual content)
     */
    setText(text) {
        this.content.text = text;
        return this;
    }
    /**
     * Set notification type
     */
    setType(type) {
        this.content.type = type;
        return this;
    }
    /**
     * Link this notification to a source entity (polymorphic reference).
     * Replaces the older `setReference(id)` — callers must now pass the
     * `resourceType` tag alongside the id so readers can join back to the
     * correct collection.
     *
     * @example .setResource('Event', eventId)
     */
    setResource(resourceType, resourceId) {
        this.content.resourceType = resourceType;
        this.content.resourceId =
            typeof resourceId === 'string' ? resourceId : resourceId.toString();
        return this;
    }
    /**
     * Set extra data payload
     */
    setData(data) {
        this.content.data = Object.assign(Object.assign({}, this.content.data), data);
        return this;
    }
    /**
     * Set push notification icon
     */
    setIcon(iconUrl) {
        this.content.icon = iconUrl;
        return this;
    }
    /**
     * Set push notification image
     */
    setImage(imageUrl) {
        this.content.image = imageUrl;
        return this;
    }
    // ==================== CHANNEL METHODS ====================
    /**
     * Enable Firebase Push notifications
     */
    viaPush() {
        this.channels.add('push');
        return this;
    }
    /**
     * Enable Socket.IO real-time notifications
     */
    viaSocket() {
        this.channels.add('socket');
        return this;
    }
    /**
     * Enable Email notifications (via EmailBuilder)
     */
    viaEmail() {
        this.channels.add('email');
        return this;
    }
    /**
     * Enable Database persistence
     */
    viaDatabase() {
        this.channels.add('database');
        return this;
    }
    /**
     * Enable ALL channels (push + socket + email + database)
     */
    viaAll() {
        this.channels.add('push');
        this.channels.add('socket');
        this.channels.add('email');
        this.channels.add('database');
        return this;
    }
    /**
     * Enable real-time only (push + socket)
     */
    viaRealtime() {
        this.channels.add('push');
        this.channels.add('socket');
        return this;
    }
    /**
     * Conditionally enable push
     */
    viaPushIf(condition) {
        if (condition)
            this.channels.add('push');
        return this;
    }
    /**
     * Conditionally enable email
     */
    viaEmailIf(condition) {
        if (condition)
            this.channels.add('email');
        return this;
    }
    /**
     * Conditionally enable socket
     */
    viaSocketIf(condition) {
        if (condition)
            this.channels.add('socket');
        return this;
    }
    /**
     * Conditionally enable database
     */
    viaDatabaseIf(condition) {
        if (condition)
            this.channels.add('database');
        return this;
    }
    // ==================== SCHEDULING METHODS ====================
    /**
     * Schedule notification for a specific date/time
     */
    schedule(date) {
        this.scheduledFor = date;
        return this;
    }
    /**
     * Schedule notification after a duration
     * @param duration - Format: '5m', '2h', '1d', '1w'
     */
    scheduleAfter(duration) {
        const match = duration.match(/^(\d+)(m|h|d|w)$/);
        if (!match) {
            throw new Error('Invalid duration format. Use: 5m (minutes), 2h (hours), 1d (days), 1w (weeks)');
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const now = new Date();
        switch (unit) {
            case 'm':
                now.setMinutes(now.getMinutes() + value);
                break;
            case 'h':
                now.setHours(now.getHours() + value);
                break;
            case 'd':
                now.setDate(now.getDate() + value);
                break;
            case 'w':
                now.setDate(now.getDate() + value * 7);
                break;
        }
        this.scheduledFor = now;
        return this;
    }
    // ==================== EXECUTION METHODS ====================
    /**
     * Send notification immediately (bypass scheduling)
     */
    sendNow() {
        return __awaiter(this, void 0, void 0, function* () {
            // Resolve users
            const users = yield this.resolveUsers();
            if (users.length === 0) {
                return {
                    success: true,
                    sent: { push: 0, socket: 0, email: 0, database: 0 },
                    failed: { push: [], socket: [], email: [], database: [] },
                };
            }
            // Resolve content
            const resolvedContent = this.resolveContent();
            // Send to each channel
            const result = {
                success: true,
                sent: { push: 0, socket: 0, email: 0, database: 0 },
                failed: { push: [], socket: [], email: [], database: [] },
            };
            // Push channel
            if (this.channels.has('push')) {
                try {
                    const pushResult = yield (0, push_channel_1.sendPush)(users, {
                        title: resolvedContent.push.title,
                        body: resolvedContent.push.body,
                        icon: resolvedContent.push.icon,
                        image: resolvedContent.push.image,
                        data: resolvedContent.push.data,
                    });
                    result.sent.push = pushResult.sent;
                    result.failed.push = pushResult.failed;
                }
                catch (error) {
                    console.error('Push channel error:', error);
                    result.failed.push = users.map((u) => u._id.toString());
                }
            }
            // Socket channel
            if (this.channels.has('socket')) {
                try {
                    const socketResult = yield (0, socket_channel_1.sendSocket)(users, {
                        event: resolvedContent.socket.event,
                        data: resolvedContent.socket.data,
                    });
                    result.sent.socket = socketResult.sent;
                    result.failed.socket = socketResult.failed;
                }
                catch (error) {
                    console.error('Socket channel error:', error);
                    result.failed.socket = users.map((u) => u._id.toString());
                }
            }
            // Email channel
            if (this.channels.has('email')) {
                try {
                    const emailResult = yield (0, email_channel_1.sendEmail)(users, {
                        template: resolvedContent.email.template,
                        subject: resolvedContent.email.subject,
                        theme: resolvedContent.email.theme,
                        variables: this.variables,
                    });
                    result.sent.email = emailResult.sent;
                    result.failed.email = emailResult.failed;
                }
                catch (error) {
                    console.error('Email channel error:', error);
                    result.failed.email = users.map((u) => u._id.toString());
                }
            }
            // Database channel
            if (this.channels.has('database')) {
                try {
                    const dbResult = yield (0, database_channel_1.saveToDatabase)(users, {
                        title: resolvedContent.database.title,
                        text: resolvedContent.database.text,
                        type: resolvedContent.database.type,
                        resourceType: this.content.resourceType,
                        resourceId: this.content.resourceId,
                    });
                    result.sent.database = dbResult.sent;
                    result.failed.database = dbResult.failed;
                }
                catch (error) {
                    console.error('Database channel error:', error);
                    result.failed.database = users.map((u) => u._id.toString());
                }
            }
            // Check overall success
            const totalFailed = result.failed.push.length +
                result.failed.socket.length +
                result.failed.email.length +
                result.failed.database.length;
            result.success = totalFailed === 0;
            return result;
        });
    }
    /**
     * Send notification (respects scheduling if set)
     */
    send() {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate
            if (this.userIds.length === 0 && !this.targetRole) {
                throw new Error('No recipients specified. Use .to(), .toMany(), or .toRole()');
            }
            if (!this.template && !this.content.text) {
                throw new Error('No content specified. Use .useTemplate() or .setText()');
            }
            if (this.channels.size === 0) {
                throw new Error('No channels specified. Use .viaPush(), .viaSocket(), .viaEmail(), .viaDatabase(), or .viaAll()');
            }
            // If scheduled, save to database and return
            if (this.scheduledFor && this.scheduledFor > new Date()) {
                return this.saveScheduled();
            }
            // Otherwise send immediately
            return this.sendNow();
        });
    }
    // ==================== PRIVATE HELPERS ====================
    /**
     * Resolve user IDs to User documents
     */
    resolveUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            let query = {};
            if (this.targetRole) {
                query.role = this.targetRole;
            }
            else if (this.userIds.length > 0) {
                query._id = { $in: this.userIds };
            }
            else {
                return [];
            }
            // Exclude specific users
            if (this.excludeIds.length > 0) {
                query._id = Object.assign(Object.assign({}, query._id), { $nin: this.excludeIds });
            }
            const users = yield user_model_1.User.find(query).select('_id email role name').lean();
            return users;
        });
    }
    /**
     * Resolve content from template + variables + manual content
     */
    resolveContent() {
        const interpolate = (str, vars) => {
            return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return vars[key] !== undefined ? String(vars[key]) : match;
            });
        };
        // Defaults
        let push = {
            title: this.content.title || 'Notification',
            body: this.content.text || '',
            icon: this.content.icon,
            image: this.content.image,
            data: this.content.data,
        };
        let socket = {
            event: 'NOTIFICATION',
            data: Object.assign(Object.assign({}, this.content.data), { message: this.content.text }),
        };
        let email = {
            template: 'notification',
            subject: this.content.title || 'Notification',
            theme: 'default',
        };
        let database = {
            title: this.content.title,
            text: this.content.text || '',
            type: this.content.type || 'SYSTEM',
        };
        // Override with template
        if (this.template) {
            if (this.template.push) {
                push = {
                    title: interpolate(this.template.push.title, this.variables),
                    body: interpolate(this.template.push.body, this.variables),
                    icon: this.template.push.icon || push.icon,
                    image: this.template.push.image || push.image,
                    data: this.template.push.data
                        ? Object.fromEntries(Object.entries(this.template.push.data).map(([k, v]) => [
                            k,
                            interpolate(v, this.variables),
                        ]))
                        : push.data,
                };
            }
            if (this.template.socket) {
                socket = {
                    event: this.template.socket.event,
                    data: this.template.socket.data
                        ? JSON.parse(interpolate(JSON.stringify(this.template.socket.data), this.variables))
                        : socket.data,
                };
            }
            if (this.template.email) {
                email = {
                    template: this.template.email.template,
                    subject: interpolate(this.template.email.subject, this.variables),
                    theme: this.template.email.theme || 'default',
                };
            }
            if (this.template.database) {
                database = {
                    title: this.template.database.title
                        ? interpolate(this.template.database.title, this.variables)
                        : undefined,
                    text: interpolate(this.template.database.text, this.variables),
                    type: this.template.database.type,
                };
            }
        }
        return { push, socket, email, database };
    }
    /**
     * Save notification for scheduled delivery
     */
    saveScheduled() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Resolve user IDs (not full documents, just IDs)
            let recipientIds = [];
            if (this.targetRole) {
                const users = yield user_model_1.User.find({ role: this.targetRole }).select('_id').lean();
                recipientIds = users.map((u) => u._id.toString());
            }
            else {
                recipientIds = this.userIds;
            }
            // Exclude
            if (this.excludeIds.length > 0) {
                recipientIds = recipientIds.filter(id => !this.excludeIds.includes(id));
            }
            // Save to scheduled collection
            const scheduled = yield ScheduledNotification_model_1.default.create({
                recipients: recipientIds,
                template: (_a = this.template) === null || _a === void 0 ? void 0 : _a.name,
                variables: this.variables,
                title: this.content.title,
                text: this.content.text,
                type: this.content.type,
                resourceType: this.content.resourceType,
                resourceId: this.content.resourceId,
                data: this.content.data,
                channels: Array.from(this.channels),
                scheduledFor: this.scheduledFor,
                status: 'pending',
            });
            return {
                success: true,
                sent: { push: 0, socket: 0, email: 0, database: 0 },
                failed: { push: [], socket: [], email: [], database: [] },
                scheduled: scheduled._id.toString(),
            };
        });
    }
}
exports.NotificationBuilder = NotificationBuilder;
exports.default = NotificationBuilder;
