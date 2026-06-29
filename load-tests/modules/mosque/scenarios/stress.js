/**
 * stress.js — Stress test scenario for Mosque API
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

const moduleFixtures = new SharedArray('mosque-fixtures', function () {
  return [JSON.parse(open('../fixtures/mosque-fixtures.json'))];
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
  const mosque = fixtures.mosques[(vuIndex + __ITER) % fixtures.mosques.length];

  // GET /api/v1/mosques
  const r1 = http.get(`${BASE_URL}/api/v1/mosques`, {
    tags: { name: 'GET /mosques' },
  });
  check(r1, { 'stress GET /mosques 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/mosques/:mosqueId
  const r2 = http.get(`${BASE_URL}/api/v1/mosques/${mosque.id}`, {
    tags: { name: 'GET /mosques/:id' },
  });
  check(r2, { 'stress GET /mosques/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
