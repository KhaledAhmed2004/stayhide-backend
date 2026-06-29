/**
 * spike.js — Spike test for Auth API
 *
 * Executor: ramping-vus
 * Stages: 0→3 VUs (5s ramp_up) → 3→30 VUs (10s peak) → 30→3 VUs (5s recovery)
 *
 * Simulates sudden bursts of login attempts to verify the system recovers
 * gracefully after traffic surges. Requests are tagged with stage name
 * for per-stage metric analysis.
 *
 * Rate-limit awareness:
 *   - Distributes login attempts across multiple test accounts
 *   - Peak phase intentionally pushes concurrency to observe system behavior
 *   - Recovery phase verifies response times return to normal levels
 *
 * Usage (standalone):
 *   k6 run load-tests/modules/auth/scenarios/spike.js
 *
 * Usage (via entry point):
 *   npm run load:auth
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

// ── Fixture loading ───────────────────────────────────────────────────────────
const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

// ── Exported scenario config for entry point ──────────────────────────────────
export const spikeScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5s', target: 3 },   // ramp_up
    { duration: '10s', target: 30 }, // peak — sudden burst
    { duration: '5s', target: 3 },   // recovery
  ],
  exec: 'runSpike',
};

// ── Standalone k6 options (used when running this file directly) ──────────────
export const options = {
  scenarios: {
    spike: { ...spikeScenario, exec: 'default' },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

/**
 * Approximate stage tag based on iteration count.
 * ramp_up: first few iterations, peak: middle, recovery: later.
 * Note: __ITER is per-VU, so this is an approximation.
 */
function getStageTag() {
  if (__ITER < 3) return 'ramp_up';
  if (__ITER < 12) return 'peak';
  return 'recovery';
}

// ── Exec function (used by entry point) ───────────────────────────────────────
export function runSpike() {
  spikeIteration();
}

// ── Default function (used when running standalone) ───────────────────────────
export default function () {
  spikeIteration();
}

/**
 * Core spike iteration logic.
 * Simulates sudden bursts of login attempts distributed across test accounts.
 * Exercises login and refresh-token endpoints to verify system handles
 * traffic surges and recovers gracefully.
 */
function spikeIteration() {
  const vuIndex = __VU - 1;
  const stage = getStageTag();

  // Distribute across test accounts to avoid single-account rate limiting
  const testAccount = fixtures.testAccounts[vuIndex % fixtures.testAccounts.length];
  const refreshToken = fixtures.refreshTokens[vuIndex % fixtures.refreshTokens.length];
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const writeHeaders = {
    ...headers,
    'Content-Type': 'application/json',
  };

  // ── POST /auth/login — primary spike target ─────────────────────────────────
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: testAccount.email,
      password: testAccount.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/login', stage },
    },
  );
  check(loginRes, {
    'spike POST /auth/login responds': (r) => r.status >= 200 && r.status < 500,
    'spike login not server error': (r) => r.status < 500,
  });

  // ── POST /auth/refresh-token — secondary spike target ───────────────────────
  const refreshRes = http.post(
    `${BASE_URL}/api/v1/auth/refresh-token`,
    JSON.stringify({ refreshToken }),
    {
      headers: writeHeaders,
      tags: { name: 'POST /auth/refresh-token', stage },
    },
  );
  check(refreshRes, {
    'spike POST /auth/refresh-token responds': (r) => r.status >= 200 && r.status < 500,
    'spike refresh not server error': (r) => r.status < 500,
  });

  // ── POST /auth/verify-otp — tertiary spike target ───────────────────────────
  const verifyRes = http.post(
    `${BASE_URL}/api/v1/auth/verify-otp`,
    JSON.stringify({
      email: testAccount.email,
      otp: '000000',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/verify-otp', stage },
    },
  );
  check(verifyRes, {
    'spike POST /auth/verify-otp responds': (r) => r.status >= 200 && r.status < 500,
    'spike verify-otp not server error': (r) => r.status < 500,
  });

  // Minimal sleep — spike tests should push requests quickly
  sleep(0.3);
}
