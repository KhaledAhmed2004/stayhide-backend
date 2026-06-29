/**
 * seed-subscription.js — Load test fixture generator for Subscription module
 *
 * Usage: node load-tests/scripts/seed-subscription.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 5 subscription records with varying plan types and statuses
 *
 * Writes:
 *   - Module fixtures (subscriptions, freeUsers) → modules/subscription/fixtures/subscription-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed subscription data before seeding.
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
const MODULE_NAME = 'subscription';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { Subscription } = require('../../src/app/modules/subscription/subscription.model');

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] No MongoDB URI found. Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI.`);
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected to database.`);

  // ── Step 2: Read shared users from base fixtures ────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] Base fixtures not found at ${BASE_FIXTURES_PATH}. Run seed-groups.js first.`);
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  const brotherUsers = baseFixtures.brotherUsers;
  console.log(`[seed-${MODULE_NAME}] Loaded ${brotherUsers.length} brother users from base fixtures.`);

  // ── Step 3: Idempotent cleanup ──────────────────────────────────────────────
  // Delete previously seeded subscription data linked to loadtest users
  const loadTestUserIds = brotherUsers.map(u => new mongoose.Types.ObjectId(u.id));
  await Subscription.deleteMany({ userId: { $in: loadTestUserIds } });
  console.log(`[seed-${MODULE_NAME}] Cleaned up previous seed data.`);

  // ── Step 4: Create 5 subscription records with plan types ───────────────────
  const planConfigs = [
    { plan: 'FREE', status: 'active', platform: undefined },
    { plan: 'PREMIUM', status: 'active', platform: 'apple' },
    { plan: 'PREMIUM', status: 'active', platform: 'google' },
    { plan: 'ENTERPRISE', status: 'active', platform: 'admin' },
    { plan: 'FREE', status: 'inactive', platform: undefined },
  ];

  const subscriptions = [];
  for (let i = 0; i < planConfigs.length; i++) {
    const config = planConfigs[i];
    const user = brotherUsers[i];

    const subData = {
      userId: new mongoose.Types.ObjectId(user.id),
      plan: config.plan,
      status: config.status,
      ...(config.platform && { platform: config.platform }),
      ...(config.plan !== 'FREE' && {
        startedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      }),
    };

    const subscription = await Subscription.create(subData);
    subscriptions.push(subscription);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${subscriptions.length} subscription records.`);

  // ── Step 5: Write module fixtures ───────────────────────────────────────────
  // Identify users with free plans (useful for write-load scenario testing choose/free)
  const freeUsers = subscriptions
    .filter(s => s.plan === 'FREE')
    .map(s => {
      const user = brotherUsers.find(u => u.id === s.userId.toString());
      return user ? { id: user.id, email: user.email, token: user.token } : null;
    })
    .filter(Boolean);

  const moduleFixtures = {
    subscriptions: subscriptions.map(s => ({
      id: s._id.toString(),
      userId: s.userId.toString(),
      plan: s.plan,
      status: s.status,
    })),
    freeUsers,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${subscriptions.length} subscription records`);
  console.log(`  - Plans: ${planConfigs.map(c => c.plan).join(', ')}`);
  console.log(`  - ${freeUsers.length} free users available for write-load testing`);
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
