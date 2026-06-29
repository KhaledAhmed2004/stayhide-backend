/**
 * seed-dua.js — Load test fixture generator for Dua module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-dua.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 10 dua records with categories (waqt) covering all prayer times
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (duas) → modules/dua/fixtures/dua-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed dua data before seeding.
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
const MODULE_NAME = 'dua';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const DuaModel = require('../../src/app/modules/dua/dua.model').default;

// ── Dua seed data ─────────────────────────────────────────────────────────────
const WAQT_VALUES = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

const DUA_RECORDS = [
  { title: 'loadtest-dua-morning-protection', waqt: 'Fajr', details: 'Dua for morning protection and blessings', audioUrl: 'https://example.com/audio/loadtest-dua-0.mp3' },
  { title: 'loadtest-dua-after-fajr', waqt: 'Fajr', details: 'Dua to be recited after Fajr prayer', audioUrl: 'https://example.com/audio/loadtest-dua-1.mp3' },
  { title: 'loadtest-dua-midday-guidance', waqt: 'Zuhr', details: 'Dua for guidance during the day', audioUrl: 'https://example.com/audio/loadtest-dua-2.mp3' },
  { title: 'loadtest-dua-after-zuhr', waqt: 'Zuhr', details: 'Dua to be recited after Zuhr prayer', audioUrl: 'https://example.com/audio/loadtest-dua-3.mp3' },
  { title: 'loadtest-dua-afternoon-patience', waqt: 'Asr', details: 'Dua for patience and perseverance', audioUrl: 'https://example.com/audio/loadtest-dua-4.mp3' },
  { title: 'loadtest-dua-after-asr', waqt: 'Asr', details: 'Dua to be recited after Asr prayer', audioUrl: 'https://example.com/audio/loadtest-dua-5.mp3' },
  { title: 'loadtest-dua-evening-gratitude', waqt: 'Maghrib', details: 'Dua for evening gratitude and reflection', audioUrl: 'https://example.com/audio/loadtest-dua-6.mp3' },
  { title: 'loadtest-dua-after-maghrib', waqt: 'Maghrib', details: 'Dua to be recited after Maghrib prayer', audioUrl: 'https://example.com/audio/loadtest-dua-7.mp3' },
  { title: 'loadtest-dua-night-peace', waqt: 'Isha', details: 'Dua for peaceful night and restful sleep', audioUrl: 'https://example.com/audio/loadtest-dua-8.mp3' },
  { title: 'loadtest-dua-after-isha', waqt: 'Isha', details: 'Dua to be recited after Isha prayer', audioUrl: 'https://example.com/audio/loadtest-dua-9.mp3' },
];

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
  console.log(`[seed-${MODULE_NAME}] Loaded base fixtures (admin + ${baseFixtures.brotherUsers?.length || 0} brothers + ${baseFixtures.sisterUsers?.length || 0} sisters).`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test dua data...`);
  const deleteResult = await DuaModel.deleteMany({ title: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${deleteResult.deletedCount} duas.`);

  // ── Step 3: Create dua records ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating dua records...`);
  const createdDuas = await DuaModel.insertMany(DUA_RECORDS);
  console.log(`[seed-${MODULE_NAME}] Created ${createdDuas.length} dua records.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    duas: createdDuas.map(dua => ({
      id: dua._id.toString(),
      title: dua.title,
      category: dua.waqt,
    })),
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${createdDuas.length} dua records (2 per waqt: Fajr, Zuhr, Asr, Maghrib, Isha)`);
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
