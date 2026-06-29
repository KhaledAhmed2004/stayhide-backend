/**
 * rate-limit.js — Rate-limit validation scenario for Auth API
 *
 * Executor: per-vu-iterations, 1 VU, 15 iterations
 * Intentionally exceeds configured rate limits from a single source
 * and asserts HTTP 429 responses are returned within the configured window.
 *
 * Rate limits under test:
 *   - Login: 10 req/min per IP
 *   - Password-reset (forgot-password): 5 req/min per IP
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

// Rate limit thresholds (from server configuration)
const LOGIN_RATE_LIMIT = 10; // 10 req/min
const PASSWORD_RESET_RATE_LIMIT = 5; // 5 req/min

export const rateLimitScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 15,
  exec: 'runRateLimit',
};

export function runRateLimit() {
  const headers = { 'Content-Type': 'application/json' };
  const testAccount = fixtures.testAccounts[0];

  // ── Test 1: Login rate limit (10 req/min) ─────────────────────────────────
  // Send requests rapidly to exceed the 10 req/min login limit.
  // After 10 requests, subsequent ones should receive HTTP 429.
  const loginResults = [];
  for (let i = 0; i < LOGIN_RATE_LIMIT + 2; i++) {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: testAccount.email,
        password: testAccount.password,
      }),
      { headers, tags: { name: 'POST /auth/login (rate-limit)' } },
    );
    loginResults.push(res);
  }

  // Assert that at least one response after the limit is HTTP 429
  const loginRateLimited = loginResults.slice(LOGIN_RATE_LIMIT);
  const loginHas429 = loginRateLimited.some(r => r.status === 429);

  check(null, {
    'login: HTTP 429 returned after exceeding 10 req/min': () => loginHas429,
  });

  if (loginHas429) {
    console.log(
      `[rate-limit] Login rate limit triggered correctly — 429 received after ${LOGIN_RATE_LIMIT} requests`,
    );
  } else {
    console.log(
      `[rate-limit] ⚠ Login rate limit NOT triggered — expected 429 after ${LOGIN_RATE_LIMIT} requests`,
    );
  }

  // ── Test 2: Password-reset rate limit (5 req/min) ─────────────────────────
  // Send requests rapidly to exceed the 5 req/min forgot-password limit.
  // After 5 requests, subsequent ones should receive HTTP 429.
  const resetResults = [];
  for (let i = 0; i < PASSWORD_RESET_RATE_LIMIT + 2; i++) {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/forgot-password`,
      JSON.stringify({
        email: testAccount.email,
      }),
      { headers, tags: { name: 'POST /auth/forgot-password (rate-limit)' } },
    );
    resetResults.push(res);
  }

  // Assert that at least one response after the limit is HTTP 429
  const resetRateLimited = resetResults.slice(PASSWORD_RESET_RATE_LIMIT);
  const resetHas429 = resetRateLimited.some(r => r.status === 429);

  check(null, {
    'forgot-password: HTTP 429 returned after exceeding 5 req/min': () => resetHas429,
  });

  if (resetHas429) {
    console.log(
      `[rate-limit] Password-reset rate limit triggered correctly — 429 received after ${PASSWORD_RESET_RATE_LIMIT} requests`,
    );
  } else {
    console.log(
      `[rate-limit] ⚠ Password-reset rate limit NOT triggered — expected 429 after ${PASSWORD_RESET_RATE_LIMIT} requests`,
    );
  }
}
