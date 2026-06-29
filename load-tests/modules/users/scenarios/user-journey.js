/**
 * user-journey.js — Full user journey scenario for Users API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates a complete user self-management flow:
 *   view profile → update profile → list sessions → revoke session → request data export
 *
 * Each VU uses a different user account (round-robin) to avoid conflicts.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('users-fixtures', function () {
  return [JSON.parse(open('../fixtures/users-fixtures.json'))];
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
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // ── Step 1: View own profile ────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/users/me`, {
    headers,
    tags: { name: 'journey:view-profile' },
  });
  step('Step1:view-profile', s1);
  sleep(1);

  // ── Step 2: Update profile ──────────────────────────────────────────────────
  const s2 = http.patch(
    `${BASE_URL}/api/v1/users/me`,
    JSON.stringify({ name: `Journey User ${__VU}-${Date.now()}` }),
    { headers, tags: { name: 'journey:update-profile' } },
  );
  step('Step2:update-profile', s2);
  sleep(1);

  // ── Step 3: List sessions ───────────────────────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/users/me/sessions`, {
    headers,
    tags: { name: 'journey:list-sessions' },
  });
  const sessionsOk = step('Step3:list-sessions', s3);

  // Extract a session ID for revocation
  let tokenId = null;
  if (sessionsOk) {
    try {
      const body = JSON.parse(s3.body);
      const sessions = body.data?.sessions || body.data || [];
      if (Array.isArray(sessions) && sessions.length > 0) {
        // Pick a session based on VU index to spread revocations
        tokenId = sessions[vuIndex % sessions.length]._id || sessions[vuIndex % sessions.length].id;
      }
    } catch (_) {}
  }
  sleep(1);

  // ── Step 4: Revoke a session ────────────────────────────────────────────────
  if (tokenId) {
    const s4 = http.del(
      `${BASE_URL}/api/v1/users/me/sessions/${tokenId}`,
      null,
      { headers, tags: { name: 'journey:revoke-session' } },
    );
    step('Step4:revoke-session', s4);
  } else {
    // If no session found, skip but log
    console.warn(`[journey] VU${__VU}: Step4:revoke-session — no tokenId available, skipping`);
  }
  sleep(1);

  // ── Step 5: Request data export ─────────────────────────────────────────────
  const s5 = http.post(
    `${BASE_URL}/api/v1/users/me/data-export`,
    null,
    { headers, tags: { name: 'journey:data-export' } },
  );
  step('Step5:data-export', s5);
  sleep(1);
}
