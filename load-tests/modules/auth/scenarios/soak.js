/**
 * soak.js — Soak (endurance) load test for Auth API
 *
 * Executor: ramping-vus, sustained moderate load over extended duration
 * Exercises refresh-token and verify-otp endpoints to detect memory leaks,
 * connection pool exhaustion, or gradual performance degradation.
 *
 * Rate-limit awareness:
 *   - Login: 10 req/min per IP → paced well below threshold
 *   - Refresh: 20 req/min per IP → paced below threshold
 *   - Requests are distributed across multiple test accounts
 *   - Sleep between iterations keeps per-VU rate safely under limits
 *
 * Usage (standalone):
 *   SOAK_PROFILE=local k6 run load-tests/modules/auth/scenarios/soak.js
 *   SOAK_PROFILE=production k6 run load-tests/modules/auth/scenarios/soak.js
 *
 * Usage (via entry point):
 *   npm run load:auth:soak
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getSoakStages, classifyPhase, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

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

// ── Custom Trend metrics for degradation detection ────────────────────────────
const earlyResponseTime = new Trend('early_response_time');
const lateResponseTime = new Trend('late_response_time');

// ── Track test start time for phase classification ────────────────────────────
const testStartTime = Date.now();

// ── Standalone k6 options (used when running this file directly) ──────────────
export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getSoakStages(__ENV.SOAK_PROFILE),
      exec: 'runSoak',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
};

// ── Exported exec function (called by entry point) ────────────────────────────
export function runSoak() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const writeHeaders = {
    ...headers,
    'Content-Type': 'application/json',
  };

  // Distribute across test accounts to avoid per-IP rate limit concentration
  const testAccount = fixtures.testAccounts[vuIndex % fixtures.testAccounts.length];
  const refreshToken = fixtures.refreshTokens[vuIndex % fixtures.refreshTokens.length];

  // ── Refresh Token: POST /auth/refresh-token ─────────────────────────────────
  // Rate limit: 20 req/min per IP — with 20 VUs and 6s sleep, each VU does ~10 req/min
  const r1 = http.post(
    `${BASE_URL}/api/v1/auth/refresh-token`,
    JSON.stringify({ refreshToken }),
    { headers: writeHeaders, tags: { name: 'POST /auth/refresh-token' } },
  );
  check(r1, {
    'POST /auth/refresh-token 2xx': (r) => r.status >= 200 && r.status < 300,
    'refresh-token not rate-limited': (r) => r.status !== 429,
  });

  // ── Verify OTP: POST /auth/verify-otp ───────────────────────────────────────
  // Simulates OTP verification attempts (will likely get 400 for invalid OTP,
  // but we're measuring latency and stability, not correctness of OTP value)
  const r2 = http.post(
    `${BASE_URL}/api/v1/auth/verify-otp`,
    JSON.stringify({
      email: testAccount.email,
      otp: '000000',
    }),
    { headers: writeHeaders, tags: { name: 'POST /auth/verify-otp' } },
  );
  check(r2, {
    'POST /auth/verify-otp responds': (r) => r.status >= 200 && r.status < 500,
    'verify-otp not rate-limited': (r) => r.status !== 429,
  });

  // ── Record response times into early/late Trend metrics ───────────────────
  const elapsedSeconds = (Date.now() - testStartTime) / 1000;
  const phase = classifyPhase(elapsedSeconds);

  const avgDuration = (r1.timings.duration + r2.timings.duration) / 2;

  if (phase === 'early') {
    earlyResponseTime.add(avgDuration);
  } else if (phase === 'late') {
    lateResponseTime.add(avgDuration);
  }

  // ── Pacing: sleep 6s between iterations ─────────────────────────────────────
  // With 20 VUs, each VU makes ~10 iterations/min (2 requests each = 20 req/min total per VU)
  // Distributed across accounts, this stays well below:
  //   - 10 req/min login threshold (no login requests in soak)
  //   - 20 req/min refresh threshold per IP
  sleep(6);
}

