/**
 * stress.js — Stress test scenario for Auth API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Tests login, verify-otp, and refresh-token endpoints under increasing concurrent load.
 * Distributes requests across multiple test user accounts to avoid per-IP rate limits.
 *
 * Run standalone: k6 run load-tests/modules/auth/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/auth/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getStressStages, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

// ── Standalone scenario options (used when running this file directly) ────────
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getStressStages(__ENV.STRESS_PROFILE),
      exec: 'default',
    },
  },
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<1000', abortOnFail: false },
      { threshold: 'p(95)<2000', abortOnFail: false },
      { threshold: 'p(99)<5000', abortOnFail: false },
    ],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

// ── Exported scenario config for entry point ──────────────────────────────────
export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressStages(),
  exec: 'runStress',
};

// ── Exec function (used by entry point) ───────────────────────────────────────
export function runStress() {
  stressIteration();
}

// ── Default function (used when running standalone) ───────────────────────────
export default function () {
  stressIteration();
}

/**
 * Core stress iteration logic.
 * Distributes requests across multiple test accounts to avoid per-IP rate limits.
 * Each VU uses a different test account based on its VU index (round-robin).
 */
function stressIteration() {
  const vuIndex = __VU - 1;

  // Distribute across test accounts to avoid per-IP rate limits (Requirement 11.1)
  const testAccount = fixtures.testAccounts[vuIndex % fixtures.testAccounts.length];
  const refreshToken = fixtures.refreshTokens[vuIndex % fixtures.refreshTokens.length];
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);

  // ── POST /auth/login ────────────────────────────────────────────────────────
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: testAccount.email,
      password: testAccount.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/login' },
    },
  );
  check(loginRes, {
    'POST /auth/login status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);

  // ── POST /auth/verify-otp ───────────────────────────────────────────────────
  // Send a verify-otp request with a dummy OTP to exercise the endpoint under load.
  // Expected: 400 (invalid OTP) — we're testing throughput, not correctness.
  const verifyOtpRes = http.post(
    `${BASE_URL}/api/v1/auth/verify-otp`,
    JSON.stringify({
      email: testAccount.email,
      otp: '000000',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/verify-otp' },
    },
  );
  check(verifyOtpRes, {
    'POST /auth/verify-otp responds': (r) => r.status === 400 || r.status === 200,
  });

  sleep(0.5);

  // ── POST /auth/refresh-token ────────────────────────────────────────────────
  const refreshRes = http.post(
    `${BASE_URL}/api/v1/auth/refresh-token`,
    JSON.stringify({ refreshToken }),
    {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/refresh-token' },
    },
  );
  check(refreshRes, {
    'POST /auth/refresh-token responds': (r) =>
      r.status === 200 || r.status === 401,
  });

  sleep(1);
}

// ── Report generation (standalone mode) ───────────────────────────────────────
export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
