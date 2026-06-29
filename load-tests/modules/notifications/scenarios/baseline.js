/**
 * baseline.js — Single-user baseline latency measurement
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Measures response time for each of the key Notification API endpoints
 * under zero concurrency to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('notifications-fixtures', function () {
  return [JSON.parse(open('../fixtures/notifications-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';

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
  const notificationId = fixtures.notifications[0].notificationId;

  const endpoints = [
    {
      tag: 'GET /notifications/me',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/notifications/me`, {
          headers,
          tags: { name: 'GET /notifications/me' },
        }),
    },
    {
      tag: 'PATCH /notifications/:id/read',
      fn: () =>
        http.patch(
          `${BASE_URL}/api/v1/notifications/${notificationId}/read`,
          null,
          { headers, tags: { name: 'PATCH /notifications/:id/read' } },
        ),
    },
    {
      tag: 'PATCH /notifications/read-all',
      fn: () =>
        http.patch(`${BASE_URL}/api/v1/notifications/read-all`, null, {
          headers,
          tags: { name: 'PATCH /notifications/read-all' },
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
