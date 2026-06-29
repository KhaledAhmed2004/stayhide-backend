/**
 * spike.js — Spike test scenario for Prayer-Time API
 *
 * Executor: ramping-vus
 * Simulates sudden bursts of prayer time requests (app-open events at prayer time).
 * Stages: 0→3 VUs (5s ramp) → 3→15 VUs (10s peak) → 15→3 VUs (5s recovery)
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

export const spikeScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5s', target: 3 },
    { duration: '10s', target: 15 },
    { duration: '5s', target: 3 },
  ],
  exec: 'runSpike',
};

/**
 * Approximate stage tag based on iteration count.
 */
function getStageTag() {
  if (__ITER < 5) return 'ramp_up';
  if (__ITER < 15) return 'peak';
  return 'recovery';
}

export function runSpike() {
  const vuIndex = __VU - 1;
  const stage = getStageTag();

  // Simulate diverse app-open requests from different locations
  const coord = fixtures.coordinates[(vuIndex + __ITER) % fixtures.coordinates.length];
  const method = fixtures.calculationMethods[vuIndex % fixtures.calculationMethods.length];
  const date = fixtures.dates[0]; // Current date simulation

  const url = `${BASE_URL}/api/v1/prayer-times?latitude=${coord.latitude}&longitude=${coord.longitude}&method=${method}&date=${date}`;

  const res = http.get(url, {
    tags: { name: 'GET /prayer-times', stage },
  });

  check(res, {
    'spike GET /prayer-times 2xx': r => r.status >= 200 && r.status < 300,
  });
}
