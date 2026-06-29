/**
 * read-load.js — Concurrent read load test for Dua API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users browsing dua list and viewing individual dua content.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('dua-fixtures', function () {
  return [JSON.parse(open('../fixtures/dua-fixtures.json'))];
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
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const dua = fixtures.duas[(vuIndex + __ITER) % fixtures.duas.length];

  // GET /api/v1/duas — list all duas
  const r1 = http.get(`${BASE_URL}/api/v1/duas`, {
    headers,
    tags: { name: 'GET /duas' },
  });
  check(r1, { 'GET /duas 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/duas/:duaId — view dua detail
  const r2 = http.get(`${BASE_URL}/api/v1/duas/${dua.id}`, {
    headers,
    tags: { name: 'GET /duas/:id' },
  });
  check(r2, { 'GET /duas/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
