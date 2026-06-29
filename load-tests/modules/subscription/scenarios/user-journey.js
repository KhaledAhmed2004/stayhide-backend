/**
 * user-journey.js — User journey scenario for Subscription API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates subscription lifecycle:
 * check status → choose free plan → check updated status.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('subscription-fixtures', function () {
  return [JSON.parse(open('../fixtures/subscription-fixtures.json'))];
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
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // ── Step 1: Check current subscription status ───────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/subscriptions/me`, {
    headers,
    tags: { name: 'journey:check-status' },
  });
  check(s1, { 'Step1:check-status 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 2: Choose free plan ────────────────────────────────────────────────
  const s2 = http.post(
    `${BASE_URL}/api/v1/subscriptions/choose/free`,
    null,
    { headers, tags: { name: 'journey:choose-free' } },
  );
  check(s2, { 'Step2:choose-free 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(2);

  // ── Step 3: Check updated subscription status ───────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/subscriptions/me`, {
    headers,
    tags: { name: 'journey:check-updated-status' },
  });
  check(s3, { 'Step3:check-updated-status 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
