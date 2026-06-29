"use strict";
/**
 * Notification Scheduler Service
 *
 * Background job that processes scheduled notifications.
 * Uses setInterval as fallback, or node-cron if installed.
 *
 * @usage
 * // In server.ts, after MongoDB connection
 * import { NotificationScheduler } from '@/app/builder/NotificationBuilder/scheduler';
 * NotificationScheduler.start();
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationScheduler = void 0;
const ScheduledNotification_model_1 = __importDefault(require("./ScheduledNotification.model"));
const NotificationBuilder_1 = require("../NotificationBuilder");
const logger_1 = require("../../../../shared/logger");
// Try to load node-cron if available
let cron = null;
try {
    cron = require('node-cron');
}
catch (e) {
    // node-cron not installed
}
class NotificationScheduler {
    static start() {
        if (this.cronJob || this.intervalId) {
            console.warn('Notification scheduler already started');
            return;
        }
        if (cron) {
            this.cronJob = cron.schedule('* * * * *', () => __awaiter(this, void 0, void 0, function* () {
                yield this.processScheduled();
            }));
            console.log('Notification scheduler started with node-cron');
        }
        else {
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.processScheduled();
            }), 60000);
            console.log('Notification scheduler started with setInterval');
        }
        logger_1.logger.info('Notification scheduler started');
    }
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger_1.logger.info('Notification scheduler stopped');
    }
    static processScheduled() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning)
                return 0;
            this.isRunning = true;
            let processedCount = 0;
            try {
                const now = new Date();
                const query = { scheduledFor: { $lte: now }, status: 'pending' };
                const dueNotifications = yield ScheduledNotification_model_1.default.find(query)
                    .limit(100)
                    .sort({ scheduledFor: 1 });
                for (const scheduled of dueNotifications) {
                    try {
                        yield this.processSingle(scheduled);
                        processedCount++;
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to process scheduled notification', error);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Notification scheduler error:', error);
            }
            finally {
                this.isRunning = false;
            }
            return processedCount;
        });
    }
    static processSingle(scheduled) {
        return __awaiter(this, void 0, void 0, function* () {
            scheduled.status = 'processing';
            yield scheduled.save();
            try {
                let builder = new NotificationBuilder_1.NotificationBuilder();
                builder = builder.toMany(scheduled.recipients.map(id => id.toString()));
                if (scheduled.template) {
                    builder = builder.useTemplate(scheduled.template, scheduled.variables || {});
                }
                else {
                    if (scheduled.title)
                        builder = builder.setTitle(scheduled.title);
                    if (scheduled.text)
                        builder = builder.setText(scheduled.text);
                    if (scheduled.type)
                        builder = builder.setType(scheduled.type);
                    if (scheduled.resourceType && scheduled.resourceId) {
                        builder = builder.setResource(scheduled.resourceType, scheduled.resourceId);
                    }
                    if (scheduled.data)
                        builder = builder.setData(scheduled.data);
                }
                for (const channel of scheduled.channels) {
                    switch (channel) {
                        case 'push':
                            builder = builder.viaPush();
                            break;
                        case 'socket':
                            builder = builder.viaSocket();
                            break;
                        case 'email':
                            builder = builder.viaEmail();
                            break;
                        case 'database':
                            builder = builder.viaDatabase();
                            break;
                    }
                }
                const result = yield builder.sendNow();
                scheduled.status = 'sent';
                scheduled.result = { sent: result.sent, failed: result.failed, processedAt: new Date() };
                yield scheduled.save();
            }
            catch (error) {
                scheduled.status = 'failed';
                scheduled.result = { error: error.message, processedAt: new Date() };
                yield scheduled.save();
                throw error;
            }
        });
    }
    static cancel(scheduledId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield ScheduledNotification_model_1.default.updateOne({ _id: scheduledId, status: 'pending' }, { status: 'cancelled' });
            return result.modifiedCount > 0;
        });
    }
    static getPending(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { status: 'pending' };
            if (userId)
                query.recipients = userId;
            return ScheduledNotification_model_1.default.find(query).sort({ scheduledFor: 1 }).lean();
        });
    }
    static getById(scheduledId) {
        return __awaiter(this, void 0, void 0, function* () {
            return ScheduledNotification_model_1.default.findById(scheduledId).lean();
        });
    }
    static cleanup() {
        return __awaiter(this, arguments, void 0, function* (daysOld = 30) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const result = yield ScheduledNotification_model_1.default.deleteMany({
                status: { $in: ['sent', 'failed', 'cancelled'] },
                updatedAt: { $lt: cutoffDate },
            });
            return result.deletedCount;
        });
    }
}
exports.NotificationScheduler = NotificationScheduler;
NotificationScheduler.isRunning = false;
NotificationScheduler.cronJob = null;
NotificationScheduler.intervalId = null;
exports.default = NotificationScheduler;
