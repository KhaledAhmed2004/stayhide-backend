/**
 * read-load.js — Concurrent read load test for Learning-Content API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users browsing content listings, viewing individual content,
 * and reading comments.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('learning-content-fixtures', function () {
  return [JSON.parse(open('../fixtures/learning-content-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const content = fixtures.contents[(vuIndex + __ITER) % fixtures.contents.length];

  // GET /api/v1/learning-contents — list content
  const r1 = http.get(`${BASE_URL}/api/v1/learning-contents`, {
    headers,
    tags: { name: 'GET /learning-contents' },
  });
  check(r1, { 'GET /learning-contents 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/learning-contents/:contentId — view detail
  const r2 = http.get(`${BASE_URL}/api/v1/learning-contents/${content.id}`, {
    headers,
    tags: { name: 'GET /learning-contents/:id' },
  });
  check(r2, { 'GET /learning-contents/:id 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/learning-contents/:contentId/comments — read comments
  const r3 = http.get(`${BASE_URL}/api/v1/learning-contents/${content.id}/comments`, {
    headers,
    tags: { name: 'GET /learning-contents/:id/comments' },
  });
  check(r3, { 'GET /learning-contents/:id/comments 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
