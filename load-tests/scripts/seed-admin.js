/**
 * seed-admin.js — Load test fixture generator for Admin
 *
 * Usage: node load-tests/scripts/seed-admin.js
 *
 * Unlike other seed scripts, this module does NOT require a database connection.
 * The Admin module only needs the existing admin user from base-fixtures.json.
 * This script reads the shared base fixtures and writes an admin-specific fixture
 * file referencing the admin user for use by admin load test scenarios.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const MODULE_NAME = 'admin';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

function seed() {
  console.log(`[seed-${MODULE_NAME}] Generating fixture data (no database needed).`);

  // ── Step 1: Read base fixtures to get admin user ──────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] Base fixtures not found at ${BASE_FIXTURES_PATH}. Run seed-groups.js first.`);
    process.exit(1);
  }

  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));

  if (!baseFixtures.adminUser || !baseFixtures.adminUser.id || !baseFixtures.adminUser.token) {
    console.error(`[seed-${MODULE_NAME}] Admin user not found or incomplete in base fixtures.`);
    process.exit(1);
  }

  // ── Step 2: Write admin-specific fixtures ─────────────────────────────────────
  const moduleFixtures = {
    adminUserRef: {
      id: baseFixtures.adminUser.id,
      email: baseFixtures.adminUser.email,
      token: baseFixtures.adminUser.token,
    },
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);
  console.log(`[seed-${MODULE_NAME}] Admin user reference: ${baseFixtures.adminUser.email}`);
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

try {
  seed();
  process.exit(0);
} catch (err) {
  console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
  process.exit(1);
}
