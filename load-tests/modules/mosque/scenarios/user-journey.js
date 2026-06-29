/**
 * user-journey.js — User journey scenario for Mosque API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates realistic mosque discovery flow:
 * list mosques → view detail → list with different pagination.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

export function runUserJourney() {
  const vuIndex = __VU - 1;
  const mosque = fixtures.mosques[vuIndex % fixtures.mosques.length];

  // ── Step 1: Browse mosques ──────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/mosques`, {
    tags: { name: 'journey:list-mosques' },
  });
  check(s1, { 'Step1:list-mosques 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 2: View mosque detail ──────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/mosques/${mosque.id}`, {
    tags: { name: 'journey:view-mosque' },
  });
  check(s2, { 'Step2:view-mosque 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 3: List with different pagination ──────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/mosques?page=2&limit=5`, {
    tags: { name: 'journey:list-mosques-page2' },
  });
  check(s3, { 'Step3:list-mosques-page2 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
