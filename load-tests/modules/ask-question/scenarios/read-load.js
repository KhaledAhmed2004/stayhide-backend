/**
 * read-load.js — Concurrent read load test for Ask-Question API
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates concurrent users fetching their questions and admins listing all questions.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('ask-question-fixtures', function () {
  return [JSON.parse(open('../fixtures/ask-question-fixtures.json'))];
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

  // Alternate between user and admin read operations
  if (vuIndex % 2 === 0) {
    // User: fetch my questions
    const headers = getAuthHeaders(fixtures, 'brother', vuIndex);
    const res = http.get(`${BASE_URL}/api/v1/ask-question/my-questions`, {
      headers,
      tags: { name: 'GET /ask-question/my-questions' },
    });
    check(res, { 'GET /ask-question/my-questions 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Admin: list all questions
    const headers = getAuthHeaders(fixtures, 'admin', 0);
    const res = http.get(`${BASE_URL}/api/v1/ask-question`, {
      headers,
      tags: { name: 'GET /ask-question (admin)' },
    });
    check(res, { 'GET /ask-question (admin) 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
