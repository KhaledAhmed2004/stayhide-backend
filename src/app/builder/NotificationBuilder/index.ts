/**
 * NotificationBuilder - Main Export
 *
 * A unified notification API for sending notifications across multiple channels.
 *
 * @example Basic Usage
 * ```typescript
 * import { NotificationBuilder } from '@/app/builder/NotificationBuilder';
 *
 * // Using a pre-built template
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
 * @example Send to Multiple Users
 * ```typescript
 * await new NotificationBuilder()
 *   .toMany([user1Id, user2Id])
 *   .useTemplate('systemAlert', { message: 'Scheduled maintenance...' })
 *   .viaAll()
 *   .send();
 * ```
 *
 * @example Scheduled Notification
 * ```typescript
 * await new NotificationBuilder()
 *   .to(userId)
 *   .useTemplate('cartAbandoned', { itemCount: 3 })
 *   .scheduleAfter('2h')  // Send 2 hours from now
 *   .viaPush()
 *   .viaEmail()
 *   .send();
 * ```
 *
 * @example Register Custom Template
 * ```typescript
 * NotificationBuilder.registerTemplate('myTemplate', {
 *   name: 'myTemplate',
 *   push: { title: '{{title}}', body: '{{message}}' },
 *   socket: { event: 'MY_EVENT', data: { ... } },
 *   email: { template: 'myEmailTemplate', subject: '...' },
 *   database: { type: 'SYSTEM', text: '...' }
 * });
 * ```
 *
 * @see doc/notification-builder-complete-guide-bn.md for full documentation
 */

// Main class export
export { NotificationBuilder, default } from './NotificationBuilder';

// Type exports
export type {
  INotificationTemplate,
  INotificationContent,
  INotificationResult,
  INotificationBuilderOptions,
  NotificationType,
} from './NotificationBuilder';

// Scheduler exports
export { NotificationScheduler } from './scheduler';
export { ScheduledNotification } from './scheduler';
export type { IScheduledNotification } from './scheduler';

// Template exports (for reference)
export * as notificationTemplates from './templates';
