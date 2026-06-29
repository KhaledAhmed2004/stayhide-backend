/**
 * baseline.js — Single-user baseline latency measurement for Support-Ticket API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Creates a support ticket, retrieves the user's tickets, and views a single ticket
 * under zero concurrency to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
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

export const baselineScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 1,
  exec: 'runBaseline',
};

export function runBaseline() {
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', 0),
    'Content-Type': 'application/json',
  };

  const ticketId = fixtures.tickets[0].id;

  const endpoints = [
    {
      tag: 'POST /support-tickets',
      fn: () =>
        http.post(
          `${BASE_URL}/api/v1/support-tickets`,
          JSON.stringify({
            subject: 'loadtest-baseline-ticket',
            message: 'Baseline test ticket created during load testing',
          }),
          { headers, tags: { name: 'POST /support-tickets' } },
        ),
    },
    {
      tag: 'GET /support-tickets/my',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/support-tickets/my`, {
          headers,
          tags: { name: 'GET /support-tickets/my' },
        }),
    },
    {
      tag: 'GET /support-tickets/:ticketId',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/support-tickets/${ticketId}`, {
          headers,
          tags: { name: 'GET /support-tickets/:ticketId' },
        }),
    },
  ];

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });
    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }
}
