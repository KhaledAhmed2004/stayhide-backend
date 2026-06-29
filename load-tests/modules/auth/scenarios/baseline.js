/**
 * baseline.js — Single-user baseline latency measurement for Auth API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Exercises the login endpoint with valid credentials from fixtures
 * and verifies a successful token response under zero concurrency
 * to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
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

  // Use a test account from auth fixtures for login
  const testAccount = fixtures.testAccounts[0];

  const endpoints = [
    {
      tag: 'POST /auth/login',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/auth/login`,
          JSON.stringify({
            email: testAccount.email,
            password: testAccount.password,
          }),
          { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /auth/login' } },
        ),
    },
    {
      tag: 'POST /auth/refresh-token',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/auth/refresh-token`,
          JSON.stringify({ refreshToken: fixtures.refreshTokens[0] }),
          { headers, tags: { name: 'POST /auth/refresh-token' } },
        ),
    },
    {
      tag: 'POST /auth/logout',
      fn: () =>
        http.post(`${BASE_URL}/api/v1/auth/logout`, null, {
          headers,
          tags: { name: 'POST /auth/logout' },
        }),
    },
  ];

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });

    // For login, additionally verify token is present in response
    if (ep.tag === 'POST /auth/login') {
      const body = res.json();
      check(body, {
        'login returns accessToken': b =>
          b && b.data && typeof b.data.accessToken === 'string' && b.data.accessToken.length > 0,
      });
    }

    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }
}
