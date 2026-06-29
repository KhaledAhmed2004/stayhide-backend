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

import { Types } from 'mongoose';
import { User } from '../../modules/user/user.model';
import * as templates from './templates';
import { sendPush } from './channels/push.channel';
import { sendSocket } from './channels/socket.channel';
import { sendEmail } from './channels/email.channel';
import { saveToDatabase } from './channels/database.channel';
import ScheduledNotification from './scheduler/ScheduledNotification.model';

// ==================== INTERFACES ====================

// Must stay in sync with `NOTIFICATION_TYPES` in
// `src/app/modules/notification/notification.interface.ts` — that list is
// enforced at the schema level, so any value here that isn't in the enum
// will be rejected at insert time.
export type NotificationType =
  | 'ADMIN'
  | 'SYSTEM'
  // ── Connection events ──────────────────────────────────────────────────────
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  // ── Messaging events ───────────────────────────────────────────────────────
  | 'NEW_MESSAGE'
  // ── Community events ───────────────────────────────────────────────────────
  | 'QUESTION_ANSWERED'
  | 'NEW_QUESTION'
  | 'POST_LIKED'
  | 'POST_COMMENTED'
  | 'COMMENT_REPLIED'
  | 'CONTENT_LIKED'
  | 'CONTENT_COMMENTED'
  | 'NEW_CONTENT'
  | 'NEW_KHUTBAH'
  | 'MOSQUE_UPDATE';

export interface INotificationTemplate {
  name: string;
  push?: {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    data?: Record<string, string>;
  };
  socket?: {
    event: string;
    data?: Record<string, any>;
  };
  email?: {
    template: string;
    subject: string;
    theme?: string;
  };
  database?: {
    type: NotificationType;
    title?: string;
    text: string;
  };
}

export interface INotificationContent {
  title?: string;
  text?: string;
  type?: NotificationType;
  // Polymorphic reference — links the notification to a source entity.
  // Both fields are set together via `.setResource(type, id)`.
  resourceType?: string;
  resourceId?: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
}

export interface INotificationResult {
  success: boolean;
  sent: {
    push: number;
    socket: number;
    email: number;
    database: number;
  };
  failed: {
    push: string[];
    socket: string[];
    email: string[];
    database: string[];
  };
  scheduled?: string;
}

export interface INotificationBuilderOptions {
  defaultChannels?: ('push' | 'socket' | 'email' | 'database')[];
  throwOnError?: boolean;
}

interface IDeviceTokenEntry {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  lastSeenAt?: Date;
}

interface IUser {
  _id: Types.ObjectId;
  email?: string;
  deviceTokens?: IDeviceTokenEntry[];
  role?: string;
  name?: string;
}

// ==================== TEMPLATE REGISTRY ====================

const templateRegistry: Map<string, INotificationTemplate> = new Map();

// Initialize built-in templates
Object.entries(templates).forEach(([name, template]) => {
  if (typeof template === 'object' && 'name' in template) {
    templateRegistry.set(template.name, template as INotificationTemplate);
  }
});

// ==================== NOTIFICATION BUILDER CLASS ====================

export class NotificationBuilder {
  // Recipients
  private userIds: string[] = [];
  private excludeIds: string[] = [];
  private targetRole?: string;

  // Content
  private template?: INotificationTemplate;
  private variables: Record<string, any> = {};
  private content: INotificationContent = {};

  // Channels
  private channels: Set<'push' | 'socket' | 'email' | 'database'> = new Set();

  // Scheduling
  private scheduledFor?: Date;

  // Options
  private options: INotificationBuilderOptions;

  // ==================== STATIC METHODS ====================

  /**
   * Register a custom notification template
   */
  static registerTemplate(name: string, template: INotificationTemplate): void {
    templateRegistry.set(name, template);
  }

  /**
   * Get a registered template
   */
  static getTemplate(name: string): INotificationTemplate | undefined {
    return templateRegistry.get(name);
  }

