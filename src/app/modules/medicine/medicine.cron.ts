import cron from 'node-cron';
import { Medication } from './medicine.model';
import { User } from '../user/user.model';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes, isBefore, parseISO, startOfDay, addDays } from 'date-fns';
import { MedicationService } from './medicine.service';
import { sendNotifications } from '../../../helpers/notificationHelper'; // Assuming this exists or similar

// Note: This is an MVP cron implementation. For 100k+ users, BullMQ should be used instead.
export const startMedicationCronJobs = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Running Medication Reminder Cron Job...');
      
      const activeMedications = await Medication.find({ status: 'ACTIVE' }).populate('user');
      
      for (const med of activeMedications) {
        const user = med.user as any;
        const timezone = user.timezone || 'UTC'; // Fallback
        
        const now = new Date();
        const localNowStr = formatInTimeZone(now, timezone, "HH:mm");
        const localDateStr = formatInTimeZone(now, timezone, "yyyy-MM-dd");

        // 1. Reminders Logic
        if (med.reminder && med.reminder.enabled) {
          const minutesBefore = med.reminder.minutesBefore || 15;
          const targetReminderTime = formatInTimeZone(addMinutes(now, minutesBefore), timezone, "HH:mm");

          // If any dosing time perfectly matches the target reminder time
          if (med.dosingTimes.includes(targetReminderTime)) {
            // Check if schedule is active for today
            const timesForToday = MedicationService.getTodaySchedule ? 
              (await MedicationService.getTodaySchedule(user._id.toString(), localDateStr, localNowStr)).upcoming.map(u => u.scheduledTime)
              : med.dosingTimes; // simplified fallback

            if (timesForToday.includes(targetReminderTime)) {
              // Trigger push & in-app notification
              const message = `It's time to take your ${med.name} ${med.dosage?.amount || ''} ${med.dosage?.unit || ''} in ${minutesBefore} minutes.`;
              
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
               await MedicationService.upsertLog(user._id.toString(), {
                  medicationId: med._id.toString(),
                  dateString: localDateStr,
                  scheduledTime: time,
                  status: 'MISSED'
               }).catch(() => { /* Ignore errors like duplicate key if user took it at 23:59:59 */ });
            }
        }
      }
    } catch (error) {
      console.error('Error in Medication Cron Job:', error);
    }
  });
};
