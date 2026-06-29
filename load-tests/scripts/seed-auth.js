/**
 * seed-auth.js — Load test fixture generator for Auth module
 *
 * Usage: node load-tests/scripts/seed-auth.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 10 auth-specific test accounts with known credentials (loadtest-auth-* prefix)
 *   - 1 OTP test account for verify-otp / resend-otp scenarios
 *
 * Writes:
 *   - Module fixtures (testAccounts, otpTestAccount, refreshTokens) → modules/auth/fixtures/auth-fixtures.json
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json (does NOT create duplicates)
 *
 * Idempotent: deletes all prior "loadtest-auth-" prefixed data before seeding.
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
const MODULE_NAME = 'auth';
const EMAIL_PREFIX = 'loadtest-auth-';
const KNOWN_PASSWORD = 'LoadTestAuth123!';
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
  return bcrypt.hashSync(plain, 12);
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
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous auth load-test data...`);
  await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
  console.log(`[seed-${MODULE_NAME}] Cleanup complete.`);

  // ── Step 3: Create auth-specific test accounts ──────────────────────────────
  // These accounts have known passwords for login/password-change scenarios.
  // They are separate from the shared base users to avoid interfering with other modules.
  console.log(`[seed-${MODULE_NAME}] Creating auth test accounts...`);

  // Use plain password — User.create() pre-save hook will hash it with config.bcrypt_salt_rounds
  const plainPassword = KNOWN_PASSWORD;
  const testAccounts = [];

  // Create 10 auth test accounts (mix of roles for rate-limit distribution)
  const authAccountConfigs = [
    { suffix: 'brother-0', role: 'BROTHER' },
    { suffix: 'brother-1', role: 'BROTHER' },
    { suffix: 'brother-2', role: 'BROTHER' },
    { suffix: 'brother-3', role: 'BROTHER' },
    { suffix: 'brother-4', role: 'BROTHER' },
    { suffix: 'sister-0', role: 'SISTER' },
    { suffix: 'sister-1', role: 'SISTER' },
    { suffix: 'sister-2', role: 'SISTER' },
    { suffix: 'sister-3', role: 'SISTER' },
    { suffix: 'sister-4', role: 'SISTER' },
  ];

  for (const config of authAccountConfigs) {
    const user = await User.create({
      name: `Load Test Auth ${config.suffix}`,
      role: config.role,
      email: `${EMAIL_PREFIX}${config.suffix}@test.com`,
      password: plainPassword,
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1990-01-01'),
      revertDate: new Date(),
      profileImage: '/default-avatar.svg',
      verificationImage: 'https://placeholder.com/verification.jpg',
      verificationVideo: 'https://placeholder.com/verification.mp4',
      tokenVersion: 0,
    });
    testAccounts.push(user);
  }
  console.log(`[seed-${MODULE_NAME}] Created ${testAccounts.length} auth test accounts.`);

  // Create OTP test account (for verify-otp and resend-otp scenarios)
  console.log(`[seed-${MODULE_NAME}] Creating OTP test account...`);
  const otpTestUser = await User.create({
    name: 'Load Test Auth OTP',
    role: 'BROTHER',
    email: `${EMAIL_PREFIX}otp@test.com`,
    password: plainPassword,
    status: 'ACTIVE',
    isVerified: true,
    dateOfBirth: new Date('1990-01-01'),
    revertDate: new Date(),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://placeholder.com/verification.jpg',
    verificationVideo: 'https://placeholder.com/verification.mp4',
    tokenVersion: 0,
  });
  console.log(`[seed-${MODULE_NAME}] OTP test account created.`);

  // ── Step 4: Generate refresh tokens for token-refresh scenarios ────────────
  const refreshTokens = testAccounts.map(user => signToken(user));

  // ── Step 5: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    testAccounts: testAccounts.map(user => ({
      email: user.email,
      password: KNOWN_PASSWORD,
      role: user.role,
      userId: user._id.toString(),
    })),
    otpTestAccount: {
      email: otpTestUser.email,
      password: KNOWN_PASSWORD,
      userId: otpTestUser._id.toString(),
    },
    refreshTokens,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${testAccounts.length} auth test accounts (known credentials)`);
  console.log(`  - 1 OTP test account`);
  console.log(`  - ${refreshTokens.length} refresh tokens`);
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
