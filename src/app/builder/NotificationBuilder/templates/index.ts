/**
 * Notification Template Exports
 *
 * All notification templates are exported from here.
 * To add a new template:
 * 1. Create a new file (e.g., myTemplate.ts)
 * 2. Export it here
 * 3. It will automatically be available in NotificationBuilder
 */

export { welcome } from './welcome';
export { systemAlert } from './systemAlert';

// Export template type for custom templates
export type { INotificationTemplate } from '../NotificationBuilder';
