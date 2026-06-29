/**
 * baseline.js — Single-user baseline latency measurement for Mosque API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Lists all mosques and retrieves a single mosque by ID
 * under zero concurrency to establish a performance baseline.
 *
 * Public endpoints — no authentication headers required.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('mosque-fixtures', function () {
  return [JSON.parse(open('../fixtures/mosque-fixtures.json'))];
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
  const mosqueId = fixtures.mosques[0].id;

  const endpoints = [
    {
      tag: 'GET /mosques',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/mosques`, {
          tags: { name: 'GET /mosques' },
        }),
    },
    {
      tag: 'GET /mosques/:mosqueId',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/mosques/${mosqueId}`, {
          tags: { name: 'GET /mosques/:mosqueId' },
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
