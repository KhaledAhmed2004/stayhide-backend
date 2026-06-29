/**
 * write-load.js — Concurrent write load test for Learning-Content API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent like toggles and comment submissions from multiple VUs.
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

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const content = fixtures.contents[(vuIndex + __ITER) % fixtures.contents.length];

  if (__ITER % 2 === 0) {
    // Toggle like on content
    const res = http.post(
      `${BASE_URL}/api/v1/learning-contents/${content.id}/like`,
      null,
      { headers, tags: { name: 'POST /learning-contents/:id/like' } },
    );
    check(res, { 'POST /learning-contents/:id/like 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Add a comment
    const res = http.post(
      `${BASE_URL}/api/v1/learning-contents/${content.id}/comments`,
      JSON.stringify({ comment: `Write load comment VU${__VU} ${Date.now()}` }),
      { headers, tags: { name: 'POST /learning-contents/:id/comments' } },
    );
    check(res, { 'POST /learning-contents/:id/comments 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
