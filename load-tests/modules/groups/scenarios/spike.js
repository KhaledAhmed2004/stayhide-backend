/**
 * spike.js — Spike test
 *
 * Executor: ramping-vus
 * Stages: 0→5 VUs (5s ramp_up) → 5→50 VUs (10s peak) → 50→5 VUs (5s recovery)
 *
 * Tests that the server handles sudden traffic spikes and recovers gracefully.
 * Requests are tagged with stage name for per-stage metric analysis.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';

export const spikeScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5s', target: 5 },   // ramp_up
    { duration: '10s', target: 50 }, // peak
    { duration: '5s', target: 5 },   // recovery
  ],
  exec: 'runSpike',
};

/**
 * Approximate stage tag based on iteration count.
 * ramp_up: first few iterations, peak: middle, recovery: later.
 * Note: __ITER is per-VU, so this is an approximation.
 */
function getStageTag() {
  // Use __ITER as a rough proxy for elapsed time within the scenario.
  // Each iteration takes ~1s (3 requests + minimal sleep).
  if (__ITER < 5) return 'ramp_up';
  if (__ITER < 15) return 'peak';
  return 'recovery';
}

export function runSpike() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];
  const post = fixtures.posts[vuIndex % fixtures.posts.length];
  const stage = getStageTag();

  // GET /api/v1/groups
  const r1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'GET /groups', stage },
  });
  check(r1, { 'spike GET /groups 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/groups/:groupId/posts
  const r2 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'GET /groups/:id/posts', stage },
  });
  check(r2, { 'spike GET /posts 2xx': r => r.status >= 200 && r.status < 300 });

  // POST /api/v1/groups/posts/:postId/like — replaced with GET to avoid toggle issues
  const r3 = http.get(
    `${BASE_URL}/api/v1/groups/${group.id}/posts`,
    { headers, tags: { name: 'GET /groups/:id/posts', stage } },
  );
  check(r3, { 'spike GET /posts 2xx': r => r.status >= 200 && r.status < 300 });
}
