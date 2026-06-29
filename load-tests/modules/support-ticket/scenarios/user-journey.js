/**
 * user-journey.js — User journey scenario for Support-Ticket API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates complete support flow:
 * create ticket → view my tickets → reply → view messages → admin updates status → admin assigns.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

export function runUserJourney() {
  const vuIndex = __VU - 1;
  const userHeaders = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const adminHeaders = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  // ── Step 1: Create a ticket ─────────────────────────────────────────────────
  const s1 = http.post(
    `${BASE_URL}/api/v1/support-tickets`,
    JSON.stringify({
      subject: `loadtest-journey-ticket VU${__VU}`,
      message: `Journey ticket from VU${__VU} at ${Date.now()}`,
    }),
    { headers: userHeaders, tags: { name: 'journey:create-ticket' } },
  );
  check(s1, { 'Step1:create-ticket 2xx': r => r.status >= 200 && r.status < 300 });

  let ticketId = null;
  try {
    const body = JSON.parse(s1.body);
    ticketId = body?.data?.ticket?.id || body?.data?._id || body?.data?.id || null;
  } catch (_) {}
  if (!ticketId) {
    // fallback: use a fixture ticket owned by this VU's user
    ticketId = fixtures.tickets[vuIndex % fixtures.tickets.length].id;
  }
  sleep(1);

  // ── Step 2: View my tickets ─────────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/support-tickets/my`, {
    headers: userHeaders,
    tags: { name: 'journey:my-tickets' },
  });
  check(s2, { 'Step2:my-tickets 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 3: Reply to ticket ─────────────────────────────────────────────────
  const s3 = http.post(
    `${BASE_URL}/api/v1/support-tickets/${ticketId}/reply`,
    JSON.stringify({ message: `Journey reply from VU${__VU} ${Date.now()}` }),
    { headers: userHeaders, tags: { name: 'journey:reply' } },
  );
  check(s3, { 'Step3:reply 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 4: View ticket messages ────────────────────────────────────────────
  const s4 = http.get(`${BASE_URL}/api/v1/support-tickets/${ticketId}/messages`, {
    headers: userHeaders,
    tags: { name: 'journey:view-messages' },
  });
  check(s4, { 'Step4:view-messages 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);

  // ── Step 5: Admin updates ticket status ─────────────────────────────────────
  // Use OPEN or IN_PROGRESS only — avoid cycling into terminal states
  const s5 = http.patch(
    `${BASE_URL}/api/v1/support-tickets/admin/${ticketId}/status`,
    JSON.stringify({ status: 'IN_PROGRESS' }),
    { headers: adminHeaders, tags: { name: 'journey:admin-update-status' } },
  );
  // Accept 200 success OR 400 if ticket already in this state
  check(s5, { 'Step5:admin-update-status 2xx': r => r.status >= 200 && r.status < 300 || r.status === 400 });
  sleep(1);

  // ── Step 6: Admin assigns ticket ────────────────────────────────────────────
  const adminId = fixtures.adminUser ? fixtures.adminUser.id : fixtures.adminUserRef.id;
  const s6 = http.patch(
    `${BASE_URL}/api/v1/support-tickets/admin/${ticketId}/assign`,
    JSON.stringify({ assigneeId: adminId }),
    { headers: adminHeaders, tags: { name: 'journey:admin-assign' } },
  );
  check(s6, { 'Step6:admin-assign 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
