/**
 * user-journey.js — Full user journey scenario for Notifications API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates a complete notification lifecycle:
 * admin sends broadcast → users fetch notifications → mark individual as read → mark all as read.
 *
 * The admin VU sends a broadcast, then each user VU fetches their notifications,
 * marks one as read, and finally marks all as read.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

/**
 * Execute a single journey step, check the response, and log on failure.
 * @param {string} name - Step label for logging and check tag
 * @param {object|null} res - k6 HTTP response (null if request was skipped)
 * @returns {boolean} true if step succeeded (2xx)
 */
function step(name, res) {
  if (!res) {
    console.error(`[journey] VU${__VU}: ${name} — no response (request skipped)`);
    check(null, { [`${name} 2xx`]: () => false });
    return false;
  }
  const ok = check(res, {
    [`${name} 2xx`]: r => r && r.status >= 200 && r.status < 300,
  });
  if (!ok) {
    const body = res.body ? res.body.substring(0, 500) : '(empty)';
    console.error(
      `[journey] VU${__VU}: ${name} FAILED | status=${res.status} | body=${body}`,
    );
  }
  return ok;
}

export function runUserJourney() {
  const vuIndex = __VU - 1;

  // Admin headers for broadcast step
  const adminHeaders = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  // User headers for notification consumption steps
  const userHeaders = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // ── Step 1: Admin sends broadcast notification ──────────────────────────────
  const s1 = http.post(
    `${BASE_URL}/api/v1/notifications/broadcasts`,
    JSON.stringify({
      title: `loadtest-journey-broadcast-VU${__VU}-${Date.now()}`,
      text: `Journey broadcast from VU${__VU} at ${new Date().toISOString()}`,
      type: 'ADMIN',
    }),
    { headers: adminHeaders, tags: { name: 'journey:send-broadcast' } },
  );
  step('Step1:send-broadcast', s1);
  sleep(1);

  // ── Step 2: User fetches notifications ──────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/notifications/me`, {
    headers: userHeaders,
    tags: { name: 'journey:fetch-notifications' },
  });
  const s2Ok = step('Step2:fetch-notifications', s2);

  // Extract a notification ID from the response for the mark-as-read step
  let notificationId = null;
  if (s2Ok) {
    try {
      const body = JSON.parse(s2.body);
      const notificationsList =
        body?.data?.notifications || body?.data || body?.notifications || [];
      if (Array.isArray(notificationsList) && notificationsList.length > 0) {
        notificationId =
          notificationsList[0]._id || notificationsList[0].id || notificationsList[0].notificationId;
      }
    } catch (_) {}
  }

  // Fallback to fixture notification if extraction failed
  if (!notificationId && fixtures.notifications && fixtures.notifications.length > 0) {
    notificationId = fixtures.notifications[vuIndex % fixtures.notifications.length].notificationId;
  }
  sleep(1);

  // ── Step 3: Mark individual notification as read ────────────────────────────
  if (notificationId) {
    const s3 = http.patch(
      `${BASE_URL}/api/v1/notifications/${notificationId}/read`,
      null,
      { headers: userHeaders, tags: { name: 'journey:mark-read' } },
    );
    step('Step3:mark-read', s3);
  } else {
    console.error(
      `[journey] VU${__VU}: Step3 skipped — no notificationId available`,
    );
    check(null, { ['Step3:mark-read 2xx']: () => false });
  }
  sleep(1);

  // ── Step 4: Mark all notifications as read ──────────────────────────────────
  const s4 = http.patch(`${BASE_URL}/api/v1/notifications/read-all`, null, {
    headers: userHeaders,
    tags: { name: 'journey:mark-all-read' },
  });
  step('Step4:mark-all-read', s4);
  sleep(1);
}
