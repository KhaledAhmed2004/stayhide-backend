/**
 * seed-khutbah.js — Load test fixture generator for Khutbah module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-khutbah.js
 * Requires: MONGODB_URI (or DATABASE_URL) in environment.
 *
 * Creates:
 *   - 10 khutbah records with diverse topics and imams
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (khutbahs) → modules/khutbah/fixtures/khutbah-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed khutbah data before seeding.
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
const MODULE_NAME = 'khutbah';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const KhutbaModel = require('../../src/app/modules/khutbah/khutbah.model').default;

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
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test khutbah data...`);
  const deleteResult = await KhutbaModel.deleteMany({ title: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${deleteResult.deletedCount} khutbahs.`);

  // ── Step 3: Create khutbah records ──────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating 10 khutbah records...`);

  const khutbahTopics = [
    { title: 'loadtest-khutbah-patience', topic: 'Patience', imam: 'Imam Ahmad', mosqueName: 'Masjid Al-Noor' },
    { title: 'loadtest-khutbah-gratitude', topic: 'Gratitude', imam: 'Imam Yusuf', mosqueName: 'Masjid Al-Rahman' },
    { title: 'loadtest-khutbah-tawakkul', topic: 'Tawakkul', imam: 'Imam Khalid', mosqueName: 'Masjid Al-Iman' },
    { title: 'loadtest-khutbah-brotherhood', topic: 'Brotherhood', imam: 'Imam Omar', mosqueName: 'Masjid Al-Taqwa' },
    { title: 'loadtest-khutbah-forgiveness', topic: 'Forgiveness', imam: 'Imam Hassan', mosqueName: 'Masjid Al-Huda' },
    { title: 'loadtest-khutbah-charity', topic: 'Charity', imam: 'Imam Ibrahim', mosqueName: 'Masjid Al-Falah' },
    { title: 'loadtest-khutbah-knowledge', topic: 'Knowledge', imam: 'Imam Bilal', mosqueName: 'Masjid Al-Ilm' },
    { title: 'loadtest-khutbah-prayer', topic: 'Prayer', imam: 'Imam Zayd', mosqueName: 'Masjid Al-Salam' },
    { title: 'loadtest-khutbah-family', topic: 'Family', imam: 'Imam Tariq', mosqueName: 'Masjid Al-Furqan' },
    { title: 'loadtest-khutbah-community', topic: 'Community', imam: 'Imam Hamza', mosqueName: 'Masjid Al-Hidayah' },
  ];

  const khutbahs = [];
  for (let i = 0; i < khutbahTopics.length; i++) {
    const topic = khutbahTopics[i];
    const khutbah = await KhutbaModel.create({
      title: topic.title,
      mosqueName: topic.mosqueName,
      imam: topic.imam,
      date: new Date(2024, 0, (i + 1) * 7), // Weekly Fridays starting Jan 2024
      description: `Load test khutbah about ${topic.topic}. This is a seeded record for load testing purposes.`,
      audioUrl: `https://placeholder.com/audio/khutbah-${i}.mp3`,
      thumbnailUrl: `https://placeholder.com/thumbnails/khutbah-${i}.jpg`,
      durationInSeconds: 1800 + i * 120, // 30-50 minutes range
    });
    khutbahs.push(khutbah);
  }

  console.log(`[seed-${MODULE_NAME}] Created ${khutbahs.length} khutbah records.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    khutbahs: khutbahs.map(k => ({
      id: k._id.toString(),
      title: k.title,
      topic: khutbahTopics.find(t => t.title === k.title)?.topic || 'General',
    })),
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${khutbahs.length} khutbah records`);
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
