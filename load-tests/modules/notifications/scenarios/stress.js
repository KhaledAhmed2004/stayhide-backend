/**
 * stress.js — Stress test scenario for Notifications API
 *
 * Executor: ramping-vus, progressive VU increase to find throughput limits.
 * Ramps VUs performing concurrent notification fetches and mark-as-read
 * operations to identify the point where response times degrade
 * and error rates increase.
 * Uses pre-seeded fixture data for notifications.
 *
 * Run: k6 run --out web-dashboard load-tests/modules/notifications/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/notifications/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getStressStages, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('notifications-fixtures', function () {
  return [JSON.parse(open('../fixtures/notifications-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getStressStages(__ENV.STRESS_PROFILE),
      exec: 'runStress',
    },
  },
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<1000', abortOnFail: false },
      { threshold: 'p(95)<2000', abortOnFail: false },
      { threshold: 'p(99)<5000', abortOnFail: false },
    ],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressStages(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Distribute across own notifications only to avoid 403 ownership errors
  const vuUserId = fixtures.brotherUsers[vuIndex % fixtures.brotherUsers.length]?.id;
  const ownedNotifs = fixtures.notifications.filter(n => n.userId === vuUserId);
  const notification = ownedNotifs.length > 0
    ? ownedNotifs[(vuIndex + __ITER) % ownedNotifs.length]
    : fixtures.notifications[vuIndex % fixtures.notifications.length];

  // ── Operation 1: Fetch notifications list ───────────────────────────────────
  const listRes = http.get(`${BASE_URL}/api/v1/notifications/me`, {
    headers,
    tags: { name: 'GET /notifications/me' },
  });
  check(listRes, {
    'GET /notifications/me 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 2: Mark a single notification as read ─────────────────────────
  const markRes = http.patch(
    `${BASE_URL}/api/v1/notifications/${notification.notificationId}/read`,
    null,
    { headers, tags: { name: 'PATCH /notifications/:id/read' } },
  );
  check(markRes, {
    'PATCH /notifications/:id/read 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 3: Fetch notifications again (post-mark) ──────────────────────
  const listRes2 = http.get(`${BASE_URL}/api/v1/notifications/me`, {
    headers,
    tags: { name: 'GET /notifications/me (post-mark)' },
  });
  check(listRes2, {
    'GET /notifications/me (post-mark) 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 4: Mark all notifications as read ─────────────────────────────
  const markAllRes = http.patch(
    `${BASE_URL}/api/v1/notifications/read-all`,
    null,
    { headers, tags: { name: 'PATCH /notifications/read-all' } },
  );
  check(markAllRes, {
    'PATCH /notifications/read-all 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}

export default runStress;

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
