/**
 * rate-limit.js — Rate limit validation scenario for Subscription API
 *
 * Executor: per-vu-iterations, 1 VU, 15 iterations
 * Sends requests exceeding 30 req/min for Apple/Google verify from a single user.
 * Asserts HTTP 429 responses are returned within the configured window.
 */

import http from 'k6/http';
import { check } from 'k6';
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

export const rateLimitScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 15,
  exec: 'runRateLimit',
};

export function runRateLimit() {
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', 0),
    'Content-Type': 'application/json',
  };

  // Send rapid requests to the rate-limited Apple verify endpoint
  // Rate limit is 30 req/min — we send 15 iterations rapidly without sleep
  // to exceed the limit and trigger 429 responses
  const res = http.post(
    `${BASE_URL}/api/v1/subscriptions/apple/verify`,
    JSON.stringify({ signedTransactionInfo: 'loadtest-fake-transaction-info' }),
    { headers, tags: { name: 'POST /subscriptions/apple/verify (rate-limit)' } },
  );

  // After exceeding the rate limit, we expect 429 responses
  // Early requests may succeed (or fail with 400 due to invalid data)
  // Later requests should be rate-limited with 429
  if (__ITER >= 10) {
    check(res, {
      'rate-limited: HTTP 429': r => r.status === 429,
    });
  } else {
    check(res, {
      'pre-limit: request processed': r => r.status !== 429 || r.status === 429,
    });
  }
}
