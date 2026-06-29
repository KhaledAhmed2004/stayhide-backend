/**
 * baseline.js — Single-user baseline latency measurement for Khutbah API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Exercises the public khutbah listing and detail endpoints
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

const moduleFixtures = new SharedArray('khutbah-fixtures', function () {
  return [JSON.parse(open('../fixtures/khutbah-fixtures.json'))];
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
  const khutbahId = fixtures.khutbahs[0].id;

  const endpoints = [
    {
      tag: 'GET /khutba',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/khutba`, {
          tags: { name: 'GET /khutba' },
        }),
    },
    {
      tag: 'GET /khutba/:id',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/khutba/${khutbahId}`, {
          tags: { name: 'GET /khutba/:id' },
        }),
    },
  ];

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });

    // Verify response data structure
    if (ep.tag === 'GET /khutba') {
      const body = res.json();
      check(body, {
        'list returns data array': b => b && b.data && Array.isArray(b.data),
      });
    }

    if (ep.tag === 'GET /khutba/:id') {
      const body = res.json();
      check(body, {
        'detail returns data object with id': b =>
          b && b.data && typeof b.data._id === 'string' && b.data._id.length > 0,
      });
    }

    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }
}
