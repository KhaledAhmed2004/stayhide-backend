/**
 * seed-users.js — Load test fixture generator for Users module
 *
 * Usage: node load-tests/scripts/seed-users.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 2 additional SUPER_ADMIN accounts for admin endpoint testing
 *   - 5 BROTHER users for profile/session scenarios
 *   - 5 SISTER users for profile/session scenarios
 *
 * Writes:
 *   - Module fixtures (adminUsers, regularUsers, profileData) → modules/users/fixtures/users-fixtures.json
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json (does NOT create duplicates)
 *
 * Idempotent: deletes all prior "loadtest-users-" prefixed data before seeding.
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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const MODULE_NAME = 'users';
const EMAIL_PREFIX = 'loadtest-users-';
const KNOWN_PASSWORD = 'LoadTestUsers123!';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Validate required env vars ────────────────────────────────────────────────
const MONGODB_URI =
  process.env.LOAD_TEST_DB ||
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(`[seed-${MODULE_NAME}] ERROR: No MongoDB URI found.`);
  console.error(`[seed-${MODULE_NAME}] Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI in your environment.`);
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(`[seed-${MODULE_NAME}] ERROR: JWT_SECRET environment variable is not set.`);
  console.error(`[seed-${MODULE_NAME}] Please set it in your .env file or environment before running this script.`);
  process.exit(1);
}

const JWT_EXPIRE = process.env.JWT_EXPIRE_IN || '30d';

// ── Import Mongoose models (TypeScript via ts-node) ───────────────────────────
const { User } = require('../../src/app/modules/user/user.model');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sign a JWT token for a user (matches what the auth middleware expects).
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: 0,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE },
  );
}

/**
 * Hash a password synchronously.
 */
function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log(`[seed-${MODULE_NAME}] Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected.`);

  // ── Step 1: Read shared users from base-fixtures.json ─────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] ERROR: base-fixtures.json not found at ${BASE_FIXTURES_PATH}`);
    console.error(`[seed-${MODULE_NAME}] Run "npm run load:seed:groups" first to create shared fixtures.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  console.log(`[seed-${MODULE_NAME}] Loaded base fixtures (${baseFixtures.brotherUsers.length} brothers, ${baseFixtures.sisterUsers.length} sisters).`);

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous users load-test data...`);
  await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete.`);

  // ── Step 3: Create users-specific test accounts ─────────────────────────────
  // These accounts are dedicated to the Users module load test scenarios
  // (role-auth, profile updates, session management, admin operations).
  console.log(`[seed-${MODULE_NAME}] Creating users test accounts...`);

  const hashedPassword = hashPassword(KNOWN_PASSWORD);
  const adminUsers = [];
  const regularUsers = [];

  // Create 2 SUPER_ADMIN accounts for admin endpoint testing (role-auth scenario)
  for (let i = 0; i < 2; i++) {
    const user = await User.create({
      name: `Load Test Users Admin ${i}`,
      role: 'SUPER_ADMIN',
      email: `${EMAIL_PREFIX}admin-${i}@test.com`,
      password: hashedPassword,
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1985-01-01'),
      profileImage: '/default-avatar.svg',
      tokenVersion: 0,
    });
    adminUsers.push(user);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${adminUsers.length} admin accounts.`);

  // Create 5 BROTHER accounts for profile/session scenarios
  for (let i = 0; i < 5; i++) {
    const user = await User.create({
      name: `Load Test Users Brother ${i}`,
      role: 'BROTHER',
      email: `${EMAIL_PREFIX}brother-${i}@test.com`,
      password: hashedPassword,
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1990-01-01'),
      revertDate: new Date(),
      profileImage: '/default-avatar.svg',
      verificationImage: 'https://placeholder.com/verification.jpg',
      verificationVideo: 'https://placeholder.com/verification.mp4',
      aboutMe: `Load test brother user ${i} bio`,
      interests: ['coding', 'testing'],
      tokenVersion: 0,
    });
    regularUsers.push(user);
  }

  // Create 5 SISTER accounts for profile/session scenarios
  for (let i = 0; i < 5; i++) {
    const user = await User.create({
      name: `Load Test Users Sister ${i}`,
      role: 'SISTER',
      email: `${EMAIL_PREFIX}sister-${i}@test.com`,
      password: hashedPassword,
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1992-01-01'),
      revertDate: new Date(),
      profileImage: '/default-avatar.svg',
      verificationImage: 'https://placeholder.com/verification.jpg',
      verificationVideo: 'https://placeholder.com/verification.mp4',
      aboutMe: `Load test sister user ${i} bio`,
      interests: ['reading', 'learning'],
      tokenVersion: 0,
    });
    regularUsers.push(user);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${regularUsers.length} regular accounts (5 brothers, 5 sisters).`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    adminUsers: adminUsers.map(user => ({
      id: user._id.toString(),
      email: user.email,
      token: signToken(user),
    })),
    regularUsers: regularUsers.map(user => ({
      id: user._id.toString(),
      email: user.email,
      token: signToken(user),
      role: user.role,
    })),
    profileData: [...adminUsers, ...regularUsers].map(user => ({
      userId: user._id.toString(),
      name: user.name,
    })),
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${adminUsers.length} SUPER_ADMIN accounts`);
  console.log(`  - ${regularUsers.length} regular accounts (5 BROTHER, 5 SISTER)`);
  console.log(`  - ${moduleFixtures.profileData.length} profile data entries`);
  console.log(`  - Shared base fixtures: ${baseFixtures.brotherUsers.length} brothers, ${baseFixtures.sisterUsers.length} sisters (read-only)`);
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
