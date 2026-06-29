import { logger } from '../../../shared/logger';
import config from '../../../config';
import admin from 'firebase-admin';

// Decode Base64 Firebase service account
const serviceAccountJson = Buffer.from(
  config.firebase_api_key_base64!, // the Base64 string from .env
  'base64'
).toString('utf8');

// Parse it as JSON
const serviceAccount: admin.ServiceAccount = JSON.parse(serviceAccountJson);

// Initialize Firebase SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Multiple users
const sendPushNotifications = async (
  values: admin.messaging.MulticastMessage
) => {
  const res = await admin.messaging().sendEachForMulticast(values);
  logger.info('Notifications sent successfully', res);
};

// Single user
const sendPushNotification = async (values: admin.messaging.Message) => {
  const res = await admin.messaging().send(values);
  logger.info('Notification sent successfully', res);
};

export const pushNotificationHelper = {
  sendPushNotifications,
  sendPushNotification,
};
