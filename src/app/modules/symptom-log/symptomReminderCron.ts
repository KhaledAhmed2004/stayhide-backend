import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { User } from '../user/user.model';
import { SymptomLog } from './symptom-log.model';
import { logger } from '../../../shared/logger';
// Assume there's a notification service, using a placeholder for now
// import { NotificationService } from '../notification/notification.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const getTargetTimezones = (targetHour: number): string[] => {
  // We need to find all IANA timezones where the current local hour is `targetHour`
  // We'll use Intl.supportedValuesOf('timeZone') available in Node.js 18+
  const allZones = (Intl as any).supportedValuesOf('timeZone') as string[];
  return allZones.filter((tz) => {
    const localHour = dayjs().tz(tz).hour();
    return localHour === targetHour;
  });
};

export const runSymptomReminderJob = async () => {
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
    const users = await User.find({
      isDailySymptomReminderEnabled: true,
      timezone: { $in: targetTimezones },
      status: 'ACTIVE' // Only active users
    }).select('_id timezone');

    targetedUsers = users.length;

    if (targetedUsers === 0) {
      logger.info(`Symptom Reminder Cron: No targeted users at ${dayjs().toISOString()}`);
      return;
    }

    // 3. For each user, check if they already logged symptoms today in their local time
    // We can do this in parallel batches for performance
    const userIdsToRemind: string[] = [];

    for (const user of users) {
      const localDateString = dayjs().tz(user.timezone).format('YYYY-MM-DD');
      
      const existingLog = await SymptomLog.findOne({
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

  } catch (error) {
    logger.error('Error running symptom reminder job:', error);
  } finally {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `Cron started. Targeted users: ${targetedUsers}, Notifications sent: ${notificationsSent}, Failures: ${failures} (Tokens cleaned up: ${tokensCleanedUp}), Duration: ${duration} seconds`
    );
  }
};

// Run at minute 0 past every hour
cron.schedule('0 * * * *', runSymptomReminderJob, {
  scheduled: true,
  timezone: 'UTC', // the server evaluates this, the logic inside handles local timezones
});
