/**
 * read-load.js — Concurrent read load test for Legal API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users fetching legal pages (terms of service, privacy policy).
 *
 * Public endpoints — no authentication headers required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('legal-fixtures', function () {
  return [JSON.parse(open('../fixtures/legal-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const vuIndex = __VU - 1;
  const slug = fixtures.knownSlugs[(vuIndex + __ITER) % fixtures.knownSlugs.length];

  // GET /api/v1/legal — list all legal pages
  const r1 = http.get(`${BASE_URL}/api/v1/legal`, {
    tags: { name: 'GET /legal' },
  });
  check(r1, { 'GET /legal 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/legal/:slug — view specific legal page
  const r2 = http.get(`${BASE_URL}/api/v1/legal/${slug}`, {
    tags: { name: 'GET /legal/:slug' },
  });
  check(r2, { 'GET /legal/:slug 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
