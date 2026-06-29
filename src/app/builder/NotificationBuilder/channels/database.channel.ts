/**
 * Database Channel - MongoDB Notification Storage
 *
 * Persists notifications to the Notification collection.
 * Uses the existing Notification model.
 */

import { Notification } from '../../../modules/notification/notification.model';
import { Types } from 'mongoose';

type NotificationType = string;

interface IUser {
  _id: any;
}

interface DatabaseContent {
  title?: string;
  text: string;
  type: NotificationType;
  // Polymorphic reference — both are stored together so readers can
  // route back to the source entity.
  resourceType?: string;
  resourceId?: string | Types.ObjectId;
}

interface DatabaseResult {
  sent: number;
  failed: string[];
}

/**
 * Save notifications to MongoDB
 */
export const saveToDatabase = async (
  users: IUser[],
  content: DatabaseContent,
): Promise<DatabaseResult> => {
  const result: DatabaseResult = { sent: 0, failed: [] };

  const resolvedResourceId =
    content.resourceId !== undefined && content.resourceId !== null
      ? typeof content.resourceId === 'string'
        ? content.resourceId
        : content.resourceId.toString()
      : undefined;

  // Prepare notification documents
  const notifications = users.map(user => ({
    title: content.title,
    text: content.text,
    receiver: user._id,
    type: content.type || 'SYSTEM',
    resourceType: content.resourceType,
    resourceId: resolvedResourceId,
    isRead: false,
  }));

  try {
    // Bulk insert for efficiency
    const created = await Notification.insertMany(notifications, {
      ordered: false, // Continue on error
    });
    result.sent = created.length;
  } catch (error: any) {
    // Handle partial success in bulk insert
    if (error.insertedDocs) {
      result.sent = error.insertedDocs.length;
      // Remaining are failed
      const insertedIds = new Set(
        error.insertedDocs.map((d: any) => d.receiver.toString()),
      );
      result.failed = users
        .filter(u => !insertedIds.has(u._id.toString()))
        .map(u => u._id.toString());
    } else {
      console.error('Database insert error:', error);
      result.failed = users.map(u => u._id.toString());
    }
  }

  return result;
};

export default saveToDatabase;
