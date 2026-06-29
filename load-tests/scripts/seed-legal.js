/**
 * seed-legal.js — Load test fixture generator for Legal module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-legal.js
 * Requires: MONGODB_URI (or DATABASE_URL) in environment.
 *
 * Creates:
 *   - 5 legal page records with known slugs (terms-of-service, privacy-policy, etc.)
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (pages, knownSlugs) → modules/legal/fixtures/legal-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed legal page data before seeding.
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
const MODULE_NAME = 'legal';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { LegalPage } = require('../../src/app/modules/legal/legal.model');

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] No MongoDB URI found. Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI.`);
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected to database.`);

  // ── Read shared users from base fixtures ────────────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] Base fixtures not found at ${BASE_FIXTURES_PATH}. Run seed-groups.js first.`);
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  console.log(`[seed-${MODULE_NAME}] Loaded base fixtures (admin: ${baseFixtures.adminUser.email}).`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test legal page data...`);
  const deleteResult = await LegalPage.deleteMany({ slug: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${deleteResult.deletedCount} legal pages.`);

  // ── Step 3: Create legal page records ───────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating legal pages...`);

  const legalPagesData = [
    {
      slug: 'loadtest-terms-of-service',
      title: 'Terms of Service',
      content: 'These are the load test terms of service. By using this application, you agree to these terms.',
    },
    {
      slug: 'loadtest-privacy-policy',
      title: 'Privacy Policy',
      content: 'This is the load test privacy policy. We respect your privacy and protect your personal data.',
    },
    {
      slug: 'loadtest-cookie-policy',
      title: 'Cookie Policy',
      content: 'This is the load test cookie policy. We use cookies to improve your experience.',
    },
    {
      slug: 'loadtest-acceptable-use',
      title: 'Acceptable Use Policy',
      content: 'This is the load test acceptable use policy. Please use our services responsibly.',
    },
    {
      slug: 'loadtest-disclaimer',
      title: 'Disclaimer',
      content: 'This is the load test disclaimer. The information provided is for general purposes only.',
    },
  ];

  const pages = await LegalPage.insertMany(legalPagesData);
  console.log(`[seed-${MODULE_NAME}] Created ${pages.length} legal pages.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    pages: pages.map(p => ({
      slug: p.slug,
      title: p.title,
    })),
    knownSlugs: pages.map(p => p.slug),
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${pages.length} legal pages`);
  console.log(`  - Slugs: ${moduleFixtures.knownSlugs.join(', ')}`);
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
