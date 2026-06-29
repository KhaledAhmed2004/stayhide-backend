/**
 * baseline.js — Single-user baseline latency measurement for Chat/Messages API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Creates a chat between two users, sends a text message, and retrieves
 * chat messages to verify end-to-end message delivery under zero concurrency
 * to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('chat-fixtures', function () {
  return [JSON.parse(open('../fixtures/chat-fixtures.json'))];
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

  // Use a second user to create a chat with
  const otherUser = fixtures.brotherUsers[1];

  const endpoints = [
    {
      tag: 'POST /chats/:otherUserId (create-or-get-chat)',
      fn: () =>
        http.post(`${BASE_URL}/api/v1/chats/${otherUser.id}`, null, {
          headers,
          tags: { name: 'POST /chats/:otherUserId' },
        }),
    },
    {
      tag: 'GET /chats (list-my-chats)',
      fn: () =>
        http.get(`${BASE_URL}/api/v1/chats`, {
          headers,
          tags: { name: 'GET /chats' },
        }),
    },
  ];

  // Step 1: Create or get a chat and list chats
  let chatId = null;

  for (const ep of endpoints) {
    const res = ep.fn();
    const ok = check(res, {
      [`${ep.tag} status 2xx`]: r => r.status >= 200 && r.status < 300,
    });

    // Extract chatId from create-or-get-chat response
    if (ep.tag.includes('create-or-get-chat')) {
      const body = res.json();
      if (body && body.data && body.data._id) {
        chatId = body.data._id;
      }
      check(body, {
        'create-or-get-chat returns chatId': b =>
          b && b.data && typeof b.data._id === 'string' && b.data._id.length > 0,
      });
    }

    console.log(
      `[baseline] ${ep.tag} → HTTP ${res.status} | ${res.timings.duration.toFixed(1)}ms${ok ? '' : ' ⚠ FAILED'}`,
    );
  }

  // Step 2: Send a text message to the chat
  if (chatId) {
    const sendRes = http.post(
      `${BASE_URL}/api/v1/messages`,
      JSON.stringify({ chatId, text: 'baseline load test message' }),
      { headers, tags: { name: 'POST /messages' } },
    );

    const sendOk = check(sendRes, {
      'POST /messages status 2xx': r => r.status >= 200 && r.status < 300,
    });

    const sendBody = sendRes.json();
    check(sendBody, {
      'send-message returns messageId': b =>
        b && b.data && typeof b.data._id === 'string' && b.data._id.length > 0,
    });

    console.log(
      `[baseline] POST /messages (send-message) → HTTP ${sendRes.status} | ${sendRes.timings.duration.toFixed(1)}ms${sendOk ? '' : ' ⚠ FAILED'}`,
    );

    // Step 3: Retrieve chat messages to verify delivery
    const getRes = http.get(`${BASE_URL}/api/v1/messages/chat/${chatId}`, {
      headers,
      tags: { name: 'GET /messages/chat/:chatId' },
    });

    const getOk = check(getRes, {
      'GET /messages/chat/:chatId status 2xx': r => r.status >= 200 && r.status < 300,
    });

    const getBody = getRes.json();
    check(getBody, {
      'get-chat-messages returns messages array': b =>
        b && b.data && Array.isArray(b.data) && b.data.length > 0,
      'message delivery verified': b =>
        b && b.data && Array.isArray(b.data) && b.data.some(m => m.text === 'baseline load test message'),
    });

    console.log(
      `[baseline] GET /messages/chat/:chatId (get-chat-messages) → HTTP ${getRes.status} | ${getRes.timings.duration.toFixed(1)}ms${getOk ? '' : ' ⚠ FAILED'}`,
    );

    // Step 4: Mark chat as read
    const markRes = http.post(`${BASE_URL}/api/v1/messages/chat/${chatId}/read`, null, {
      headers,
      tags: { name: 'POST /messages/chat/:chatId/read' },
    });

    const markOk = check(markRes, {
      'POST /messages/chat/:chatId/read status 2xx': r => r.status >= 200 && r.status < 300,
    });

    console.log(
      `[baseline] POST /messages/chat/:chatId/read (mark-chat-as-read) → HTTP ${markRes.status} | ${markRes.timings.duration.toFixed(1)}ms${markOk ? '' : ' ⚠ FAILED'}`,
    );
  } else {
    console.log('[baseline] ⚠ Could not extract chatId — skipping message endpoints');
  }
}
