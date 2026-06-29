/**
 * read-load.js — Concurrent read load test for Khutbah API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users browsing khutbah list and viewing individual khutbah content.
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

const moduleFixtures = new SharedArray('khutbah-fixtures', function () {
  return [JSON.parse(open('../fixtures/khutbah-fixtures.json'))];
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
  const khutbah = fixtures.khutbahs[(vuIndex + __ITER) % fixtures.khutbahs.length];

  // GET /api/v1/khutba — list all khutbahs
  const r1 = http.get(`${BASE_URL}/api/v1/khutba`, {
    tags: { name: 'GET /khutba' },
  });
  check(r1, { 'GET /khutba 2xx': r => r.status >= 200 && r.status < 300 });

  // GET /api/v1/khutba/:id — view khutbah detail
  const r2 = http.get(`${BASE_URL}/api/v1/khutba/${khutbah.id}`, {
    tags: { name: 'GET /khutba/:id' },
  });
  check(r2, { 'GET /khutba/:id 2xx': r => r.status >= 200 && r.status < 300 });

  sleep(1);
}
