/**
 * spike.js — Spike test for Notifications API
 *
 * Executor: ramping-vus
 * Stages: 0→3 VUs (5s ramp_up) → 3→20 VUs (10s peak) → 20→3 VUs (5s recovery)
 *
 * Simulates a broadcast event where all VUs simultaneously fetch their
 * notifications after a broadcast is sent, testing the read amplification
 * pattern. When a single broadcast creates N notifications (one per user),
 * all N users hit the GET endpoint concurrently — this is the "thundering herd"
 * scenario that stresses database read paths.
 *
 * Requests are tagged with stage name for per-stage metric analysis.
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

export const spikeScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5s', target: 3 },   // ramp_up
    { duration: '10s', target: 20 }, // peak — all users fetching after broadcast
    { duration: '5s', target: 3 },   // recovery
  ],
  exec: 'runSpike',
};

/**
 * Approximate stage tag based on iteration count.
 * ramp_up: first few iterations, peak: middle, recovery: later.
 * Note: __ITER is per-VU, so this is an approximation.
 */
function getStageTag() {
  if (__ITER < 3) return 'ramp_up';
  if (__ITER < 12) return 'peak';
  return 'recovery';
}

export function runSpike() {
  const vuIndex = __VU - 1;
  const stage = getStageTag();

  // Step 1: Admin sends a broadcast notification (simulates the trigger event)
  // Only the first VU in each iteration triggers the broadcast to simulate
  // a single event causing read amplification across all users.
  if (vuIndex === 0 && __ITER % 5 === 0) {
    const adminHeaders = {
      ...getAuthHeaders(fixtures, 'admin', 0),
      'Content-Type': 'application/json',
    };
    const broadcastRes = http.post(
      `${BASE_URL}/api/v1/notifications/broadcasts`,
      JSON.stringify({
        title: `spike-broadcast-${Date.now()}`,
        text: `Load test broadcast spike iteration ${__ITER}`,
        audience: 'ALL',
      }),
      { headers: adminHeaders, tags: { name: 'POST /notifications/broadcasts', stage } },
    );
    check(broadcastRes, {
      'spike broadcast 2xx': r => r.status >= 200 && r.status < 300,
    });
  }

  // Step 2: All VUs simultaneously fetch their notifications (read amplification)
  // This is the core of the spike test — every user hits the read endpoint
  // concurrently after a broadcast event.
  const userHeaders = getAuthHeaders(fixtures, 'brother', vuIndex);
  const fetchRes = http.get(`${BASE_URL}/api/v1/notifications/me`, {
    headers: userHeaders,
    tags: { name: 'GET /notifications/me', stage },
  });
  const fetchOk = check(fetchRes, {
    'spike GET /notifications/me 2xx': r => r.status >= 200 && r.status < 300,
  });

  // Verify response contains notification data
  if (fetchOk) {
    const body = fetchRes.json();
    check(body, {
      'notifications array returned': b =>
        b && (Array.isArray(b.data) || Array.isArray(b.notifications)),
    });
  }

  // Step 3: Some VUs mark notifications as read (simulates user interaction after fetch)
  // Uses notifications that belong to this VU's user to avoid 403 errors.
  if (__ITER % 3 === 0 && fixtures.notifications && fixtures.notifications.length > 0) {
    // Find a notification owned by this VU's user
    const vuUserId = fixtures.brotherUsers[vuIndex % fixtures.brotherUsers.length]?.id;
    const ownedNotifs = fixtures.notifications.filter(n => n.userId === vuUserId);
    const notif = ownedNotifs.length > 0
      ? ownedNotifs[__ITER % ownedNotifs.length]
      : fixtures.notifications[vuIndex % fixtures.notifications.length];
    const notificationId = notif.notificationId;
    const markRes = http.patch(
      `${BASE_URL}/api/v1/notifications/${notificationId}/read`,
      null,
      { headers: userHeaders, tags: { name: 'PATCH /notifications/:id/read', stage } },
    );
    check(markRes, {
      'spike PATCH mark-read 2xx': r => r.status >= 200 && r.status < 300,
    });
  }

  // Minimal sleep to allow k6 to measure response times accurately
  sleep(0.1);
}
