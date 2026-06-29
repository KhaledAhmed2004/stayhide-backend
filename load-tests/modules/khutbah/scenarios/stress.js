/**
 * stress.js — Stress test scenario for Khutbah API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed read operations (list and detail) to identify throughput ceiling.
 *
 * Public endpoints — no authentication headers required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('khutbah-fixtures', function () {
  return [JSON.parse(open('../fixtures/khutbah-fixtures.json'))];
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
  const khutbah = fixtures.khutbahs[(vuIndex + __ITER) % fixtures.khutbahs.length];

  // GET /api/v1/khutba
  const r1 = http.get(`${BASE_URL}/api/v1/khutba`, {
    tags: { name: 'GET /khutba' },
  });
  check(r1, { 'stress GET /khutba 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/khutba/:id
  const r2 = http.get(`${BASE_URL}/api/v1/khutba/${khutbah.id}`, {
    tags: { name: 'GET /khutba/:id' },
  });
  check(r2, { 'stress GET /khutba/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
