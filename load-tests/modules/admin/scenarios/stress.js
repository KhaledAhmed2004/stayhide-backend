/**
 * stress.js — Stress test scenario for Admin API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs requesting dashboard metrics and recent activities concurrently.
 * Admin authentication required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('admin-fixtures', function () {
  return [JSON.parse(open('../fixtures/admin-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressProfile(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const headers = getAuthHeaders(fixtures, 'admin', 0);

  // GET /api/v1/admin/growth-metrics
  const r1 = http.get(`${BASE_URL}/api/v1/admin/growth-metrics`, {
    headers,
    tags: { name: 'GET /admin/growth-metrics' },
  });
  check(r1, { 'stress GET /admin/growth-metrics 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/admin/recent-activities
  const r2 = http.get(`${BASE_URL}/api/v1/admin/recent-activities`, {
    headers,
    tags: { name: 'GET /admin/recent-activities' },
  });
  check(r2, { 'stress GET /admin/recent-activities 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
