/**
 * write-load.js — Concurrent write load test for Notifications
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates admin broadcasting notifications followed by concurrent
 * mark-as-read operations from multiple VUs.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
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

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;

  // ── Step 1: Admin broadcasts a notification ─────────────────────────────────
  const adminHeaders = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  const broadcastRes = http.post(
    `${BASE_URL}/api/v1/notifications/broadcasts`,
    JSON.stringify({
      title: `loadtest-broadcast-${__VU}-${Date.now()}`,
      text: `Write-load broadcast from VU ${__VU} at ${Date.now()}`,
      audience: 'ALL',
    }),
    { headers: adminHeaders, tags: { name: 'POST /notifications/broadcasts' } },
  );
  check(broadcastRes, {
    'broadcast 2xx': r => r.status >= 200 && r.status < 300,
  });

  // ── Step 2: Concurrent mark-as-read on own notifications ──────────────────
  const userHeaders = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Each VU targets only notifications belonging to their own user
  const vuUserId = fixtures.brotherUsers[vuIndex % fixtures.brotherUsers.length]?.id;
  const ownedNotifs = fixtures.notifications.filter(n => n.userId === vuUserId);
  const notification = ownedNotifs.length > 0
    ? ownedNotifs[__ITER % ownedNotifs.length]
    : fixtures.notifications[vuIndex % fixtures.notifications.length];

  const markReadRes = http.patch(
    `${BASE_URL}/api/v1/notifications/${notification.notificationId}/read`,
    null,
    { headers: userHeaders, tags: { name: 'PATCH /notifications/:id/read' } },
  );
  check(markReadRes, {
    'mark-as-read 2xx': r => r.status >= 200 && r.status < 300,
  });

  // ── Step 3: Mark all as read ────────────────────────────────────────────────
  const markAllRes = http.patch(
    `${BASE_URL}/api/v1/notifications/read-all`,
    null,
    { headers: userHeaders, tags: { name: 'PATCH /notifications/read-all' } },
  );
  check(markAllRes, {
    'mark-all-read 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
