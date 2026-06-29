/**
 * read-load.js — Concurrent read load test for Admin API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates multiple admin users refreshing the dashboard simultaneously.
 * Admin authentication required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('admin-fixtures', function () {
  return [JSON.parse(open('../fixtures/admin-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const headers = getAuthHeaders(fixtures, 'admin', 0);

  // Simulate dashboard refresh — both metrics and activities
  const r1 = http.get(`${BASE_URL}/api/v1/admin/growth-metrics`, {
    headers,
    tags: { name: 'GET /admin/growth-metrics' },
  });
  check(r1, { 'GET /admin/growth-metrics 2xx': r => r.status >= 200 && r.status < 300 });

  const r2 = http.get(`${BASE_URL}/api/v1/admin/recent-activities`, {
    headers,
    tags: { name: 'GET /admin/recent-activities' },
  });
  check(r2, { 'GET /admin/recent-activities 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
