/**
 * baseline.js — Single-user baseline latency measurement for Admin API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Fetches growth metrics and recent activities with admin authentication
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

const moduleFixtures = new SharedArray('admin-fixtures', function () {
  return [JSON.parse(open('../fixtures/admin-fixtures.json'))];
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
  const headers = getAuthHeaders(fixtures, 'admin', 0);

  const endpoints = [
    {
      tag: 'GET /admin/growth-metrics',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/admin/growth-metrics`, {
          headers,
          tags: { name: 'GET /admin/growth-metrics' },
        }),
    },
    {
      tag: 'GET /admin/recent-activities',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/admin/recent-activities`, {
          headers,
          tags: { name: 'GET /admin/recent-activities' },
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
