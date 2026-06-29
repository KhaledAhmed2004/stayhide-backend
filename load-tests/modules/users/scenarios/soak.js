/**
 * soak.js — Soak (endurance) load test for Users API
 *
 * Executor: ramping-vus, sustained moderate load over extended duration
 * Exercises profile read endpoints (GET /users/me, GET /users/:userId/public,
 * GET /users/profiles) to detect memory leaks, connection pool exhaustion,
 * or gradual performance degradation.
 *
 * Uses pre-seeded fixture data — read-only operations during this scenario.
 *
 * Usage (standalone):
 *   SOAK_PROFILE=local k6 run load-tests/modules/users/scenarios/soak.js
 *   SOAK_PROFILE=production k6 run load-tests/modules/users/scenarios/soak.js
 *
 * Usage (via entry point):
 *   npm run load:users:soak
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

const moduleFixtures = new SharedArray('users-fixtures', function () {
  return [JSON.parse(open('../fixtures/users-fixtures.json'))];
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

  // Distribute across available users to avoid hotspotting a single profile
  const targetUser = fixtures.brotherUsers[vuIndex % fixtures.brotherUsers.length];

  // ── Read: GET /users/me — own profile ─────────────────────────────────────
  const r1 = http.get(`${BASE_URL}/api/v1/users/me`, {
    headers,
    tags: { name: 'GET /users/me' },
  });
  check(r1, {
    'GET /users/me 200': (r) => r.status === 200,
  });

  // ── Read: GET /users/:userId/public — public profile view ─────────────────
  const r2 = http.get(`${BASE_URL}/api/v1/users/${targetUser.id}/public`, {
    headers,
    tags: { name: 'GET /users/:userId/public' },
  });
  check(r2, {
    'GET /users/:userId/public 200': (r) => r.status === 200,
  });

  // ── Read: GET /users/profiles — community discovery ───────────────────────
  const r3 = http.get(`${BASE_URL}/api/v1/users/profiles`, {
    headers,
    tags: { name: 'GET /users/profiles' },
  });
  check(r3, {
    'GET /users/profiles 200': (r) => r.status === 200,
  });

  // ── Record response times into early/late Trend metrics ───────────────────
  // Comparing early vs late response times detects gradual degradation
  // indicative of memory leaks or connection pool exhaustion
  const elapsedSeconds = (Date.now() - testStartTime) / 1000;
  const phase = classifyPhase(elapsedSeconds);

  const avgDuration = (r1.timings.duration + r2.timings.duration + r3.timings.duration) / 3;

  if (phase === 'early') {
    earlyResponseTime.add(avgDuration);
  } else if (phase === 'late') {
    lateResponseTime.add(avgDuration);
  }

  // ── Pacing: sleep 2s between iterations ─────────────────────────────────────
  // With 20 VUs, each VU makes ~30 iterations/min (3 read requests each)
  // Read-only operations have no rate limiting concerns
  sleep(2);
}
