/**
 * user-journey.js — User journey scenario for Khutbah API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates realistic khutbah browsing flow:
 * list khutbahs → view detail → list with different pagination.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

export function runUserJourney() {
  const vuIndex = __VU - 1;
  const khutbah = fixtures.khutbahs[vuIndex % fixtures.khutbahs.length];

  // ── Step 1: Browse khutbahs ─────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/khutba`, {
    tags: { name: 'journey:list-khutbahs' },
  });
  check(s1, { 'Step1:list-khutbahs 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 2: View khutbah detail ─────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/khutba/${khutbah.id}`, {
    tags: { name: 'journey:view-khutbah' },
  });
  check(s2, { 'Step2:view-khutbah 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 3: List with different pagination ──────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/khutba?page=2&limit=5`, {
    tags: { name: 'journey:list-khutbahs-page2' },
  });
  check(s3, { 'Step3:list-khutbahs-page2 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
