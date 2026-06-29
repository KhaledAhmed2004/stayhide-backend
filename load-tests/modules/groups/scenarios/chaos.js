/**
 * chaos.js — Chaos test scenario (standalone)
 *
 * Executor: constant-vus, 10 VUs for 1 minute.
 * Interleaves valid requests (expect 200) with invalid requests (expect 404)
 * to verify the API degrades gracefully under partial failure conditions.
 *
 * Run: k6 run --out web-dashboard load-tests/scenarios/chaos.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

const INVALID_ID = '000000000000000000000000';

export const options = {
  scenarios: {
    chaos: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      exec: 'default',
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
  },
};

export default function () {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);

  // Select valid group and post from fixtures via modulo
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];
  const post = fixtures.posts[vuIndex % fixtures.posts.length];

  // Valid: GET /groups → check status 200
  const r1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'valid: GET /groups' },
  });
  check(r1, { 'valid: GET /groups → 200': (r) => r.status === 200 });

  // Invalid: GET /groups/INVALID_ID → check status 404
  const r2 = http.get(`${BASE_URL}/api/v1/groups/${INVALID_ID}`, {
    headers,
    tags: { name: 'chaos: GET /groups/:invalidId' },
  });
  check(r2, { 'chaos: GET /groups/:invalidId → 404': (r) => r.status === 404 });

  // Valid: GET /groups/:groupId/posts → check status 200
  const r3 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'valid: GET /groups/:id/posts' },
  });
  check(r3, { 'valid: GET /groups/:id/posts → 200': (r) => r.status === 200 });

  // Invalid: GET /groups/posts/INVALID_ID/comments → check status 404
  const r4 = http.get(`${BASE_URL}/api/v1/groups/posts/${INVALID_ID}/comments`, {
    headers,
    tags: { name: 'chaos: GET /posts/:invalidId/comments' },
  });
  check(r4, { 'chaos: GET /posts/:invalidId/comments → 404': (r) => r.status === 404 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
