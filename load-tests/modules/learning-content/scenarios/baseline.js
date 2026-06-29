/**
 * baseline.js — Single-user baseline latency measurement for Learning-Content API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Exercises the key Learning-Content endpoints (list, get single, get comments)
 * under zero concurrency to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('learning-content-fixtures', function () {
  return [JSON.parse(open('../fixtures/learning-content-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

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

  const contentId = fixtures.contents[0].id;

  const endpoints = [
    {
      tag: 'GET /learning-contents',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/learning-contents`, {
          headers,
          tags: { name: 'GET /learning-contents' },
        }),
    },
    {
      tag: 'GET /learning-contents/:contentId',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/learning-contents/${contentId}`, {
          headers,
          tags: { name: 'GET /learning-contents/:contentId' },
        }),
    },
    {
      tag: 'GET /learning-contents/:contentId/comments',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/learning-contents/${contentId}/comments`, {
          headers,
          tags: { name: 'GET /learning-contents/:contentId/comments' },
        }),
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
