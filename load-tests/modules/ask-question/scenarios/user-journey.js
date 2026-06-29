/**
 * user-journey.js — User journey scenario for Ask-Question API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates complete lifecycle:
 * submit question → view my questions → admin views all → admin answers → user views updated.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('ask-question-fixtures', function () {
  return [JSON.parse(open('../fixtures/ask-question-fixtures.json'))];
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
  const userHeaders = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const adminHeaders = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  // ── Step 1: Submit a question ───────────────────────────────────────────────
  const s1 = http.post(
    `${BASE_URL}/api/v1/ask-question`,
    JSON.stringify({ question: `Journey question VU${__VU} ${Date.now()}` }),
    { headers: userHeaders, tags: { name: 'journey:submit-question' } },
  );
  check(s1, { 'Step1:submit-question 2xx': r => r.status >= 200 && r.status < 300 });

  let questionId = null;
  try {
    const body = JSON.parse(s1.body);
    questionId = body?.data?._id || body?.data?.id || null;
  } catch (_) {}

  // Fallback to fixture question if extraction fails
  if (!questionId) {
    questionId = fixtures.questions[vuIndex % fixtures.questions.length].id;
  }
  sleep(1);

  // ── Step 2: View my questions ───────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/ask-question/my-questions`, {
    headers: userHeaders,
    tags: { name: 'journey:my-questions' },
  });
  check(s2, { 'Step2:my-questions 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 3: Admin views all questions ───────────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/ask-question`, {
    headers: adminHeaders,
    tags: { name: 'journey:admin-all-questions' },
  });
  check(s3, { 'Step3:admin-all-questions 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 4: Admin answers the question ──────────────────────────────────────
  const s4 = http.patch(
    `${BASE_URL}/api/v1/ask-question/${questionId}/answer`,
    JSON.stringify({ answer: `Admin answer for VU${__VU} ${Date.now()}` }),
    { headers: adminHeaders, tags: { name: 'journey:admin-answer' } },
  );
  check(s4, { 'Step4:admin-answer 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 5: User views updated questions ────────────────────────────────────
  const s5 = http.get(`${BASE_URL}/api/v1/ask-question/my-questions`, {
    headers: userHeaders,
    tags: { name: 'journey:my-questions-updated' },
  });
  check(s5, { 'Step5:my-questions-updated 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
