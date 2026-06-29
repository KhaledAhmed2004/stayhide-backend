/**
 * baseline.js — Single-user baseline latency measurement for Dua API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Lists all duas and retrieves a single dua by ID
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

const moduleFixtures = new SharedArray('dua-fixtures', function () {
  return [JSON.parse(open('../fixtures/dua-fixtures.json'))];
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

  const duaId = fixtures.duas[0].id;

  const endpoints = [
    {
      tag: 'GET /duas',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/duas`, {
          headers,
          tags: { name: 'GET /duas' },
        }),
    },
    {
      tag: 'GET /duas/:duaId',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/duas/${duaId}`, {
          headers,
          tags: { name: 'GET /duas/:duaId' },
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
