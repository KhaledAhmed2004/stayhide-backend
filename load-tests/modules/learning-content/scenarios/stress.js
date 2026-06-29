/**
 * stress.js — Stress test scenario for Learning-Content API
 *
 * Executor: ramping-vus, progressive VU increase to find breaking point.
 * Ramps VUs performing mixed read and write operations across content browsing
 * and engagement endpoints.
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

const moduleFixtures = new SharedArray('learning-content-fixtures', function () {
  return [JSON.parse(open('../fixtures/learning-content-fixtures.json'))];
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
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const content = fixtures.contents[(vuIndex + __ITER) % fixtures.contents.length];

  const operation = __ITER % 4;

  if (operation === 0) {
    // Read: list content
    const res = http.get(`${BASE_URL}/api/v1/learning-contents`, {
      headers,
      tags: { name: 'GET /learning-contents' },
    });
    check(res, { 'stress GET /learning-contents 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 1) {
    // Read: view content detail
    const res = http.get(`${BASE_URL}/api/v1/learning-contents/${content.id}`, {
      headers,
      tags: { name: 'GET /learning-contents/:id' },
    });
    check(res, { 'stress GET /learning-contents/:id 2xx': r => r.status >= 200 && r.status < 300 });
  } else if (operation === 2) {
    // Write: toggle like
    const res = http.post(
      `${BASE_URL}/api/v1/learning-contents/${content.id}/like`,
      null,
      { headers, tags: { name: 'POST /learning-contents/:id/like' } },
    );
    check(res, { 'stress POST /like 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Write: add comment
    const res = http.post(
      `${BASE_URL}/api/v1/learning-contents/${content.id}/comments`,
      JSON.stringify({ comment: `Stress comment VU${__VU} ${Date.now()}` }),
      { headers, tags: { name: 'POST /learning-contents/:id/comments' } },
    );
    check(res, { 'stress POST /comments 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