  /**
   * List all registered templates
   */
  static listTemplates(): string[] {
    return Array.from(templateRegistry.keys());
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelScheduled(scheduledId: string): Promise<boolean> {
    const result = await ScheduledNotification.updateOne(
      { _id: scheduledId, status: 'pending' },
      { status: 'cancelled' }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Get pending scheduled notifications
   */
  static async getPending(userId?: string): Promise<any[]> {
    const query: any = { status: 'pending' };
    if (userId) {
      query.recipients = userId;
    }
    return ScheduledNotification.find(query).sort({ scheduledFor: 1 });
  }

  // ==================== CONSTRUCTOR ====================

  constructor(options?: INotificationBuilderOptions) {
    this.options = {
      defaultChannels: [],
      throwOnError: false,
      ...options,
    };

    // Apply default channels
    this.options.defaultChannels?.forEach(channel => {
      this.channels.add(channel);
    });
  }

  // ==================== RECIPIENT METHODS ====================

  /**
   * Set single recipient by ID or User object
   */
  to(recipient: string | Types.ObjectId | IUser): this {
    if (typeof recipient === 'string') {
      this.userIds = [recipient];
    } else if (recipient instanceof Types.ObjectId) {
      this.userIds = [recipient.toString()];
    } else {
      this.userIds = [recipient._id.toString()];
    }
    return this;
  }

  /**
   * Set multiple recipients
   */
  toMany(recipients: (string | Types.ObjectId)[]): this {
    this.userIds = recipients.map(r =>
      typeof r === 'string' ? r : r.toString()
    );
    return this;
  }

  /**
   * Target all users with a specific role
   */
  toRole(role: string): this {
    this.targetRole = role;
    return this;
  }

  /**
   * Exclude specific users (use with toMany or toRole)
   */
  except(userIds: (string | Types.ObjectId)[]): this {
    this.excludeIds = userIds.map(id =>
      typeof id === 'string' ? id : id.toString()
    );
    return this;
  }

  // ==================== CONTENT METHODS ====================

  /**
   * Use a pre-built or custom template
   */
  useTemplate(templateName: string, variables?: Record<string, any>): this {
    const template = templateRegistry.get(templateName);
    if (!template) {
      throw new Error(
        `Template "${templateName}" not found. Available: ${Array.from(templateRegistry.keys()).join(', ')}`
      );
    }
    this.template = template;
    if (variables) {
      this.variables = { ...this.variables, ...variables };
    }
    return this;
  }

  /**
   * Set notification title (manual content)
   */
  setTitle(title: string): this {
    this.content.title = title;
    return this;
  }

  /**
   * Set notification text/body (manual content)
   */
  setText(text: string): this {
    this.content.text = text;
    return this;
  }

  /**
   * Set notification type
   */
  setType(type: NotificationType): this {
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
  setResource(resourceType: string, resourceId: string | Types.ObjectId): this {
    this.content.resourceType = resourceType;
    this.content.resourceId =
      typeof resourceId === 'string' ? resourceId : resourceId.toString();
    return this;
  }

  /**
   * Set extra data payload
   */
  setData(data: Record<string, any>): this {
    this.content.data = { ...this.content.data, ...data };
    return this;
  }

  /**
   * Set push notification icon
   */
  setIcon(iconUrl: string): this {
    this.content.icon = iconUrl;
    return this;
  }

  /**
   * Set push notification image
   */
  setImage(imageUrl: string): this {
    this.content.image = imageUrl;
    return this;
  }

  // ==================== CHANNEL METHODS ====================

  /**
   * Enable Firebase Push notifications
   */
  viaPush(): this {
    this.channels.add('push');
    return this;
  }

  /**
   * Enable Socket.IO real-time notifications
   */
  viaSocket(): this {
    this.channels.add('socket');
    return this;
  }

  /**
   * Enable Email notifications (via EmailBuilder)
   */
  viaEmail(): this {
    this.channels.add('email');
    return this;
  }

  /**
   * Enable Database persistence
   */
  viaDatabase(): this {
    this.channels.add('database');
    return this;
  }

  /**
   * Enable ALL channels (push + socket + email + database)
   */
  viaAll(): this {
    this.channels.add('push');
    this.channels.add('socket');
    this.channels.add('email');
    this.channels.add('database');
    return this;
  }

  /**
   * Enable real-time only (push + socket)
   */
  viaRealtime(): this {
    this.channels.add('push');
    this.channels.add('socket');
    return this;
  }

  /**
   * Conditionally enable push
   */
  viaPushIf(condition: boolean): this {
    if (condition) this.channels.add('push');
    return this;
  }

  /**
   * Conditionally enable email
   */
  viaEmailIf(condition: boolean): this {
    if (condition) this.channels.add('email');
    return this;
  }

  /**
   * Conditionally enable socket
   */
  viaSocketIf(condition: boolean): this {
    if (condition) this.channels.add('socket');
    return this;
  }

  /**
   * Conditionally enable database
   */
  viaDatabaseIf(condition: boolean): this {
    if (condition) this.channels.add('database');
    return this;
  }

  // ==================== SCHEDULING METHODS ====================

  /**
   * Schedule notification for a specific date/time
   */
  schedule(date: Date): this {
    this.scheduledFor = date;
    return this;
  }

  /**
   * Schedule notification after a duration
   * @param duration - Format: '5m', '2h', '1d', '1w'
   */
  scheduleAfter(duration: string): this {
    const match = duration.match(/^(\d+)(m|h|d|w)$/);
    if (!match) {
      throw new Error(
        'Invalid duration format. Use: 5m (minutes), 2h (hours), 1d (days), 1w (weeks)'
      );
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
  async sendNow(): Promise<INotificationResult> {
    // Resolve users
    const users = await this.resolveUsers();

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
    const result: INotificationResult = {
      success: true,
      sent: { push: 0, socket: 0, email: 0, database: 0 },
      failed: { push: [], socket: [], email: [], database: [] },
    };

    // Push channel
    if (this.channels.has('push')) {
      try {
        const pushResult = await sendPush(users, {
          title: resolvedContent.push.title,
          body: resolvedContent.push.body,
          icon: resolvedContent.push.icon,
          image: resolvedContent.push.image,
          data: resolvedContent.push.data,
        });
        result.sent.push = pushResult.sent;
        result.failed.push = pushResult.failed;
      } catch (error) {
        console.error('Push channel error:', error);
        result.failed.push = users.map((u: any) => u._id.toString());
      }
    }

    // Socket channel
    if (this.channels.has('socket')) {
      try {
        const socketResult = await sendSocket(users, {
          event: resolvedContent.socket.event,
          data: resolvedContent.socket.data,
        });
        result.sent.socket = socketResult.sent;
        result.failed.socket = socketResult.failed;
      } catch (error) {
        console.error('Socket channel error:', error);
        result.failed.socket = users.map((u: any) => u._id.toString());
      }
    }

    // Email channel
    if (this.channels.has('email')) {
      try {
        const emailResult = await sendEmail(users, {
          template: resolvedContent.email.template,
          subject: resolvedContent.email.subject,
          theme: resolvedContent.email.theme,
          variables: this.variables,
        });
        result.sent.email = emailResult.sent;
        result.failed.email = emailResult.failed;
      } catch (error) {
        console.error('Email channel error:', error);
        result.failed.email = users.map((u: any) => u._id.toString());
      }
    }

    // Database channel
    if (this.channels.has('database')) {
      try {
        const dbResult = await saveToDatabase(users, {
          title: resolvedContent.database.title,
          text: resolvedContent.database.text,
          type: resolvedContent.database.type,
          resourceType: this.content.resourceType,
          resourceId: this.content.resourceId,
        });
        result.sent.database = dbResult.sent;
        result.failed.database = dbResult.failed;
      } catch (error) {
        console.error('Database channel error:', error);
        result.failed.database = users.map((u: any) => u._id.toString());
      }
    }

    // Check overall success
    const totalFailed =
      result.failed.push.length +
      result.failed.socket.length +
      result.failed.email.length +
      result.failed.database.length;

    result.success = totalFailed === 0;

    return result;
  }

  /**
   * Send notification (respects scheduling if set)
   */
  async send(): Promise<INotificationResult> {
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
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Resolve user IDs to User documents
   */
  private async resolveUsers(): Promise<IUser[]> {
    let query: any = {};

    if (this.targetRole) {
      query.role = this.targetRole;
    } else if (this.userIds.length > 0) {
      query._id = { $in: this.userIds };
    } else {
      return [];
    }

    // Exclude specific users
    if (this.excludeIds.length > 0) {
      query._id = { ...query._id, $nin: this.excludeIds };
    }

    const users = await User.find(query).select('_id email role name').lean();
    return users as IUser[];
  }

  /**
   * Resolve content from template + variables + manual content
   */
  private resolveContent(): {
    push: { title: string; body: string; icon?: string; image?: string; data?: Record<string, string> };
    socket: { event: string; data: Record<string, any> };
    email: { template: string; subject: string; theme?: string };
    database: { title?: string; text: string; type: NotificationType };
  } {
    const interpolate = (str: string, vars: Record<string, any>): string => {
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
      data: this.content.data as Record<string, string> | undefined,
    };

    let socket = {
      event: 'NOTIFICATION',
      data: { ...this.content.data, message: this.content.text },
    };

    let email = {
      template: 'notification',
      subject: this.content.title || 'Notification',
      theme: 'default',
    };

    let database = {
      title: this.content.title,
      text: this.content.text || '',
      type: this.content.type || ('SYSTEM' as NotificationType),
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
            ? Object.fromEntries(
                Object.entries(this.template.push.data).map(([k, v]) => [
                  k,
                  interpolate(v, this.variables),
                ])
              )
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
  private async saveScheduled(): Promise<INotificationResult> {
    // Resolve user IDs (not full documents, just IDs)
    let recipientIds: string[] = [];

    if (this.targetRole) {
      const users = await User.find({ role: this.targetRole }).select('_id').lean();
      recipientIds = users.map((u: any) => u._id.toString());
    } else {
      recipientIds = this.userIds;
    }

    // Exclude
    if (this.excludeIds.length > 0) {
      recipientIds = recipientIds.filter(id => !this.excludeIds.includes(id));
    }

    // Save to scheduled collection
    const scheduled = await ScheduledNotification.create({
      recipients: recipientIds,
      template: this.template?.name,
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
      scheduled: (scheduled._id as any).toString(),
    };
  }
}

export default NotificationBuilder;
