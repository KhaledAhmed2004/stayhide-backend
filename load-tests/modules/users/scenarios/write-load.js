/**
 * write-load.js — Concurrent write load test for Users API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent profile updates, email change requests,
 * and session revocations to test write throughput and consistency.
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

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // ── Step 1: Update own profile ──────────────────────────────────────────────
  const profilePayload = JSON.stringify({
    name: `LoadTest User ${__VU}-${Date.now()}`,
  });

  const profileRes = http.patch(
    `${BASE_URL}/api/v1/users/me`,
    profilePayload,
    { headers, tags: { name: 'PATCH /users/me' } },
  );
  check(profileRes, {
    'profile update 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);

  // ── Step 2: Request email change ────────────────────────────────────────────
  const emailChangePayload = JSON.stringify({
    newEmail: `loadtest-emailchange-${__VU}-${Date.now()}@test.com`,
    password: 'Test@1234',
  });

  const emailRes = http.post(
    `${BASE_URL}/api/v1/users/me/email-change/request`,
    emailChangePayload,
    { headers, tags: { name: 'POST /users/me/email-change/request' } },
  );
  check(emailRes, {
    'email change request 2xx or 4xx': r => r.status >= 200 && r.status < 500,
  });

  sleep(0.5);

  // ── Step 3: Revoke a session ────────────────────────────────────────────────
  // First list sessions to get a valid tokenId
  const sessionsRes = http.get(
    `${BASE_URL}/api/v1/users/me/sessions`,
    { headers, tags: { name: 'GET /users/me/sessions' } },
  );

  let tokenId = null;
  try {
    const body = JSON.parse(sessionsRes.body);
    const sessions = body.data?.sessions || body.data || [];
    if (Array.isArray(sessions) && sessions.length > 0) {
      // Pick a session based on VU index to spread revocations
      tokenId = sessions[vuIndex % sessions.length]._id || sessions[vuIndex % sessions.length].id;
    }
  } catch (_) {}

  if (tokenId) {
    const revokeRes = http.del(
      `${BASE_URL}/api/v1/users/me/sessions/${tokenId}`,
      null,
      { headers, tags: { name: 'DELETE /users/me/sessions/:tokenId' } },
    );
    check(revokeRes, {
      'session revoke 2xx or 4xx': r => r.status >= 200 && r.status < 500,
    });
  }

  sleep(1);
}
