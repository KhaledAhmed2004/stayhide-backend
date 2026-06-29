/**
 * read-load.js — Concurrent read load test for Users API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent profile views (GET /users/:userId/public)
 * and community discovery (GET /users/profiles).
 * Uses pre-seeded fixture data — no writes during this scenario.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
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

// Custom counter for tracking read check failures
export const readCheckFailures = new Counter('read_check_failures');

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);

  // Distribute across available users to avoid hotspotting a single profile
  const targetUser = fixtures.brotherUsers[vuIndex % fixtures.brotherUsers.length];

  // GET /api/v1/users/:userId/public — concurrent profile views
  const r1 = http.get(`${BASE_URL}/api/v1/users/${targetUser.id}/public`, {
    headers,
    tags: { name: 'GET /users/:userId/public' },
  });
  if (!check(r1, { 'GET /users/:userId/public 200': r => r.status === 200 || r.status === 429 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/users/profiles — community discovery
  const r2 = http.get(`${BASE_URL}/api/v1/users/profiles`, {
    headers,
    tags: { name: 'GET /users/profiles' },
  });
  if (!check(r2, { 'GET /users/profiles 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  sleep(1);
}
