/**
 * baseline.js — Single-user baseline latency measurement for Prayer-Time API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Requests prayer times with valid latitude, longitude, date, and calculation method
 * under zero concurrency to establish a performance baseline.
 *
 * Public endpoint — no authentication headers required.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('prayer-time-fixtures', function () {
  return [JSON.parse(open('../fixtures/prayer-time-fixtures.json'))];
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
  const coord = fixtures.coordinates[0]; // Mecca
  const method = fixtures.calculationMethods[0]; // MuslimWorldLeague
  const date = fixtures.dates[0]; // 2024-01-15

  const url = `${BASE_URL}/api/v1/prayer-times?latitude=${coord.latitude}&longitude=${coord.longitude}&method=${method}&date=${date}`;

  const res = http.get(url, {
    tags: { name: 'GET /prayer-times' },
  });

  const ok = check(res, {
    'GET /prayer-times status 2xx': r => r.status >= 200 && r.status < 300,
  });

  // Verify response contains prayer time data
  if (res.status === 200) {
    try {
      const body = res.json();
      check(body, {
        'response contains data': b => b && b.data !== undefined,
      });
    } catch (_) {}
  }

  console.log(
    `[baseline] GET /prayer-times → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
  );
}
