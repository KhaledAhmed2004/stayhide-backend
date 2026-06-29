/**
 * read-load.js — Concurrent read load test for Support-Ticket API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users fetching their tickets and admins listing all tickets with stats.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('support-ticket-fixtures', function () {
  return [JSON.parse(open('../fixtures/support-ticket-fixtures.json'))];
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

  if (vuIndex % 3 === 0) {
    // Admin: list all tickets
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/admin/list`, {
      headers,
      tags: { name: 'GET /support-tickets/admin/list' },
    });
    check(res, { 'GET /support-tickets/admin/list 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (vuIndex % 3 === 1) {
    // Admin: get ticket stats
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/admin/stats`, {
      headers,
      tags: { name: 'GET /support-tickets/admin/stats' },
    });
    check(res, { 'GET /support-tickets/admin/stats 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // User: fetch my tickets
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/my`, {
      headers,
      tags: { name: 'GET /support-tickets/my' },
    });
    check(res, { 'GET /support-tickets/my 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
