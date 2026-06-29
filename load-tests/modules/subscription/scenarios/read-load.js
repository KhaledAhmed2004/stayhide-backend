/**
 * read-load.js — Concurrent read load test for Subscription API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users checking subscription status and admins querying analytics.
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

export const readLoadScenario = {
  executor: 'constant-vus',
  vus: 10,
  duration: '30s',
  exec: 'runReadLoad',
};

export function runReadLoad() {
  const vuIndex = __VU - 1;

  // Alternate between user status check and admin analytics
  if (vuIndex % 3 !== 0) {
    // User: check subscription status
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/subscriptions/me`, {
      headers,
      tags: { name: 'GET /subscriptions/me' },
    });
    check(res, { 'GET /subscriptions/me 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Admin: query analytics
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/subscriptions/admin/analytics`, {
      headers,
      tags: { name: 'GET /subscriptions/admin/analytics' },
    });
    check(res, { 'GET /subscriptions/admin/analytics 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
