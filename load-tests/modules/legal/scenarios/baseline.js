/**
 * baseline.js — Single-user baseline latency measurement for Legal API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Lists all legal pages and retrieves a single legal page by slug
 * under zero concurrency to establish a performance baseline.
 *
 * Public endpoints — no authentication headers required.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('legal-fixtures', function () {
  return [JSON.parse(open('../fixtures/legal-fixtures.json'))];
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
  const slug = fixtures.knownSlugs[0];

  const endpoints = [
    {
      tag: 'GET /legal',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/legal`, {
          tags: { name: 'GET /legal' },
        }),
    },
    {
      tag: 'GET /legal/:slug',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/legal/${slug}`, {
          tags: { name: 'GET /legal/:slug' },
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
