/**
 * stress.js — Stress test scenario for Ask-Question API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed read and write operations across user and admin endpoints.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('ask-question-fixtures', function () {
  return [JSON.parse(open('../fixtures/ask-question-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressProfile(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;

  // Mix read and write operations
  if (__ITER % 3 === 0) {
    // Write: submit a question
    const headers = {
      ...getAuthHeaders(fixtures, 'brother', vuIndex),
      'Content-Type': 'application/json',
    };
    const res = http.post(
      `${BASE_URL}/api/v1/ask-question`,
      JSON.stringify({ question: `Stress question VU${__VU} iter${__ITER}` }),
      { headers, tags: { name: 'POST /ask-question' } },
    );
    check(res, { 'stress POST /ask-question 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (__ITER % 3 === 1) {
    // Read: user fetches my questions
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/ask-question/my-questions`, {
      headers,
      tags: { name: 'GET /ask-question/my-questions' },
    });
    check(res, { 'stress GET /my-questions 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Read: admin lists all questions
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/ask-question`, {
      headers,
      tags: { name: 'GET /ask-question (admin)' },
    });
    check(res, { 'stress GET /ask-question 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
