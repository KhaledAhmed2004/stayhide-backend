/**
 * stress.js — Stress test scenario for Legal API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing read operations against legal page endpoints.
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

const moduleFixtures = new SharedArray('legal-fixtures', function () {
  return [JSON.parse(open('../fixtures/legal-fixtures.json'))];
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
  const slug = fixtures.knownSlugs[(vuIndex + __ITER) % fixtures.knownSlugs.length];

  // GET /api/v1/legal
  const r1 = http.get(`${BASE_URL}/api/v1/legal`, {
    tags: { name: 'GET /legal' },
  });
  check(r1, { 'stress GET /legal 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/legal/:slug
  const r2 = http.get(`${BASE_URL}/api/v1/legal/${slug}`, {
    tags: { name: 'GET /legal/:slug' },
  });
  check(r2, { 'stress GET /legal/:slug 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
