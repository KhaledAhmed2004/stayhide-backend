/**
 * seed-support-ticket.js — Load test fixture generator for Support-Ticket module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-support-ticket.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 5 support tickets with varying statuses, categories, and priorities
 *   - 2-3 replies (messages) per ticket (total ~12 messages)
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (tickets, ticketMessages) → modules/support-ticket/fixtures/support-ticket-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed support ticket data before seeding.
 */

'use strict';

const path = require('path');

// ── Bootstrap TypeScript support ─────────────────────────────────────────────
require('ts-node').register({
  project: path.join(__dirname, '../../tsconfig.json'),
  transpileOnly: true,
});

// ── Env loading ───────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const MODULE_NAME = 'support-ticket';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { SupportTicket } = require('../../src/app/modules/support-ticket/support-ticket.model');
const { TicketMessage } = require('../../src/app/modules/support-ticket/support-ticket.model');

// ── Ticket data definitions ───────────────────────────────────────────────────
const TICKET_DEFINITIONS = [
  { subject: 'loadtest-ticket-billing-issue', category: 'BILLING', status: 'OPEN', priority: 'HIGH' },
  { subject: 'loadtest-ticket-account-help', category: 'ACCOUNT', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { subject: 'loadtest-ticket-bug-report', category: 'BUG', status: 'OPEN', priority: 'HIGH' },
  { subject: 'loadtest-ticket-feature-request', category: 'FEATURE', status: 'RESOLVED', priority: 'LOW' },
  { subject: 'loadtest-ticket-general-inquiry', category: 'OTHER', status: 'CLOSED', priority: 'MEDIUM' },
];

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  // ── Step 1: Connect to database ─────────────────────────────────────────────
  const MONGODB_URI = process.env.LOAD_TEST_DB || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(`[seed-${MODULE_NAME}] No MongoDB URI found. Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI.`);
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-${MODULE_NAME}] Connected to database.`);

  // ── Read shared users from base fixtures ────────────────────────────────────
  if (!fs.existsSync(BASE_FIXTURES_PATH)) {
    console.error(`[seed-${MODULE_NAME}] Base fixtures not found at ${BASE_FIXTURES_PATH}. Run seed-groups.js first.`);
    process.exit(1);
  }
  const baseFixtures = JSON.parse(fs.readFileSync(BASE_FIXTURES_PATH, 'utf-8'));
  const { adminUser, brotherUsers } = baseFixtures;

  if (!brotherUsers || brotherUsers.length < 5) {
    console.error(`[seed-${MODULE_NAME}] Not enough brother users in base fixtures. Need at least 5.`);
    process.exit(1);
  }

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test support ticket data...`);

  // Delete tickets with loadtest- prefixed subjects
  const existingTickets = await SupportTicket.find({ subject: { $regex: /^loadtest-/ } });
  const ticketIdsToDelete = existingTickets.map(t => t._id);

  if (ticketIdsToDelete.length > 0) {
    await TicketMessage.deleteMany({ ticketId: { $in: ticketIdsToDelete } });
    await SupportTicket.deleteMany({ _id: { $in: ticketIdsToDelete } });
  }

  // Also clean up any messages with loadtest- prefix
  await TicketMessage.deleteMany({ message: { $regex: /^loadtest-/ } });

  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${ticketIdsToDelete.length} tickets.`);

  // ── Step 3: Create support tickets with replies ─────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating support tickets with replies...`);

  const tickets = [];
  const ticketMessages = [];

  for (let i = 0; i < TICKET_DEFINITIONS.length; i++) {
    const def = TICKET_DEFINITIONS[i];
    const userId = new mongoose.Types.ObjectId(brotherUsers[i].id);
    const adminId = new mongoose.Types.ObjectId(adminUser.id);

    // Create the ticket
    const ticket = await SupportTicket.create({
      ticketNumber: `loadtest-TKT-${String(i + 1).padStart(4, '0')}`,
      userId: userId,
      subject: def.subject,
      category: def.category,
      status: def.status,
      priority: def.priority,
      assignedAdminId: i < 3 ? adminId : null,
      lastReplyAt: new Date(),
      lastReplyBy: i % 2 === 0 ? 'USER' : 'ADMIN',
      messagesCount: 0,
    });

    // Create initial user message
    const userMsg = await TicketMessage.create({
      ticketId: ticket._id,
      senderType: 'USER',
      senderId: userId,
      message: `loadtest-msg-${i}-0 Initial message for ticket ${i}`,
      attachments: [],
    });
    ticketMessages.push({
      id: userMsg._id.toString(),
      ticketId: ticket._id.toString(),
      senderId: brotherUsers[i].id,
      senderType: 'USER',
    });

    // Create admin reply
    const adminMsg = await TicketMessage.create({
      ticketId: ticket._id,
      senderType: 'ADMIN',
      senderId: adminId,
      message: `loadtest-msg-${i}-1 Admin reply to ticket ${i}`,
      attachments: [],
    });
    ticketMessages.push({
      id: adminMsg._id.toString(),
      ticketId: ticket._id.toString(),
      senderId: adminUser.id,
      senderType: 'ADMIN',
    });

    // Create a follow-up user reply for the first 3 tickets
    if (i < 3) {
      const followUpMsg = await TicketMessage.create({
        ticketId: ticket._id,
        senderType: 'USER',
        senderId: userId,
        message: `loadtest-msg-${i}-2 Follow-up from user on ticket ${i}`,
        attachments: [],
      });
      ticketMessages.push({
        id: followUpMsg._id.toString(),
        ticketId: ticket._id.toString(),
        senderId: brotherUsers[i].id,
        senderType: 'USER',
      });
    }

    // Update messagesCount on the ticket
    const msgCount = i < 3 ? 3 : 2;
    await SupportTicket.findByIdAndUpdate(ticket._id, { messagesCount: msgCount });

    tickets.push({
      id: ticket._id.toString(),
      userId: brotherUsers[i].id,
      subject: def.subject,
      status: def.status,
      category: def.category,
      priority: def.priority,
      ticketNumber: ticket.ticketNumber,
    });
  }

  console.log(`[seed-${MODULE_NAME}] Created ${tickets.length} tickets with ${ticketMessages.length} messages.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    tickets,
    ticketMessages,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${tickets.length} support tickets (various statuses/categories)`);
  console.log(`  - ${ticketMessages.length} ticket messages (2-3 per ticket)`);
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
seed()
  .then(() => {
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
