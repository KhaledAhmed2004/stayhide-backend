/**
 * write-load.js — Concurrent write load test
 *
 * Executor: constant-vus, 20 VUs, 30s
 * Tests write operations (post, like, comment) under concurrent load.
 * Users are pre-seeded as group members in seed.js.
 * Join is skipped because it uses MongoDB transactions (requires replica set).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 20,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Each VU targets a different group to spread write load
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];

  // ── Step 1: Create post ─────────────────────────────────────────────────────
  const postRes = http.post(
    `${BASE_URL}/api/v1/groups/${group.id}/posts`,
    JSON.stringify({ content: `write-load post ${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'POST /groups/:id/posts' } },
  );
  check(postRes, {
    'create post 2xx': r => r.status >= 200 && r.status < 300,
  });

  // Capture postId from response; fall back to fixture post if extraction fails
  let postId = null;
  try {
    postId = JSON.parse(postRes.body).data?._id || JSON.parse(postRes.body).data?.id;
  } catch (_) {}
  if (!postId) {
    postId = fixtures.posts[vuIndex % fixtures.posts.length].id;
  }

  // ── Step 2: Like post ───────────────────────────────────────────────────────
  const likeRes = http.post(
    `${BASE_URL}/api/v1/groups/posts/${postId}/like`,
    null,
    { headers, tags: { name: 'POST /posts/:id/like' } },
  );
  check(likeRes, { 'like 2xx': r => r.status >= 200 && r.status < 300 });

  // ── Step 3: Comment ─────────────────────────────────────────────────────────
  const commentRes = http.post(
    `${BASE_URL}/api/v1/groups/posts/${postId}/comments`,
    JSON.stringify({ comment: `write-load comment ${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'POST /posts/:id/comments' } },
  );
  check(commentRes, {
    'comment 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
