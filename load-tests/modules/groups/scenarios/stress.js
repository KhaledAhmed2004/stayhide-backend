/**
 * stress.js — Stress test scenario (standalone)
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Tests GET endpoints under increasing concurrent load.
 * Uses pre-seeded fixture data — no writes during this scenario.
 *
 * Run: k6 run --out web-dashboard load-tests/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/scenarios/stress.js
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

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

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

export default function () {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);

  // Distribute across available groups and posts to avoid hotspotting
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];
  const post = fixtures.posts[vuIndex % fixtures.posts.length];

  // GET /api/v1/groups
  const r1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'GET /groups' },
  });
  check(r1, { 'GET /groups 200': (r) => r.status === 200 });

  // GET /api/v1/groups/:groupId
  const r2 = http.get(`${BASE_URL}/api/v1/groups/${group.id}`, {
    headers,
    tags: { name: 'GET /groups/:id' },
  });
  check(r2, { 'GET /groups/:id 200': (r) => r.status === 200 });

  // GET /api/v1/groups/:groupId/posts
  const r3 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'GET /groups/:id/posts' },
  });
  check(r3, { 'GET /groups/:id/posts 200': (r) => r.status === 200 });

  // GET /api/v1/groups/posts/:postId/comments
  const r4 = http.get(`${BASE_URL}/api/v1/groups/posts/${post.id}/comments`, {
    headers,
    tags: { name: 'GET /posts/:id/comments' },
  });
  check(r4, { 'GET /posts/:id/comments 200': (r) => r.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
