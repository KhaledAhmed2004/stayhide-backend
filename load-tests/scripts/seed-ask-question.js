/**
 * seed-ask-question.js — Load test fixture generator for Ask-Question module
 *
 * Usage: node load-tests/scripts/seed-ask-question.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 10 questions with known user associations (mix of pending and answered)
 *
 * Writes:
 *   - Module fixtures (questions, unansweredQuestionIds) → modules/ask-question/fixtures/ask-question-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed question data before seeding.
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
const MODULE_NAME = 'ask-question';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const AskQuestion = require('../../src/app/modules/ask-question/ask-question.model').default;

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] No MongoDB URI found. Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI.`);
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected to database.`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  // Delete previously seeded questions identified by the "loadtest-" prefix in the question text
  await AskQuestion.deleteMany({ question: { $regex: /^loadtest-/ } });
  console.log(`[seed-${MODULE_NAME}] Cleaned up previous seed data.`);

  // ── Step 3: Read shared users from base fixtures ────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] Base fixtures not found at ${BASE_FIXTURES_PATH}. Run seed-groups.js first.`);
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  const brotherUsers = baseFixtures.brotherUsers;
  const sisterUsers = baseFixtures.sisterUsers;

  // ── Step 4: Create 10 questions with known user associations ────────────────
  console.log(`[seed-${MODULE_NAME}] Creating 10 questions...`);

  const questionData = [
    { userId: brotherUsers[0].id, userRole: 'BROTHER', question: 'loadtest-question-0 What is the ruling on combining prayers while traveling?', status: 'pending' },
    { userId: brotherUsers[1].id, userRole: 'BROTHER', question: 'loadtest-question-1 How should one perform the prayer of need (salat al-hajah)?', status: 'pending' },
    { userId: brotherUsers[2].id, userRole: 'BROTHER', question: 'loadtest-question-2 What are the conditions for a valid wudu?', status: 'answered' },
    { userId: sisterUsers[0].id, userRole: 'SISTER', question: 'loadtest-question-3 Is it permissible to recite Quran during menstruation?', status: 'pending' },
    { userId: sisterUsers[1].id, userRole: 'SISTER', question: 'loadtest-question-4 What is the proper way to wear hijab according to scholars?', status: 'answered' },
    { userId: brotherUsers[3].id, userRole: 'BROTHER', question: 'loadtest-question-5 Can one pray in a moving vehicle?', status: 'pending' },
    { userId: brotherUsers[4].id, userRole: 'BROTHER', question: 'loadtest-question-6 What is the ruling on music in Islam?', status: 'answered' },
    { userId: sisterUsers[2].id, userRole: 'SISTER', question: 'loadtest-question-7 How to calculate zakat on gold jewelry?', status: 'pending' },
    { userId: brotherUsers[5].id, userRole: 'BROTHER', question: 'loadtest-question-8 What are the etiquettes of making dua?', status: 'pending' },
    { userId: sisterUsers[3].id, userRole: 'SISTER', question: 'loadtest-question-9 Is it obligatory to cover the feet during prayer?', status: 'answered' },
  ];

  const questions = [];
  for (const data of questionData) {
    const questionDoc = {
      userId: new mongoose.Types.ObjectId(data.userId),
      userRole: data.userRole,
      question: data.question,
      status: data.status,
      answers: [],
    };

    // Add an answer for answered questions
    if (data.status === 'answered') {
      questionDoc.answers = [
        {
          version: 1,
          text: `loadtest-answer for: ${data.question.substring(0, 50)}`,
          isActive: true,
          createdAt: new Date(),
        },
      ];
    }

    const created = await AskQuestion.create(questionDoc);
    questions.push(created);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${questions.length} questions.`);

  // ── Step 5: Write module fixtures ───────────────────────────────────────────
  const unansweredQuestionIds = questions
    .filter(q => q.status === 'pending')
    .map(q => q._id.toString());

  const moduleFixtures = {
    questions: questions.map(q => ({
      id: q._id.toString(),
      userId: q.userId.toString(),
      text: q.question,
      isAnswered: q.status === 'answered',
    })),
    unansweredQuestionIds,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${questions.length} questions created`);
  console.log(`  - ${unansweredQuestionIds.length} unanswered (pending)`);
  console.log(`  - ${questions.length - unansweredQuestionIds.length} answered`);
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
