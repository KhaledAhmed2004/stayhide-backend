/**
 * soak.js — Soak (endurance) load test
 *
 * Executor: ramping-vus, sustained moderate load over extended duration
 * Detects memory leaks, connection pool exhaustion, or gradual performance degradation.
 * Uses pre-seeded fixture data and exercises a mix of read and write endpoints.
 *
 * Usage:
 *   k6 run load-tests/scenarios/soak.js
 *   SOAK_PROFILE=production k6 run load-tests/scenarios/soak.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getSoakStages, classifyPhase, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

// ── Fixture loading ───────────────────────────────────────────────────────────
const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

// ── Custom Trend metrics for degradation detection ────────────────────────────
const earlyResponseTime = new Trend('early_response_time');
const lateResponseTime = new Trend('late_response_time');

// ── Track test start time for phase classification ────────────────────────────
const testStartTime = Date.now();

// ── k6 options (inline, self-contained) ───────────────────────────────────────
export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getSoakStages(__ENV.SOAK_PROFILE),
      exec: 'default',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
};


// ── Default VU function ───────────────────────────────────────────────────────
export default function () {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const writeHeaders = {
    ...headers,
    'Content-Type': 'application/json',
  };

  // Distribute across available fixture data
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];
  const post = fixtures.posts[vuIndex % fixtures.posts.length];

  // ── Read: GET /groups ─────────────────────────────────────────────────────
  const r1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'GET /groups' },
  });
  check(r1, { 'GET /groups 200': (r) => r.status === 200 });

  // ── Read: GET /groups/:id/posts ───────────────────────────────────────────
  const r2 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'GET /groups/:id/posts' },
  });
  check(r2, { 'GET /groups/:id/posts 200': (r) => r.status === 200 });

  // ── Write: POST comment ───────────────────────────────────────────────────
  const r3 = http.post(
    `${BASE_URL}/api/v1/groups/posts/${post.id}/comments`,
    JSON.stringify({ comment: `soak-comment ${__VU} ${Date.now()}` }),
    { headers: writeHeaders, tags: { name: 'POST /posts/:id/comments' } },
  );
  check(r3, { 'POST comment 2xx': (r) => r.status >= 200 && r.status < 300 });

  // ── Record response times into early/late Trend metrics ───────────────────
  const elapsedSeconds = (Date.now() - testStartTime) / 1000;
  const phase = classifyPhase(elapsedSeconds);

  // Use the average of all response times in this iteration
  const avgDuration = (r1.timings.duration + r2.timings.duration + r3.timings.duration) / 3;

  if (phase === 'early') {
    earlyResponseTime.add(avgDuration);
  } else if (phase === 'late') {
    lateResponseTime.add(avgDuration);
  }

  sleep(1);
}

// ── Report generation ─────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
