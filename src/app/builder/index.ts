/**
 * Builder Module Exports
 *
 * Central export for all builder utilities.
 *
 * @example
 * ```typescript
 * import {
 *   QueryBuilder,
 *   AggregationBuilder,
 *   PDFBuilder,
 *   ExportBuilder,
 *   EmailBuilder
 * } from '@/app/builder';
 * ```
 */

// Query Builders
export { default as QueryBuilder } from './QueryBuilder';
export { default as AggregationBuilder } from './AggregationBuilder';

// Document Builders
export { default as PDFBuilder } from './PDFBuilder';
export { default as ExportBuilder } from './ExportBuilder';

// Communication Builders
export { EmailBuilder } from './EmailBuilder';
export { NotificationBuilder, NotificationScheduler } from './NotificationBuilder';

// Type exports - Email
export type {
  IEmailTheme,
  IEmailComponent,
  IEmailTemplate,
  ISendEmailOptions,
  IEmailAttachment,
} from './EmailBuilder';

// Type exports - Notification
export type {
  INotificationTemplate,
  INotificationContent,
  INotificationResult,
  NotificationType,
} from './NotificationBuilder';
