/**
 * System Alert Notification Template
 *
 * For system-wide announcements and alerts.
 *
 * @variables
 * - title: Alert title
 * - message: Alert message
 * - severity: 'info' | 'warning' | 'error' | 'success'
 * - actionUrl: URL for more info (optional)
 * - actionText: Action button text (optional)
 */

import { INotificationTemplate } from '../NotificationBuilder';

export const systemAlert: INotificationTemplate = {
  name: 'systemAlert',

  push: {
    title: '{{title}}',
    body: '{{message}}',
    data: {
      type: 'SYSTEM_ALERT',
      severity: '{{severity}}',
      action: 'VIEW_ALERT',
    },
  },

  socket: {
    event: 'SYSTEM_ALERT',
    data: {
      type: 'SYSTEM_ALERT',
      title: '{{title}}',
      message: '{{message}}',
      severity: '{{severity}}',
      actionUrl: '{{actionUrl}}',
    },
  },

  // No email for general system alerts
  email: undefined,

  database: {
    type: 'SYSTEM',
    title: '{{title}}',
    text: '{{message}}',
  },
};

export default systemAlert;
