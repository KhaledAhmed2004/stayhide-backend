/**
 * seed-connections.js — Load test fixture generator for Connections module
 *
 * Usage: node load-tests/scripts/seed-connections.js
 * Requires: MONGODB_URI (or DATABASE_URL) in environment.
 *
 * Creates:
 *   - 10 PENDING connection requests between brother users
 *   - 5 ACCEPTED connections between brother users
 *   - 5 PENDING connection requests between sister users
 *   - 3 ACCEPTED connections between sister users
 *
 * Writes:
 *   - Module fixtures (pendingRequests, existingConnections) → modules/connections/fixtures/connections-fixtures.json
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Idempotent: deletes all prior load-test connection data before seeding.
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
const MODULE_NAME = 'connections';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { Connection } = require('../../src/app/modules/connection/connection.model');
const { User } = require('../../src/app/modules/user/user.model');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic connectionKey matching the application logic.
 * Sorts the two user IDs lexicographically and joins with underscore.
 */
function generateConnectionKey(userA, userB) {
  const user1 = userA < userB ? userA : userB;
  const user2 = userA < userB ? userB : userA;
  return `${user1}_${user2}`;
}

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] ERROR: No MongoDB URI found.`);
    console.error(`[seed-${MODULE_NAME}] Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI in your environment.`);
    process.exit(1);
  }

  console.log(`[seed-${MODULE_NAME}] Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected.`);

  // ── Step 2: Read shared base fixtures ───────────────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] ERROR: Base fixtures not found at ${BASE_FIXTURES_PATH}`);
    console.error(`[seed-${MODULE_NAME}] Run seed-groups.js first to create shared users.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  const { brotherUsers, sisterUsers } = baseFixtures;

  console.log(`[seed-${MODULE_NAME}] Loaded ${brotherUsers.length} brother users and ${sisterUsers.length} sister users from base fixtures.`);

  // ── Step 3: Idempotent cleanup ──────────────────────────────────────────────
  // Delete all connections involving loadtest users
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test connection data...`);
  const loadTestUserIds = await User.find({ email: { $regex: /^loadtest-/ } }).distinct('_id');
  await Connection.deleteMany({
    $or: [
      { sender: { $in: loadTestUserIds } },
      { receiver: { $in: loadTestUserIds } },
    ],
  });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete.`);

  // ── Step 4: Create pending connection requests between brother users ────────
  // Use pairs: brother[0]→brother[1], brother[2]→brother[3], ..., brother[18]→brother[19]
  console.log(`[seed-${MODULE_NAME}] Creating pending connection requests (brothers)...`);
  const pendingRequests = [];

  for (let i = 0; i < 20; i += 2) {
    if (i + 1 >= brotherUsers.length) break;
    const sender = brotherUsers[i];
    const receiver = brotherUsers[i + 1];
    const connectionKey = generateConnectionKey(sender.id, receiver.id);

    const connection = await Connection.create({
      sender: sender.id,
      receiver: receiver.id,
      connectionKey,
      status: 'PENDING',
    });

    pendingRequests.push({
      requestId: connection._id.toString(),
      senderId: sender.id,
      receiverId: receiver.id,
    });
  }
  console.log(`[seed-${MODULE_NAME}] Created ${pendingRequests.length} pending requests (brothers).`);

  // ── Step 5: Create pending connection requests between sister users ─────────
  // Use pairs: sister[0]→sister[1], sister[2]→sister[3], ..., sister[8]→sister[9]
  console.log(`[seed-${MODULE_NAME}] Creating pending connection requests (sisters)...`);
  for (let i = 0; i < 10; i += 2) {
    if (i + 1 >= sisterUsers.length) break;
    const sender = sisterUsers[i];
    const receiver = sisterUsers[i + 1];
    const connectionKey = generateConnectionKey(sender.id, receiver.id);

    const connection = await Connection.create({
      sender: sender.id,
      receiver: receiver.id,
      connectionKey,
      status: 'PENDING',
    });

    pendingRequests.push({
      requestId: connection._id.toString(),
      senderId: sender.id,
      receiverId: receiver.id,
    });
  }
  console.log(`[seed-${MODULE_NAME}] Total pending requests: ${pendingRequests.length}.`);

  // ── Step 6: Create accepted connections between brother users ────────────────
  // Use pairs: brother[20]↔brother[21], brother[22]↔brother[23], ..., brother[28]↔brother[29]
  console.log(`[seed-${MODULE_NAME}] Creating accepted connections (brothers)...`);
  const existingConnections = [];

  for (let i = 20; i < 30; i += 2) {
    if (i + 1 >= brotherUsers.length) break;
    const userA = brotherUsers[i];
    const userB = brotherUsers[i + 1];
    const connectionKey = generateConnectionKey(userA.id, userB.id);

    await Connection.create({
      sender: userA.id,
      receiver: userB.id,
      connectionKey,
      status: 'ACCEPTED',
      respondedAt: new Date(),
    });

    existingConnections.push({
      userId1: userA.id,
      userId2: userB.id,
    });
  }
  console.log(`[seed-${MODULE_NAME}] Created ${existingConnections.length} accepted connections (brothers).`);

  // ── Step 7: Create accepted connections between sister users ─────────────────
  // Use pairs: sister[10]↔sister[11], sister[12]↔sister[13], sister[14]↔sister[15]
  console.log(`[seed-${MODULE_NAME}] Creating accepted connections (sisters)...`);
  for (let i = 10; i < 16; i += 2) {
    if (i + 1 >= sisterUsers.length) break;
    const userA = sisterUsers[i];
    const userB = sisterUsers[i + 1];
    const connectionKey = generateConnectionKey(userA.id, userB.id);

    await Connection.create({
      sender: userA.id,
      receiver: userB.id,
      connectionKey,
      status: 'ACCEPTED',
      respondedAt: new Date(),
    });

    existingConnections.push({
      userId1: userA.id,
      userId2: userB.id,
    });
  }
  console.log(`[seed-${MODULE_NAME}] Total accepted connections: ${existingConnections.length}.`);

  // ── Step 8: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    pendingRequests,
    existingConnections,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Module fixtures written to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${pendingRequests.length} pending connection requests`);
  console.log(`  - ${existingConnections.length} accepted connections`);
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
seed()
  .then(() => {
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
