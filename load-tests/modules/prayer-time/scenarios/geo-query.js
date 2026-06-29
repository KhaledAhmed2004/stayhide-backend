/**
 * geo-query.js — Geographic query diversity scenario for Prayer-Time API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent requests from diverse geographic locations
 * with varying lat/lng pairs to stress-test the prayer time calculation engine.
 *
 * Public endpoint — no authentication headers required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
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

export const geoQueryScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runGeoQuery',
};

export function runGeoQuery() {
  const vuIndex = __VU - 1;

  // Each VU targets a different coordinate to maximize geographic diversity
  const coord = fixtures.coordinates[(vuIndex + __ITER) % fixtures.coordinates.length];
  const method = fixtures.calculationMethods[vuIndex % fixtures.calculationMethods.length];
  const date = fixtures.dates[__ITER % fixtures.dates.length];

  const url = `${BASE_URL}/api/v1/prayer-times?latitude=${coord.latitude}&longitude=${coord.longitude}&method=${method}&date=${date}`;

  const res = http.get(url, {
    tags: { name: 'GET /prayer-times (geo-query)' },
  });

  check(res, {
    'geo-query GET /prayer-times 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);
}
