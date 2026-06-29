/**
 * read-load.js — Concurrent read load test for Mosque API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users browsing mosque list and viewing individual mosque details.
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

const moduleFixtures = new SharedArray('mosque-fixtures', function () {
  return [JSON.parse(open('../fixtures/mosque-fixtures.json'))];
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
  const mosque = fixtures.mosques[vuIndex % fixtures.mosques.length];

  // GET /api/v1/mosques — list all mosques
  const r1 = http.get(`${BASE_URL}/api/v1/mosques`, {
    tags: { name: 'GET /mosques' },
  });
  check(r1, { 'GET /mosques 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/mosques/:mosqueId — view mosque detail
  const r2 = http.get(`${BASE_URL}/api/v1/mosques/${mosque.id}`, {
    tags: { name: 'GET /mosques/:id' },
  });
  check(r2, { 'GET /mosques/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
