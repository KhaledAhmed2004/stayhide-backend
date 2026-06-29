/**
 * stress.js — Stress test scenario for Prayer-Time API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs requesting prayer times with randomized geographic coordinates
 * and calculation methods.
 *
 * Public endpoint — no authentication headers required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('prayer-time-fixtures', function () {
  return [JSON.parse(open('../fixtures/prayer-time-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressProfile(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;

  // Randomize coordinate and method selection per iteration
  const coord = fixtures.coordinates[(vuIndex + __ITER) % fixtures.coordinates.length];
  const method = fixtures.calculationMethods[(vuIndex + __ITER) % fixtures.calculationMethods.length];
  const date = fixtures.dates[__ITER % fixtures.dates.length];

  const url = `${BASE_URL}/api/v1/prayer-times?latitude=${coord.latitude}&longitude=${coord.longitude}&method=${method}&date=${date}`;

  const res = http.get(url, {
    tags: { name: 'GET /prayer-times' },
  });

  check(res, {
    'stress GET /prayer-times 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
