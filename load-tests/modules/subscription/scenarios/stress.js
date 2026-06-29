/**
 * stress.js — Stress test scenario for Subscription API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed operations across user and admin subscription endpoints.
 * Distributes requests across multiple test user accounts to avoid per-user rate limits.
 * Adds sleep() pacing to stay below rate limits on verify endpoints.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';
import { getStressProfile } from '../../../shared/config/profiles.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('subscription-fixtures', function () {
  return [JSON.parse(open('../fixtures/subscription-fixtures.json'))];
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

  // Distribute across operations to avoid rate limit issues
  const operation = __ITER % 4;

  if (operation === 0) {
    // User: check subscription status
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/subscriptions/me`, {
      headers,
      tags: { name: 'GET /subscriptions/me' },
    });
    check(res, { 'stress GET /subscriptions/me 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 1) {
    // User: choose free plan (not rate-limited)
    const headers = {
      ...getAuthHeaders(fixtures, 'brother', vuIndex),
      'Content-Type': 'application/json',
    };
    const res = http.post(`${BASE_URL}/api/v1/subscriptions/choose/free`, null, {
      headers,
      tags: { name: 'POST /subscriptions/choose/free' },
    });
    check(res, { 'stress POST /choose/free 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 2) {
    // Admin: get analytics
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/subscriptions/admin/analytics`, {
      headers,
      tags: { name: 'GET /subscriptions/admin/analytics' },
    });
    check(res, { 'stress GET /admin/analytics 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Admin: list all subscriptions
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/subscriptions/admin`, {
      headers,
      tags: { name: 'GET /subscriptions/admin' },
    });
    check(res, { 'stress GET /subscriptions/admin 2xx': r => r.status >= 200 && r.status < 300 });
  }

  // Pacing to avoid rate limit interference
  sleep(2);
}
