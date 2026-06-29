/**
 * baseline.js — Single-user baseline latency measurement for Ask-Question API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Submits a question as a user, retrieves the user's questions,
 * and verifies successful responses under zero concurrency.
 */

import http from 'k6/http';
import { check } from 'k6';
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

export const baselineScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 1,
  exec: 'runBaseline',
};

export function runBaseline() {
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', 0),
    'Content-Type': 'application/json',
  };

  const endpoints = [
    {
      tag: 'POST /ask-question',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/ask-question`,
          JSON.stringify({ question: 'Baseline load test question - How to perform Wudu?' }),
          { headers, tags: { name: 'POST /ask-question' } },
        ),
    },
    {
      tag: 'GET /ask-question/my-questions',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/ask-question/my-questions`, {
          headers,
          tags: { name: 'GET /ask-question/my-questions' },
        }),
    },
  ];

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });
    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }
}
