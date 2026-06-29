/**
 * baseline.js — Single-user baseline latency measurement for Users API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Exercises key user endpoints (own profile, public profile, sessions)
 * under zero concurrency to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('users-fixtures', function () {
  return [JSON.parse(open('../fixtures/users-fixtures.json'))];
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

  // Use a second user's ID for the public profile lookup
  const publicUserId = fixtures.brotherUsers[1].id;

  const endpoints = [
    {
      tag: 'GET /users/me',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/users/me`, {
          headers,
          tags: { name: 'GET /users/me' },
        }),
    },
    {
      tag: 'GET /users/:userId/public',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/users/${publicUserId}/public`, {
          headers,
          tags: { name: 'GET /users/:userId/public' },
        }),
    },
    {
      tag: 'GET /users/me/sessions',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/users/me/sessions`, {
          headers,
          tags: { name: 'GET /users/me/sessions' },
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
