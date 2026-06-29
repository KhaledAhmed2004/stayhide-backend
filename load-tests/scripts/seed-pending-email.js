/**
 * seed-pending-email.js — Load test fixture generator for Pending-Email module
 *
 * Usage: node load-tests/scripts/seed-pending-email.js
 * Requires: MONGODB_URI (or DATABASE_URL) in environment.
 *
 * Creates:
 *   - 5 pending email records with varying kinds and statuses
 *
 * Writes:
 *   - Module fixtures (pendingEmails) → modules/pending-email/fixtures/pending-email-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed pending email data before seeding.
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
const MODULE_NAME = 'pending-email';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { PendingEmail } = require('../../src/app/modules/pending-email/pending-email.model');

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
    await mongoose.disconnect();
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  console.log(`[seed-${MODULE_NAME}] Loaded base fixtures.`);

  // ── Step 3: Idempotent cleanup ──────────────────────────────────────────────
  await PendingEmail.deleteMany({ to: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleaned up previous seed data.`);

  // ── Step 4: Create 5 pending email records ──────────────────────────────────
  const emailConfigs = [
    { kind: 'registration_otp', status: 'PENDING', maxAttempts: 4 },
    { kind: 'forgot_password_otp', status: 'PENDING', maxAttempts: 4 },
    { kind: 'email_change_otp', status: 'PROCESSING', maxAttempts: 4 },
    { kind: 'email_change_notification', status: 'PENDING', maxAttempts: 6 },
    { kind: 'account_rejected_reverify', status: 'DEAD', maxAttempts: 6 },
  ];

  const pendingEmails = [];
  for (let i = 0; i < emailConfigs.length; i++) {
    const config = emailConfigs[i];
    const recipientEmail = `loadtest-pending-email-${i}@test.com`;

    const emailData = {
      kind: config.kind,
      to: recipientEmail,
      subject: `loadtest-${config.kind}-subject-${i}`,
      html: `<p>Load test email ${i} - kind: ${config.kind}</p>`,
      status: config.status,
      attempts: config.status === 'DEAD' ? config.maxAttempts : (config.status === 'PROCESSING' ? 1 : 0),
      maxAttempts: config.maxAttempts,
      nextAttemptAt: new Date(),
      lastError: config.status === 'DEAD' ? 'loadtest-simulated-failure: max attempts exceeded' : null,
      workerId: config.status === 'PROCESSING' ? 'loadtest-worker-1' : null,
      leaseExpiresAt: config.status === 'PROCESSING' ? new Date(Date.now() + 180 * 1000) : null,
    };

    const pendingEmail = await PendingEmail.create(emailData);
    pendingEmails.push(pendingEmail);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${pendingEmails.length} pending email records.`);

  // ── Step 5: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    pendingEmails: pendingEmails.map(e => ({
      id: e._id.toString(),
      to: e.to,
      subject: e.subject,
      status: e.status,
    })),
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  await mongoose.disconnect();
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${pendingEmails.length} pending email records`);
  console.log(`  - Kinds: ${emailConfigs.map(c => c.kind).join(', ')}`);
  console.log(`  - Statuses: ${emailConfigs.map(c => c.status).join(', ')}`);
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
