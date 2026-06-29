/**
 * user-journey.js — Full user journey scenario for Auth API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates a complete authentication flow:
 *   login → receive token → refresh token → change password → logout
 *
 * Each VU uses a different test account (round-robin) to avoid
 * rate-limit interference across concurrent virtual users.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
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

  // Each VU uses a different test account to avoid rate-limit collisions
  const account = fixtures.testAccounts[vuIndex % fixtures.testAccounts.length];

  const jsonHeaders = { 'Content-Type': 'application/json' };

  // ── Step 1: Login — obtain access token and refresh token ───────────────────
  const s1 = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: account.email,
      password: account.password,
    }),
    { headers: jsonHeaders, tags: { name: 'journey:login' } },
  );
  const loginOk = step('Step1:login', s1);

  // Extract tokens from login response
  let accessToken = null;
  let refreshToken = null;
  if (loginOk) {
    try {
      const body = JSON.parse(s1.body);
      accessToken = body?.data?.accessToken || null;
      refreshToken = body?.data?.refreshToken || null;
    } catch (_) {}
  }

  // Fallback to fixture tokens if login extraction fails
  if (!accessToken) {
    const authHeaders = getAuthHeaders(fixtures, 'brother', vuIndex);
    accessToken = authHeaders['Authorization']
      ? authHeaders['Authorization'].replace('Bearer ', '')
      : null;
  }
  if (!refreshToken && fixtures.refreshTokens && fixtures.refreshTokens.length > 0) {
    refreshToken = fixtures.refreshTokens[vuIndex % fixtures.refreshTokens.length];
  }

  const authHeaders = {
    ...jsonHeaders,
    Authorization: `Bearer ${accessToken}`,
  };

  sleep(1);

  // ── Step 2: Refresh token — renew access token using refresh token ──────────
  const s2 = http.post(
    `${BASE_URL}/api/v1/auth/refresh-token`,
    JSON.stringify({ refreshToken }),
    { headers: authHeaders, tags: { name: 'journey:refresh-token' } },
  );
  const refreshOk = step('Step2:refresh-token', s2);

  // Update access token if refresh succeeded
  if (refreshOk) {
    try {
      const body = JSON.parse(s2.body);
      const newToken = body?.data?.accessToken || null;
      if (newToken) {
        accessToken = newToken;
        authHeaders['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch (_) {}
  }

  sleep(1);

  // ── Step 3: Change password — update password using current credentials ─────
  const newPassword = `NewPass${Date.now()}!`;
  const s3 = http.post(
    `${BASE_URL}/api/v1/auth/change-password`,
    JSON.stringify({
      currentPassword: account.password,
      newPassword,
      confirmPassword: newPassword,
    }),
    { headers: authHeaders, tags: { name: 'journey:change-password' } },
  );
  step('Step3:change-password', s3);

  sleep(1);

  // ── Step 4: Logout — invalidate session ─────────────────────────────────────
  const s4 = http.post(
    `${BASE_URL}/api/v1/auth/logout`,
    null,
    { headers: authHeaders, tags: { name: 'journey:logout' } },
  );
  step('Step4:logout', s4);

  sleep(1);
}
