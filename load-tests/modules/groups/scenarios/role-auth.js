/**
 * role-auth.js — Role-based authorization enforcement under load
 *
 * Executor: constant-vus, 20 VUs, 10s
 * Verifies that SUPER_ADMIN-only endpoints return 403 for BROTHER users
 * under concurrent load — confirming auth middleware is not bypassed.
 *
 * Threshold: checks{scenario:"role_auth"} rate == 1.0
 * Any non-403 response increments authBypassCount and fails the threshold.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';

// Counter incremented whenever an unauthorized request does NOT return 403
export const authBypassCount = new Counter('auth_bypass_count');

export const roleAuthScenario = {
  executor: 'constant-vus',
  vus: 20,
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

  // SISTER user attempting BROTHER-typed group endpoint
  const sisterHeaders = {
    ...getAuthHeaders(fixtures, 'sister', vuIndex),
    'Content-Type': 'application/json',
  };

  const groupId = fixtures.brotherGroups[0].id;
  const postId = fixtures.posts[0].id;
  const userId = fixtures.brotherUsers[0].id;

  // ── Admin-only endpoints — all must return 403 for BROTHER user ─────────────
  const adminEndpoints = [
    {
      label: 'POST /groups (create)',
      res: http.post(
        `${BASE_URL}/api/v1/groups`,
        JSON.stringify({
          name: 'auth-test-group',
          description: 'auth test',
          userType: 'BROTHER',
          category: 'auth-test',
        }),
        { headers: brotherHeaders, tags: { name: 'auth:create-group' } },
      ),
    },
    {
      label: 'PATCH /groups/:id (update)',
      res: http.patch(
        `${BASE_URL}/api/v1/groups/${groupId}`,
        JSON.stringify({ name: 'auth-test-update' }),
        { headers: brotherHeaders, tags: { name: 'auth:update-group' } },
      ),
    },
    {
      label: 'DELETE /groups/:id (delete)',
      res: http.del(
        `${BASE_URL}/api/v1/groups/${groupId}`,
        null,
        { headers: brotherHeaders, tags: { name: 'auth:delete-group' } },
      ),
    },
    {
      label: 'DELETE /groups/:id/members/:uid (kick)',
      res: http.del(
        `${BASE_URL}/api/v1/groups/${groupId}/members/${userId}`,
        null,
        { headers: brotherHeaders, tags: { name: 'auth:kick-member' } },
      ),
    },
    {
      label: 'PATCH /posts/:id/pin (pin)',
      res: http.patch(
        `${BASE_URL}/api/v1/groups/posts/${postId}/pin`,
        null,
        { headers: brotherHeaders, tags: { name: 'auth:pin-post' } },
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

  // ── SISTER user on BROTHER-typed group — must return 403 ───────────────────
  const sisterOnBrotherGroup = http.get(
    `${BASE_URL}/api/v1/groups/${groupId}`,
    { headers: sisterHeaders, tags: { name: 'auth:sister-on-brother-group' } },
  );
  const sisterOk = check(sisterOnBrotherGroup, {
    'sister on brother group → 403': r => r.status === 403,
  });
  if (!sisterOk) {
    authBypassCount.add(1);
    console.error(
      `[role-auth] SISTER accessed BROTHER group: status=${sisterOnBrotherGroup.status}`,
    );
  }

  sleep(0.5);
}
