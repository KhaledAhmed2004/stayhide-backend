/**
 * user-journey.js — User journey scenario for Learning-Content API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates realistic learning flow:
 * list content → view detail → toggle like → add comment → view comments.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

export function runUserJourney() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const content = fixtures.contents[vuIndex % fixtures.contents.length];

  // ── Step 1: List content ────────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/learning-contents`, {
    headers,
    tags: { name: 'journey:list-content' },
  });
  check(s1, { 'Step1:list-content 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 2: View content detail ─────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/learning-contents/${content.id}`, {
    headers,
    tags: { name: 'journey:view-content' },
  });
  check(s2, { 'Step2:view-content 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 3: Toggle like ─────────────────────────────────────────────────────
  const s3 = http.post(
    `${BASE_URL}/api/v1/learning-contents/${content.id}/like`,
    null,
    { headers, tags: { name: 'journey:toggle-like' } },
  );
  check(s3, { 'Step3:toggle-like 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 4: Add comment ─────────────────────────────────────────────────────
  const s4 = http.post(
    `${BASE_URL}/api/v1/learning-contents/${content.id}/comments`,
    JSON.stringify({ comment: `Journey comment VU${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'journey:add-comment' } },
  );
  check(s4, { 'Step4:add-comment 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 5: View comments ───────────────────────────────────────────────────
  const s5 = http.get(`${BASE_URL}/api/v1/learning-contents/${content.id}/comments`, {
    headers,
    tags: { name: 'journey:view-comments' },
  });
  check(s5, { 'Step5:view-comments 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
