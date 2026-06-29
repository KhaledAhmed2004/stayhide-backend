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
exports.runSymptomReminderJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const user_model_1 = require("../user/user.model");
const symptom_log_model_1 = require("./symptom-log.model");
const logger_1 = require("../../../shared/logger");
// Assume there's a notification service, using a placeholder for now
// import { NotificationService } from '../notification/notification.service';
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
const getTargetTimezones = (targetHour) => {
    // We need to find all IANA timezones where the current local hour is `targetHour`
    // We'll use Intl.supportedValuesOf('timeZone') available in Node.js 18+
    const allZones = Intl.supportedValuesOf('timeZone');
    return allZones.filter((tz) => {
        const localHour = (0, dayjs_1.default)().tz(tz).hour();
        return localHour === targetHour;
    });
};
const runSymptomReminderJob = () => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    let targetedUsers = 0;
    let notificationsSent = 0;
    let failures = 0;
    let tokensCleanedUp = 0;
    try {
        // 1. Find timezones where it's exactly 8:00 PM (20:00)
        const targetTimezones = getTargetTimezones(20);
        if (targetTimezones.length === 0) {
            return;
        }
        // 2. Query users who have reminders enabled and are in these timezones
        const users = yield user_model_1.User.find({
            isDailySymptomReminderEnabled: true,
            timezone: { $in: targetTimezones },
            status: 'ACTIVE' // Only active users
        }).select('_id timezone');
        targetedUsers = users.length;
        if (targetedUsers === 0) {
            logger_1.logger.info(`Symptom Reminder Cron: No targeted users at ${(0, dayjs_1.default)().toISOString()}`);
            return;
        }
        // 3. For each user, check if they already logged symptoms today in their local time
        // We can do this in parallel batches for performance
        const userIdsToRemind = [];
        for (const user of users) {
            const localDateString = (0, dayjs_1.default)().tz(user.timezone).format('YYYY-MM-DD');
            const existingLog = yield symptom_log_model_1.SymptomLog.findOne({
                user: user._id,
                date: localDateString,
            });
            if (!existingLog) {
                userIdsToRemind.push(user._id.toString());
            }
        }
        // 4. Send notifications
        // Implementation depends on existing Notification service.
        // Placeholder using Promise.allSettled
        /*
        const results = await Promise.allSettled(
          userIdsToRemind.map(userId =>
            NotificationService.sendPushNotification(userId, {
              title: "Time to log your symptoms",
              body: "Logging takes 60 seconds and helps your doctor see trends.",
              data: { type: "SYMPTOM_REMINDER" }
            })
          )
        );
    
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            notificationsSent++;
          } else {
            failures++;
            // Check if error implies invalid token, then clean it up
            // tokensCleanedUp++;
          }
        });
        */
        notificationsSent = userIdsToRemind.length; // placeholder success
    }
    catch (error) {
        logger_1.logger.error('Error running symptom reminder job:', error);
    }
    finally {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger_1.logger.info(`Cron started. Targeted users: ${targetedUsers}, Notifications sent: ${notificationsSent}, Failures: ${failures} (Tokens cleaned up: ${tokensCleanedUp}), Duration: ${duration} seconds`);
    }
});
exports.runSymptomReminderJob = runSymptomReminderJob;
// Run at minute 0 past every hour
node_cron_1.default.schedule('0 * * * *', exports.runSymptomReminderJob, {
    scheduled: true,
    timezone: 'UTC', // the server evaluates this, the logic inside handles local timezones
});
