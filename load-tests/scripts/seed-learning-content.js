/**
 * seed-learning-content.js — Load test fixture generator for Learning-Content module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-learning-content.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 10 learning content items with categories and video URLs
 *   - 2 comments per content item (20 total) from fixture users
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (contents, comments) → modules/learning-content/fixtures/learning-content-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed learning content data before seeding.
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
const MODULE_NAME = 'learning-content';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { LearningContent, LearningContentComment } = require('../../src/app/modules/learning-content/learning-content.model');

// ── Content categories and sample data ────────────────────────────────────────
const CATEGORIES = ['quran', 'hadith', 'fiqh', 'seerah', 'arabic', 'tafsir', 'aqeedah', 'history', 'manners', 'spirituality'];

const CONTENT_ITEMS = [
  { title: 'loadtest-content-0', description: 'Introduction to Quran recitation rules', category: 'quran', videoUrl: 'https://example.com/videos/loadtest-0.mp4', durationInSeconds: 600 },
  { title: 'loadtest-content-1', description: 'Understanding Hadith authentication methods', category: 'hadith', videoUrl: 'https://example.com/videos/loadtest-1.mp4', durationInSeconds: 900 },
  { title: 'loadtest-content-2', description: 'Basics of Islamic jurisprudence', category: 'fiqh', videoUrl: 'https://example.com/videos/loadtest-2.mp4', durationInSeconds: 1200 },
  { title: 'loadtest-content-3', description: 'The life of Prophet Muhammad (PBUH)', category: 'seerah', videoUrl: 'https://example.com/videos/loadtest-3.mp4', durationInSeconds: 1500 },
  { title: 'loadtest-content-4', description: 'Arabic grammar fundamentals', category: 'arabic', videoUrl: 'https://example.com/videos/loadtest-4.mp4', durationInSeconds: 750 },
  { title: 'loadtest-content-5', description: 'Tafsir of Surah Al-Fatiha', category: 'tafsir', videoUrl: 'https://example.com/videos/loadtest-5.mp4', durationInSeconds: 1800 },
  { title: 'loadtest-content-6', description: 'Foundations of Islamic belief', category: 'aqeedah', videoUrl: 'https://example.com/videos/loadtest-6.mp4', durationInSeconds: 1100 },
  { title: 'loadtest-content-7', description: 'Islamic history: The Rightly Guided Caliphs', category: 'history', videoUrl: 'https://example.com/videos/loadtest-7.mp4', durationInSeconds: 2000 },
  { title: 'loadtest-content-8', description: 'Etiquettes of seeking knowledge', category: 'manners', videoUrl: 'https://example.com/videos/loadtest-8.mp4', durationInSeconds: 500 },
  { title: 'loadtest-content-9', description: 'Purification of the heart', category: 'spirituality', videoUrl: 'https://example.com/videos/loadtest-9.mp4', durationInSeconds: 850 },
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
  const { brotherUsers, sisterUsers } = baseFixtures;

  if (!brotherUsers || brotherUsers.length < 5) {
    console.error(`[seed-${MODULE_NAME}] Not enough brother users in base fixtures. Need at least 5.`);
    process.exit(1);
  }
  if (!sisterUsers || sisterUsers.length < 5) {
    console.error(`[seed-${MODULE_NAME}] Not enough sister users in base fixtures. Need at least 5.`);
    process.exit(1);
  }

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test learning content data...`);

  // Delete comments on loadtest content
  const existingContent = await LearningContent.find({ title: { $regex: /^loadtest-/ } });
  const existingContentIds = existingContent.map(c => c._id);

  if (existingContentIds.length > 0) {
    await LearningContentComment.deleteMany({ contentId: { $in: existingContentIds } });
  }

  // Delete loadtest content items
  await LearningContent.deleteMany({ title: { $regex: /^loadtest-/ } });

  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${existingContentIds.length} content items and their comments.`);

  // ── Step 3: Create learning content items with comments ─────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating learning content items...`);

  const createdContents = [];
  const createdComments = [];

  for (let i = 0; i < CONTENT_ITEMS.length; i++) {
    const contentData = CONTENT_ITEMS[i];

    const content = await LearningContent.create({
      ...contentData,
      likesCount: 0,
      commentsCount: 2,
    });

    createdContents.push({
      id: content._id.toString(),
      title: content.title,
      type: content.category,
    });

    // Create 2 comments per content item from different users
    const commenter1 = brotherUsers[i % brotherUsers.length];
    const commenter2 = sisterUsers[i % sisterUsers.length];

    const comment1 = await LearningContentComment.create({
      contentId: content._id,
      userId: new mongoose.Types.ObjectId(commenter1.id),
      comment: `loadtest-comment-${i}-0 Great content on ${contentData.category}!`,
    });

    const comment2 = await LearningContentComment.create({
      contentId: content._id,
      userId: new mongoose.Types.ObjectId(commenter2.id),
      comment: `loadtest-comment-${i}-1 Very informative, jazakAllah khair.`,
    });

    createdComments.push(
      { id: comment1._id.toString(), contentId: content._id.toString(), userId: commenter1.id },
      { id: comment2._id.toString(), contentId: content._id.toString(), userId: commenter2.id },
    );
  }

  console.log(`[seed-${MODULE_NAME}] Created ${createdContents.length} content items with ${createdComments.length} comments.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    contents: createdContents,
    comments: createdComments,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${createdContents.length} learning content items (10 categories)`);
  console.log(`  - ${createdComments.length} comments (2 per content item)`);
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
