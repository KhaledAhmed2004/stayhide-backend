/**
 * role-auth.js — Role-based authorization enforcement under load (Users module)
 *
 * Executor: constant-vus, 5 VUs, 10s
 * Verifies that SUPER_ADMIN-only endpoints return 403 for non-admin users
 * under concurrent load — confirming auth middleware is not bypassed.
 *
 * Admin-only endpoints tested:
 *   - GET  /users          (list all users)
 *   - GET  /users/metrics  (get user metrics)
 *   - PATCH /users/:userId/review (review user)
 *   - PATCH /users/:userId (admin update user)
 *   - DELETE /users/:userId (admin delete user)
 *
 * Threshold: checks{scenario:"role_auth"} rate == 1.0
 * Any non-403 response increments authBypassCount and fails the threshold.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
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

// Counter incremented whenever an unauthorized request does NOT return 403
export const authBypassCount = new Counter('auth_bypass_count');

export const roleAuthScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '10s',
  exec: 'runRoleAuth',
};

export function runRoleAuth() {
  const vuIndex = __VU - 1;

  // BROTHER user attempting SUPER_ADMIN-only endpoints
  const brotherHeaders = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Use a target user ID for endpoints that require :userId
  const targetUserId = fixtures.brotherUsers[1]
    ? fixtures.brotherUsers[1].id
    : fixtures.brotherUsers[0].id;

  // ── Admin-only endpoints — all must return 403 for BROTHER user ─────────────
  const adminEndpoints = [
    {
      label: 'GET /users (list all)',
      res: http.get(
        `${BASE_URL}/api/v1/users`,
        { headers: brotherHeaders, tags: { name: 'auth:list-users' } },
      ),
    },
    {
      label: 'GET /users/metrics',
      res: http.get(
        `${BASE_URL}/api/v1/users/metrics`,
        { headers: brotherHeaders, tags: { name: 'auth:get-metrics' } },
      ),
    },
    {
      label: 'PATCH /users/:userId/review',
      res: http.patch(
        `${BASE_URL}/api/v1/users/${targetUserId}/review`,
        JSON.stringify({ status: 'APPROVED' }),
        { headers: brotherHeaders, tags: { name: 'auth:review-user' } },
      ),
    },
    {
      label: 'PATCH /users/:userId (admin update)',
      res: http.patch(
        `${BASE_URL}/api/v1/users/${targetUserId}`,
        JSON.stringify({ role: 'BROTHER' }),
        { headers: brotherHeaders, tags: { name: 'auth:admin-update-user' } },
      ),
    },
    {
      label: 'DELETE /users/:userId (admin delete)',
      res: http.del(
        `${BASE_URL}/api/v1/users/${targetUserId}`,
        null,
        { headers: brotherHeaders, tags: { name: 'auth:admin-delete-user' } },
      ),
    },
  ];

  for (const ep of adminEndpoints) {
    const ok = check(ep.res, {
      [`${ep.label} → 403`]: r => r.status === 403,
    });
    if (!ok) {
      authBypassCount.add(1);
      const body = ep.res.body ? ep.res.body.substring(0, 500) : '(empty)';
      console.error(
        `[role-auth] AUTH BYPASS DETECTED: ${ep.label} returned ${ep.res.status} | body=${body}`,
      );
    }
  }

  // ── Verify admin tokens ARE accepted for the same endpoints ─────────────────
  const adminHeaders = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  const adminAcceptEndpoints = [
    {
      label: 'GET /users (admin)',
      res: http.get(
        `${BASE_URL}/api/v1/users`,
        { headers: adminHeaders, tags: { name: 'auth:admin-list-users' } },
      ),
    },
    {
      label: 'GET /users/metrics (admin)',
      res: http.get(
        `${BASE_URL}/api/v1/users/metrics`,
        { headers: adminHeaders, tags: { name: 'auth:admin-get-metrics' } },
      ),
    },
  ];

  for (const ep of adminAcceptEndpoints) {
    const ok = check(ep.res, {
      [`${ep.label} → 2xx`]: r => r.status >= 200 && r.status < 300,
    });
    if (!ok) {
      console.error(
        `[role-auth] ADMIN REJECTED: ${ep.label} returned ${ep.res.status}`,
      );
    }
  }

  sleep(0.5);
}
