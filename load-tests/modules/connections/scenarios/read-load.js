/**
 * read-load.js — Concurrent read load test for Connections API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Tests GET endpoints under concurrent read traffic.
 * Simulates concurrent users fetching connection lists and pending requests.
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

const moduleFixtures = new SharedArray('connections-fixtures', function () {
  return [JSON.parse(open('../fixtures/connections-fixtures.json'))];
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

  // GET /api/v1/connections (list my accepted connections)
  const r1 = http.get(`${BASE_URL}/api/v1/connections`, {
    headers,
    tags: { name: 'GET /connections' },
  });
  if (!check(r1, { 'GET /connections 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/connections/requests (list pending requests)
  const r2 = http.get(`${BASE_URL}/api/v1/connections/requests`, {
    headers,
    tags: { name: 'GET /connections/requests' },
  });
  if (!check(r2, { 'GET /connections/requests 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  sleep(1);
}
