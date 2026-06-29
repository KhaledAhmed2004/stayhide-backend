/**
 * write-load.js — Concurrent write load test for Ask-Question API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent question submissions from multiple VUs.
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

  // POST /api/v1/ask-question — submit a question
  const res = http.post(
    `${BASE_URL}/api/v1/ask-question`,
    JSON.stringify({ question: `Load test question VU${__VU} iter${__ITER} - ${Date.now()}` }),
    { headers, tags: { name: 'POST /ask-question' } },
  );

  check(res, {
    'POST /ask-question 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
