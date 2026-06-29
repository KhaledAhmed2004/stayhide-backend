/**
 * stress.js — Stress test scenario for Chat/Messages API
 *
 * Executor: ramping-vus, progressive VU increase to find throughput ceiling.
 * Ramps VUs sending and reading messages to identify the point where
 * response times degrade and error rates increase.
 * Uses pre-seeded fixture data for chat rooms; sends new messages during test.
 *
 * Run: k6 run --out web-dashboard load-tests/modules/chat/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/chat/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getStressStages, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('chat-fixtures', function () {
  return [JSON.parse(open('../fixtures/chat-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getStressStages(__ENV.STRESS_PROFILE),
      exec: 'runStress',
    },
  },
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<1000', abortOnFail: false },
      { threshold: 'p(95)<2000', abortOnFail: false },
      { threshold: 'p(99)<5000', abortOnFail: false },
    ],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressStages(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Distribute across available chat rooms to avoid hotspotting
  const chatRoom = fixtures.chatRooms[vuIndex % fixtures.chatRooms.length];
  const otherUser = fixtures.brotherUsers[(vuIndex + 1) % fixtures.brotherUsers.length];

  // GET /api/v1/chats (list my chats)
  const r1 = http.get(`${BASE_URL}/api/v1/chats`, {
    headers,
    tags: { name: 'GET /chats' },
  });
  check(r1, { 'GET /chats 200': (r) => r.status === 200 });

  // POST /api/v1/chats/:otherUserId (create or get chat)
  const r2 = http.post(`${BASE_URL}/api/v1/chats/${otherUser.id}`, null, {
    headers,
    tags: { name: 'POST /chats/:otherUserId' },
  });
  check(r2, { 'POST /chats/:otherUserId 2xx': (r) => r.status >= 200 && r.status < 300 });

  // Extract chatId for message operations
  let chatId = chatRoom.chatId;
  const createBody = r2.json();
  if (createBody && createBody.data && createBody.data._id) {
    chatId = createBody.data._id;
  }

  // POST /api/v1/messages (send message)
  const r3 = http.post(
    `${BASE_URL}/api/v1/messages`,
    JSON.stringify({ chatId, text: `stress-msg-vu${__VU}-iter${__ITER}` }),
    { headers, tags: { name: 'POST /messages' } },
  );
  check(r3, { 'POST /messages 2xx': (r) => r.status >= 200 && r.status < 300 });

  // GET /api/v1/messages/chat/:chatId (get chat messages)
  const r4 = http.get(`${BASE_URL}/api/v1/messages/chat/${chatId}`, {
    headers,
    tags: { name: 'GET /messages/chat/:chatId' },
  });
  check(r4, { 'GET /messages/chat/:chatId 200': (r) => r.status === 200 });

  // POST /api/v1/messages/chat/:chatId/read (mark chat as read)
  const r5 = http.post(`${BASE_URL}/api/v1/messages/chat/${chatId}/read`, null, {
    headers,
    tags: { name: 'POST /messages/chat/:chatId/read' },
  });
  check(r5, { 'POST /messages/chat/:chatId/read 2xx': (r) => r.status >= 200 && r.status < 300 });

  sleep(1);
}

export default runStress;

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
