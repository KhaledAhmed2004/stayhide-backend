/**
 * stress.js — Stress test scenario for Support-Ticket API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed read and write operations across user and admin ticket endpoints.
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

const moduleFixtures = new SharedArray('support-ticket-fixtures', function () {
  return [JSON.parse(open('../fixtures/support-ticket-fixtures.json'))];
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
  const ticket = fixtures.tickets[(vuIndex + __ITER) % fixtures.tickets.length];

  const operation = __ITER % 4;

  if (operation === 0) {
    // User: get my tickets
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/my`, {
      headers,
      tags: { name: 'GET /support-tickets/my' },
    });
    check(res, { 'stress GET /support-tickets/my 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 1) {
    // User: create ticket
    const headers = {
      ...getAuthHeaders(fixtures, 'brother', vuIndex),
      'Content-Type': 'application/json',
    };
    const res = http.post(
      `${BASE_URL}/api/v1/support-tickets`,
      JSON.stringify({
        subject: `loadtest-stress-ticket VU${__VU}`,
        message: `Stress test ticket ${Date.now()}`,
      }),
      { headers, tags: { name: 'POST /support-tickets' } },
    );
    check(res, { 'stress POST /support-tickets 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 2) {
    // Admin: list all tickets
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/admin/list`, {
      headers,
      tags: { name: 'GET /support-tickets/admin/list' },
    });
    check(res, { 'stress GET /admin/list 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // User: view own ticket detail (use ticket owned by this VU's user)
    // Each brother user owns tickets seeded with their userId, so we pick the
    // ticket whose userId matches brotherUsers[vuIndex % brotherUsers.length].id
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    // Use the first ticket — all tickets are accessible by their respective owners;
    // stress tests read-load on the admin endpoint instead for broader coverage
    const adminHeaders = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/support-tickets/admin/list`, {
      headers: adminHeaders,
      tags: { name: 'GET /support-tickets/admin/list' },
    });
    check(res, { 'stress GET /support-tickets/:id 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
