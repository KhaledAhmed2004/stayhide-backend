/**
 * baseline.js — Single-user baseline latency measurement
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Measures response time for each of the 7 key Group API endpoints
 * under zero concurrency to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
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

export const baselineScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 1,
  exec: 'runBaseline',
};

export function runBaseline() {
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', 0),
    'Content-Type': 'application/json',
  };
  const groupId = fixtures.brotherGroups[0].id;
  const postId = fixtures.posts[0].id;

  const endpoints = [
    {
      tag: 'GET /groups',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/groups`, {
          headers,
          tags: { name: 'GET /groups' },
        }),
    },
    {
      tag: 'GET /groups/:id',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/groups/${groupId}`, {
          headers,
          tags: { name: 'GET /groups/:id' },
        }),
    },
    {
      tag: 'POST /groups/:id/join',
      fn: () =>
        http.post(`${BASE_URL}/api/v1/groups/${groupId}/join`, null, {
          headers,
          tags: { name: 'POST /groups/:id/join' },
        }),
    },
    {
      tag: 'GET /groups/:id/posts',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/groups/${groupId}/posts`, {
          headers,
          tags: { name: 'GET /groups/:id/posts' },
        }),
    },
    {
      tag: 'POST /groups/:id/posts',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/groups/${groupId}/posts`,
          JSON.stringify({ content: 'baseline test post' }),
          { headers, tags: { name: 'POST /groups/:id/posts' } },
        ),
    },
    {
      tag: 'POST /posts/:id/like',
      fn: () =>
        http.post(`${BASE_URL}/api/v1/groups/posts/${postId}/like`, null, {
          headers,
          tags: { name: 'POST /posts/:id/like' },
        }),
    },
    {
      tag: 'POST /posts/:id/comments',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/groups/posts/${postId}/comments`,
          JSON.stringify({ comment: 'baseline comment' }),
          { headers, tags: { name: 'POST /posts/:id/comments' } },
        ),
    },
  ];

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });
    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }
}
