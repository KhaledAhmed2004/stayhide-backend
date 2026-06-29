/**
 * seed-{module-name}.js — Load test fixture generator for {Module Name}
 *
 * Usage: node load-tests/scripts/seed-{module-name}.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * ─── How to adapt for a new module ───────────────────────────────────────────
 * 1. Copy this file to `load-tests/scripts/seed-{module-name}.js`
 * 2. Replace all `{module-name}` placeholders with your module name in kebab-case
 * 3. Update MODULE_NAME constant below
 * 4. Import your Mongoose models in the "Import models" section
 * 5. Add cleanup logic in Step 2 (delete previously seeded data)
 * 6. Add data creation logic in Step 3 (insert test fixtures)
 * 7. Map created data to fixture format in Step 4
 * 8. If your module creates shared users, update Step 5 to merge into base-fixtures.json
 * 9. Register the script in package.json: "load:seed:{module-name}": "node load-tests/scripts/seed-{module-name}.js"
 */

'use strict';

const path = require('path');

require('ts-node').register({ project: path.join(__dirname, '../../tsconfig.json'), transpileOnly: true });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
// Replace '{module-name}' with your actual module name in kebab-case (e.g., 'ask-question', 'auth')
const MODULE_NAME = '{module-name}';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
// Import your Mongoose models here. Example:
// const { YourModel } = require('../../src/app/modules/{module-name}/{module-name}.model');

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  // Attempts multiple environment variable names for flexibility across environments.
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] No MongoDB URI found. Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI.`);
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected to database.`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  // Delete previously seeded data for this module so the script can be re-run safely.
  // Use a naming convention or flag to identify seeded data (e.g., prefix with "loadtest-").
  // Example:
  // await YourModel.deleteMany({ name: /^loadtest-/ });
  // console.log(`[seed-${MODULE_NAME}] Cleaned up previous seed data.`);

  // ── Step 3: Create module-specific data ─────────────────────────────────────
  // Insert the test data your module's load test scenarios need.
  // Example:
  // const items = await YourModel.insertMany([
  //   { name: 'loadtest-item-0', ... },
  //   { name: 'loadtest-item-1', ... },
  // ]);
  // console.log(`[seed-${MODULE_NAME}] Created ${items.length} items.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  // Map the created data into a JSON fixture file that k6 scenarios will load at runtime.
  // The fixture file lives at: modules/{module-name}/fixtures/{module-name}-fixtures.json
  const moduleFixtures = {
    // Map your created data to a serializable format:
    // items: items.map(i => ({ id: i._id.toString(), name: i.name })),
  };
  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Step 5: Merge shared fixtures (if creating new users) ───────────────────
  // Only update base-fixtures.json if this module creates shared user accounts.
  // Most modules should NOT write to base-fixtures.json — they rely on the existing
  // shared users created by seed-groups.js (the reference implementation).
  //
  // If you DO need to add shared users:
  // const existingBase = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  // const updatedBase = {
  //   ...existingBase,
  //   // Add or merge your shared data here
  // };
  // fs.writeFileSync(BASE_FIXTURES_PATH, JSON.stringify(updatedBase, null, 2));
  // console.log(`[seed-${MODULE_NAME}] Updated base fixtures at ${BASE_FIXTURES_PATH}`);

  await mongoose.disconnect();
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

seed().then(() => process.exit(0)).catch(err => {
  console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
