/**
 * read-load.js — Concurrent read load test
 *
 * Executor: constant-vus, 50 VUs, 30s
 * Tests GET endpoints under concurrent read traffic.
 * Uses pre-seeded fixture data — no writes during this scenario.
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

// Custom counter for tracking read check failures
export const readCheckFailures = new Counter('read_check_failures');

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 50,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);

  // Distribute across available groups to avoid hotspotting a single group
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];
  const post = fixtures.posts[vuIndex % fixtures.posts.length];

  // GET /api/v1/groups
  const r1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'GET /groups' },
  });
  if (!check(r1, { 'GET /groups 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/groups/:groupId
  const r2 = http.get(`${BASE_URL}/api/v1/groups/${group.id}`, {
    headers,
    tags: { name: 'GET /groups/:id' },
  });
  if (!check(r2, { 'GET /groups/:id 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/groups/:groupId/posts
  const r3 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'GET /groups/:id/posts' },
  });
  if (!check(r3, { 'GET /groups/:id/posts 200': r => r.status === 200 })) {
    readCheckFailures.add(1);
  }

  // GET /api/v1/groups/posts/:postId/comments
  const r4 = http.get(
    `${BASE_URL}/api/v1/groups/posts/${post.id}/comments`,
    { headers, tags: { name: 'GET /posts/:id/comments' } },
  );
  if (
    !check(r4, { 'GET /posts/:id/comments 200': r => r.status === 200 })
  ) {
    readCheckFailures.add(1);
  }

  sleep(1);
}
