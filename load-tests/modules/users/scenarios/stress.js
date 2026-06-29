/**
 * stress.js — Stress test scenario for Users API
 *
 * Executor: ramping-vus, progressive VU increase to find throughput limits.
 * Ramps VUs performing mixed read/write operations across self-management
 * and admin endpoints to identify the point where response times degrade.
 *
 * Run standalone: k6 run load-tests/modules/users/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/users/scenarios/stress.js
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

const moduleFixtures = new SharedArray('users-fixtures', function () {
  return [JSON.parse(open('../fixtures/users-fixtures.json'))];
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
 * Performs mixed read/write operations across self-management and admin endpoints.
 * Each VU uses a different user account based on its VU index (round-robin).
 */
function stressIteration() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Distribute across available users to avoid hotspotting
  const targetUser = fixtures.brotherUsers[(vuIndex + 1) % fixtures.brotherUsers.length];

  // ── Operation 1: Get own profile (read) ─────────────────────────────────────
  const profileRes = http.get(`${BASE_URL}/api/v1/users/me`, {
    headers,
    tags: { name: 'GET /users/me' },
  });
  check(profileRes, {
    'GET /users/me 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);

  // ── Operation 2: View public profile (read) ─────────────────────────────────
  const publicRes = http.get(`${BASE_URL}/api/v1/users/${targetUser.id}/public`, {
    headers,
    tags: { name: 'GET /users/:userId/public' },
  });
  check(publicRes, {
    'GET /users/:userId/public 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);

  // ── Operation 3: Update own profile (write) — less frequent to avoid rate limits
  if (__ITER % 3 === 0) {
    const updateRes = http.patch(
      `${BASE_URL}/api/v1/users/me`,
      JSON.stringify({ name: `StressTest User ${__VU}-${Date.now()}` }),
      { headers, tags: { name: 'PATCH /users/me' } },
    );
    check(updateRes, {
      // Accept 429 rate-limit as non-failure in stress scenario
      'PATCH /users/me 2xx': (r) => r.status >= 200 && r.status < 300 || r.status === 429,
    });
  }

  sleep(0.5);

  // ── Operation 4: List sessions (read) ───────────────────────────────────────
  const sessionsRes = http.get(`${BASE_URL}/api/v1/users/me/sessions`, {
    headers,
    tags: { name: 'GET /users/me/sessions' },
  });
  check(sessionsRes, {
    'GET /users/me/sessions 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);

  // ── Operation 5: Community discovery (read) ─────────────────────────────────
  const communityRes = http.get(`${BASE_URL}/api/v1/users/profiles`, {
    headers,
    tags: { name: 'GET /users/profiles' },
  });
  check(communityRes, {
    'GET /users/profiles 2xx': (r) => r.status >= 200 && r.status < 300,
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
