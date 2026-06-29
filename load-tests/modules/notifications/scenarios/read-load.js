/**
 * read-load.js — Concurrent read load test for Notifications API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Tests GET endpoints under concurrent read traffic.
 * Simulates concurrent users fetching notification lists to test
 * pagination and query performance under load.
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

const moduleFixtures = new SharedArray('notifications-fixtures', function () {
  return [JSON.parse(open('../fixtures/notifications-fixtures.json'))];
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

  // GET /api/v1/notifications/me (fetch notification list — page 1)
  const r1 = http.get(`${BASE_URL}/api/v1/notifications/me?page=1&limit=20`, {
    headers,
    tags: { name: 'GET /notifications/me?page=1' },
  });
  if (!check(r1, { 'GET /notifications/me page 1 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/notifications/me (fetch notification list — page 2, tests pagination)
  const r2 = http.get(`${BASE_URL}/api/v1/notifications/me?page=2&limit=20`, {
    headers,
    tags: { name: 'GET /notifications/me?page=2' },
  });
  if (!check(r2, { 'GET /notifications/me page 2 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  sleep(1);
}
