/**
 * seed-notifications.js — Load test fixture generator for Notifications module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-notifications.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 5 notifications per fixture user (brother + sister users) with mixed types and read states
 *   - 2 broadcast notifications sent to all users
 *
 * Writes:
 *   - Module fixtures (notifications, broadcastIds) → modules/notifications/fixtures/notifications-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed notification data before seeding.
 */

'use strict';

const path = require('path');

// ── Bootstrap TypeScript support ─────────────────────────────────────────────
require('ts-node').register({
  project: path.join(__dirname, '../../tsconfig.json'),
  transpileOnly: true,
});

// ── Env loading ───────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const MODULE_NAME = 'notifications';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Validate required env vars ────────────────────────────────────────────────
const MONGODB_URI =
  process.env.LOAD_TEST_DB ||
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(`[seed-${MODULE_NAME}] ERROR: No MongoDB URI found.`);
  console.error(`[seed-${MODULE_NAME}] Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI in your environment.`);
  process.exit(1);
}

// ── Import Mongoose models (TypeScript via ts-node) ───────────────────────────
const { Notification } = require('../../src/app/modules/notification/notification.model');

// ── Notification type pool for variety ────────────────────────────────────────
const NOTIFICATION_TYPE_POOL = [
  'ADMIN',
  'SYSTEM',
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'NEW_MESSAGE',
];

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log(`[seed-${MODULE_NAME}] Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected.`);

  // ── Step 1: Read shared users from base-fixtures.json ─────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] ERROR: Base fixtures not found at ${BASE_FIXTURES_PATH}`);
    console.error(`[seed-${MODULE_NAME}] Run seed-groups.js first to create shared user fixtures.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  const allUsers = [
    baseFixtures.adminUser,
    ...baseFixtures.brotherUsers,
    ...baseFixtures.sisterUsers,
  ];
  console.log(`[seed-${MODULE_NAME}] Loaded ${allUsers.length} users from base fixtures.`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test notification data...`);
  await Notification.deleteMany({ title: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete.`);

  // ── Step 3: Create notifications for each fixture user ──────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating notifications for fixture users...`);
  const notifications = [];
  const NOTIFICATIONS_PER_USER = 5;

  // Create individual notifications for a subset of users (first 10 brothers + first 5 sisters)
  const targetUsers = [
    ...baseFixtures.brotherUsers.slice(0, 10),
    ...baseFixtures.sisterUsers.slice(0, 5),
  ];

  for (const user of targetUsers) {
    for (let i = 0; i < NOTIFICATIONS_PER_USER; i++) {
      const notificationType = NOTIFICATION_TYPE_POOL[i % NOTIFICATION_TYPE_POOL.length];
      const isRead = i < 2; // First 2 notifications are read, rest are unread

      const notification = await Notification.create({
        receiver: new mongoose.Types.ObjectId(user.id),
        type: notificationType,
        title: `loadtest-notification-${i}`,
        text: `Load test notification ${i} for user ${user.email}`,
        isRead,
        readAt: isRead ? new Date() : null,
        resourceType: 'User',
        resourceId: user.id,
      });

      notifications.push({
        notificationId: notification._id.toString(),
        userId: user.id,
        type: notificationType,
        isRead,
      });
    }
  }
  console.log(`[seed-${MODULE_NAME}] Created ${notifications.length} individual notifications.`);

  // ── Step 4: Create broadcast notifications ──────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating broadcast notifications...`);
  const broadcastIds = [];

  for (let b = 0; b < 2; b++) {
    // A broadcast creates one notification per user (simulate for first 10 users)
    const broadcastReceivers = targetUsers.slice(0, 10);
    const broadcastNotifications = [];

    for (const user of broadcastReceivers) {
      const notification = await Notification.create({
        receiver: new mongoose.Types.ObjectId(user.id),
        type: 'ADMIN',
        title: `loadtest-broadcast-${b}`,
        text: `Load test broadcast message ${b} - Important system announcement`,
        isRead: false,
        readAt: null,
        metadata: { broadcastIndex: b, isBroadcast: true },
      });
      broadcastNotifications.push(notification);
    }

    // Use the first notification's ID as the broadcast reference
    broadcastIds.push(broadcastNotifications[0]._id.toString());
    console.log(`[seed-${MODULE_NAME}] Broadcast ${b}: sent to ${broadcastReceivers.length} users.`);
  }

  // ── Step 5: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    notifications,
    broadcastIds,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  await mongoose.disconnect();
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${notifications.length} individual notifications (${NOTIFICATIONS_PER_USER} per user)`);
  console.log(`  - ${broadcastIds.length} broadcast notifications`);
  console.log(`  - ${targetUsers.length} users received notifications`);
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
