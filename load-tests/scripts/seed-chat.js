/**
 * seed-chat.js — Load test fixture generator for Chat module
 *
 * Node.js script (CommonJS). Run with: node load-tests/scripts/seed-chat.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 10 chat rooms between pairs of fixture users
 *   - 3 messages per chat room (30 total)
 *
 * Reads:
 *   - Shared users from shared/fixtures/base-fixtures.json
 *
 * Writes:
 *   - Module fixtures (chatRooms, messageIds) → modules/chat/fixtures/chat-fixtures.json
 *
 * Idempotent: deletes all prior "loadtest-" prefixed chat data before seeding.
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
const MODULE_NAME = 'chat';
const BASE_FIXTURES_PATH = path.join(__dirname, '../shared/fixtures/base-fixtures.json');
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

// ── Import models ─────────────────────────────────────────────────────────────
const { Chat } = require('../../src/app/modules/chat/chat.model');
const { Message } = require('../../src/app/modules/message/message.model');

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
  const { brotherUsers, sisterUsers } = baseFixtures;

  if (!brotherUsers || brotherUsers.length < 5) {
    console.error(`[seed-${MODULE_NAME}] Not enough brother users in base fixtures. Need at least 5.`);
    process.exit(1);
  }
  if (!sisterUsers || sisterUsers.length < 5) {
    console.error(`[seed-${MODULE_NAME}] Not enough sister users in base fixtures. Need at least 5.`);
    process.exit(1);
  }

  // ── Step 2: Idempotent cleanup ──────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Cleaning up previous load-test chat data...`);

  // Find all chats that involve loadtest users (by participant IDs from base fixtures)
  const allUserIds = [
    baseFixtures.adminUser.id,
    ...brotherUsers.map(u => u.id),
    ...sisterUsers.map(u => u.id),
  ].map(id => new mongoose.Types.ObjectId(id));

  // Delete messages that have text starting with "loadtest-"
  await Message.deleteMany({ text: { $regex: /^loadtest-/ } });

  // Delete chats where both participants are loadtest users
  const loadTestChats = await Chat.find({
    participants: { $all: [{ $elemMatch: { $in: allUserIds } }] },
  });

  // Filter to only chats where ALL participants are loadtest users
  const chatIdsToDelete = loadTestChats
    .filter(chat => chat.participants.every(p => allUserIds.some(uid => uid.equals(p))))
    .map(chat => chat._id);

  if (chatIdsToDelete.length > 0) {
    await Message.deleteMany({ chatId: { $in: chatIdsToDelete } });
    await Chat.deleteMany({ _id: { $in: chatIdsToDelete } });
  }

  console.log(`[seed-${MODULE_NAME}] Cleanup complete. Removed ${chatIdsToDelete.length} chats.`);

  // ── Step 3: Create chat rooms between fixture users ─────────────────────────
  console.log(`[seed-${MODULE_NAME}] Creating chat rooms...`);

  const chatRooms = [];
  const messageIds = [];

  // Create 5 chats between brother users (brother[i] <-> brother[i+1])
  for (let i = 0; i < 5; i++) {
    const participant1 = new mongoose.Types.ObjectId(brotherUsers[i].id);
    const participant2 = new mongoose.Types.ObjectId(brotherUsers[i + 1].id);

    const chat = await Chat.create({
      participants: [participant1, participant2],
      lastMessage: null,
    });

    chatRooms.push({
      chatId: chat._id.toString(),
      participants: [brotherUsers[i].id, brotherUsers[i + 1].id],
    });

    // Create 3 messages per chat
    for (let m = 0; m < 3; m++) {
      const sender = m % 2 === 0 ? participant1 : participant2;
      const message = await Message.create({
        chatId: chat._id,
        sender: sender,
        text: `loadtest-msg-${i}-${m} Hello from chat ${i}`,
        type: 'text',
        readBy: [sender],
      });
      messageIds.push(message._id.toString());
    }

    // Update lastMessage on the chat
    const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
    if (lastMsg) {
      await Chat.findByIdAndUpdate(chat._id, {
        lastMessage: {
          text: lastMsg.text,
          sender: lastMsg.sender,
          createdAt: lastMsg.createdAt,
        },
      });
    }
  }

  // Create 5 chats between sister users (sister[i] <-> sister[i+1])
  for (let i = 0; i < 5; i++) {
    const participant1 = new mongoose.Types.ObjectId(sisterUsers[i].id);
    const participant2 = new mongoose.Types.ObjectId(sisterUsers[i + 1].id);

    const chat = await Chat.create({
      participants: [participant1, participant2],
      lastMessage: null,
    });

    chatRooms.push({
      chatId: chat._id.toString(),
      participants: [sisterUsers[i].id, sisterUsers[i + 1].id],
    });

    // Create 3 messages per chat
    for (let m = 0; m < 3; m++) {
      const sender = m % 2 === 0 ? participant1 : participant2;
      const message = await Message.create({
        chatId: chat._id,
        sender: sender,
        text: `loadtest-msg-sister-${i}-${m} Hello from chat ${i}`,
        type: 'text',
        readBy: [sender],
      });
      messageIds.push(message._id.toString());
    }

    // Update lastMessage on the chat
    const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
    if (lastMsg) {
      await Chat.findByIdAndUpdate(chat._id, {
        lastMessage: {
          text: lastMsg.text,
          sender: lastMsg.sender,
          createdAt: lastMsg.createdAt,
        },
      });
    }
  }

  console.log(`[seed-${MODULE_NAME}] Created ${chatRooms.length} chat rooms with ${messageIds.length} messages.`);

  // ── Step 4: Write module fixtures ───────────────────────────────────────────
  const moduleFixtures = {
    chatRooms,
    messageIds,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`[seed-${MODULE_NAME}] Summary:`);
  console.log(`  - ${chatRooms.length} chat rooms (5 brother pairs + 5 sister pairs)`);
  console.log(`  - ${messageIds.length} messages (3 per chat room)`);
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
