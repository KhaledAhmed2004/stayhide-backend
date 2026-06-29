/**
 * user-journey.js — User journey scenario for Dua API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates realistic dua browsing flow:
 * list duas → view detail → list with different pagination.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

export function runUserJourney() {
  const vuIndex = __VU - 1;
  const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
  const dua = fixtures.duas[vuIndex % fixtures.duas.length];

  // ── Step 1: Browse duas ─────────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/duas`, {
    headers,
    tags: { name: 'journey:list-duas' },
  });
  check(s1, { 'Step1:list-duas 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 2: View dua detail ─────────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/duas/${dua.id}`, {
    headers,
    tags: { name: 'journey:view-dua' },
  });
  check(s2, { 'Step2:view-dua 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 3: List with different pagination ──────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/duas?page=2&limit=5`, {
    headers,
    tags: { name: 'journey:list-duas-page2' },
  });
  check(s3, { 'Step3:list-duas-page2 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
