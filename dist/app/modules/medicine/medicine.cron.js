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
exports.startMedicationCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const medicine_model_1 = require("./medicine.model");
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
const medicine_service_1 = require("./medicine.service");
// Note: This is an MVP cron implementation. For 100k+ users, BullMQ should be used instead.
const startMedicationCronJobs = () => {
    // Run every minute
    node_cron_1.default.schedule('* * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            console.log('Running Medication Reminder Cron Job...');
            const activeMedications = yield medicine_model_1.Medication.find({ status: 'ACTIVE' }).populate('user');
            for (const med of activeMedications) {
                const user = med.user;
                const timezone = user.timezone || 'UTC'; // Fallback
                const now = new Date();
                const localNowStr = (0, date_fns_tz_1.formatInTimeZone)(now, timezone, "HH:mm");
                const localDateStr = (0, date_fns_tz_1.formatInTimeZone)(now, timezone, "yyyy-MM-dd");
                // 1. Reminders Logic
                if (med.reminder && med.reminder.enabled) {
                    const minutesBefore = med.reminder.minutesBefore || 15;
                    const targetReminderTime = (0, date_fns_tz_1.formatInTimeZone)((0, date_fns_1.addMinutes)(now, minutesBefore), timezone, "HH:mm");
                    // If any dosing time perfectly matches the target reminder time
                    if (med.dosingTimes.includes(targetReminderTime)) {
                        // Check if schedule is active for today
                        const timesForToday = medicine_service_1.MedicationService.getTodaySchedule ?
                            (yield medicine_service_1.MedicationService.getTodaySchedule(user._id.toString(), localDateStr, localNowStr)).upcoming.map(u => u.scheduledTime)
                            : med.dosingTimes; // simplified fallback
                        if (timesForToday.includes(targetReminderTime)) {
                            // Trigger push & in-app notification
                            const message = `It's time to take your ${med.name} ${((_a = med.dosage) === null || _a === void 0 ? void 0 : _a.amount) || ''} ${((_b = med.dosage) === null || _b === void 0 ? void 0 : _b.unit) || ''} in ${minutesBefore} minutes.`;
                            console.log(`[Cron] Sending reminder to ${user.email} for ${med.name}`);
                            // sendNotifications(user._id, 'Medication Reminder', message, 'MEDICATION');
                        }
                    }
                }
                // 2. Grace Period / MISSED Logic
                // Grace Period: End of Day in user's timezone
                // If the current time is 23:59 (11:59 PM) in the user's timezone
                if (localNowStr === '23:59') {
                    // It's the end of the day. Check all doses for today.
                    for (const time of med.dosingTimes) {
                        // Upsert status to MISSED. Upsert log will only insert if it doesn't exist.
                        // Since our upsert logic allows late logging, we can just attempt to mark MISSED.
                        // For production scale, it's better to explicitly check if log exists before upserting.
                        yield medicine_service_1.MedicationService.upsertLog(user._id.toString(), {
                            medicationId: med._id.toString(),
                            dateString: localDateStr,
                            scheduledTime: time,
                            status: 'MISSED'
                        }).catch(() => { });
                    }
                }
            }
        }
        catch (error) {
            console.error('Error in Medication Cron Job:', error);
        }
    }));
};
exports.startMedicationCronJobs = startMedicationCronJobs;
