/**
 * stress.js — Stress test scenario for Dua API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed read operations (list and detail) to identify throughput ceiling.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('dua-fixtures', function () {
  return [JSON.parse(open('../fixtures/dua-fixtures.json'))];
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
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const dua = fixtures.duas[(vuIndex + __ITER) % fixtures.duas.length];

  // GET /api/v1/duas
  const r1 = http.get(`${BASE_URL}/api/v1/duas`, {
    headers,
    tags: { name: 'GET /duas' },
  });
  check(r1, { 'stress GET /duas 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/duas/:duaId
  const r2 = http.get(`${BASE_URL}/api/v1/duas/${dua.id}`, {
    headers,
    tags: { name: 'GET /duas/:id' },
  });
  check(r2, { 'stress GET /duas/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
