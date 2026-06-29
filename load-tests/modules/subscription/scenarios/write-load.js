/**
 * write-load.js — Concurrent write load test for Subscription API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent free plan selections (uses choose/free endpoint, not rate-limited).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('subscription-fixtures', function () {
  return [JSON.parse(open('../fixtures/subscription-fixtures.json'))];
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

  // POST /api/v1/subscriptions/choose/free — select free plan (not rate-limited)
  const res = http.post(
    `${BASE_URL}/api/v1/subscriptions/choose/free`,
    null,
    { headers, tags: { name: 'POST /subscriptions/choose/free' } },
  );

  check(res, {
    'POST /subscriptions/choose/free 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
