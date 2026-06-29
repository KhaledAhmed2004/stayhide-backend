# Redis — How It Works in This Project (Beginner Friendly)

---

## 🧠 What is Redis? (Simple Explanation)

Think of Redis like a **super-fast sticky note board**.

Your main database (MongoDB) is like a filing cabinet — it stores everything permanently but takes a moment to open and search.

Redis is like a whiteboard right next to you — you write small things on it (like "User A has 3 unread messages") and you can read them back in **milliseconds**. If the power goes out, the whiteboard gets wiped — but that's okay because the data there is just a fast shortcut, not the source of truth.

In this project, Redis stores three types of "sticky notes":

| What | Redis Key | Example |
|------|-----------|---------|
| How many unread messages a user has in a chat | `unread:{chatId}:{userId}` | `unread:abc123:user456 = 3` |
| Which chat a user currently has open | `active:{userId}:chat` | `active:user456:chat = abc123` |
| "We already sent a push notification recently" | `notif:dedup:{chatId}:{userId}` | `notif:dedup:abc123:user456 = 1` |

---

## 📦 How Redis Was Added to This Project

Redis was **not installed as a program you run yourself** in this project. Instead, the project uses a **Node.js library called `ioredis`** that connects to a Redis server.

Here is the chain:

```
Your .env file
    ↓
REDIS_URL=redis://127.0.0.1:6379   ← the address of your Redis server
    ↓
src/config/index.ts
    ↓  reads REDIS_URL (falls back to redis://127.0.0.1:6379 if not set)
src/shared/redisClient.ts
    ↓  creates one shared ioredis connection
All services (MessageService, ChatService, SocketHelper)
    ↓  import and use redisClient
```

The key file is `src/shared/redisClient.ts`:

```typescript
import Redis from 'ioredis';
import config from '../config';

export const redisClient = new Redis(config.redis_url as string, {
  lazyConnect: false,
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
});

redisClient.on('error', () => {
  // Errors are handled gracefully — the app does NOT crash if Redis is down
  // Unread counts just fall back to 0
});
```

**Important:** `ioredis` reconnects automatically if Redis goes down. The app will keep running — unread counts just show 0 until Redis comes back.

---

## 🖥️ Do You Need to Install Redis on Your Computer?

**Yes, if you are running the project locally.**

Redis is a separate program (like MongoDB) that runs in the background. Your Node.js app connects to it over the network.

### Option A — Windows (Recommended: Use WSL or Docker)

Redis does not have an official Windows installer. The easiest ways on Windows are:

#### Option A1 — Docker (Easiest)

If you have Docker Desktop installed:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

This starts Redis on port 6379. It runs in the background. That's it.

To stop it:
```bash
docker stop redis
```

To start it again later:
```bash
docker start redis
```

#### Option A2 — WSL (Windows Subsystem for Linux)

If you have WSL2 installed, open your WSL terminal and run:

```bash
sudo apt update
sudo apt install redis-server -y
sudo service redis-server start
```

#### Option A3 — Memurai (Windows Native)

Download from: https://www.memurai.com/  
It is a Redis-compatible server that runs natively on Windows. Free for development.

---

### Option B — Cloud Redis (If deploying to a server)

For production, you would use a hosted Redis service like:
- **Upstash** (free tier available) — https://upstash.com
- **Redis Cloud** — https://redis.com/try-free
- **AWS ElastiCache**

You get a URL like `redis://default:password@your-host:6379` and put it in your `.env` file as `REDIS_URL`.

---

## ⚙️ Setting Up Your .env File

Open `.env` in the project root. You will see it does **not** have a `REDIS_URL` line yet (it is not in `.env.example`). Add it:

```env
REDIS_URL=redis://127.0.0.1:6379
```

`127.0.0.1` means "this same computer". `6379` is the default Redis port.

If you are using a cloud Redis, it would look like:
```env
REDIS_URL=redis://default:mypassword@my-redis-host.upstash.io:6379
```

If you do **not** add `REDIS_URL`, the project falls back to `redis://127.0.0.1:6379` automatically (see `src/config/index.ts` line: `redis_url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'`).

---

## ✅ How to Check If Redis Is Working

### Step 1 — Check if Redis is running

Open a terminal and type:

```bash
redis-cli ping
```

If Redis is running, you will see:
```
PONG
```

If you see an error like `Could not connect`, Redis is not running. Start it using one of the methods above.

> **If you used Docker:** `docker exec -it redis redis-cli ping`
> **If you used WSL:** run `redis-cli ping` inside your WSL terminal

---

### Step 2 — Start your Node.js server and watch the logs

```bash
npm run dev
```

Look at the terminal output. If Redis connects successfully, you will **not** see any Redis error. If it fails to connect, you will see something like:

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

That means Redis is not running. Go back to Step 1.

---

### Step 3 — Test Redis manually using redis-cli

`redis-cli` is a command-line tool that lets you talk to Redis directly, like a chat window with your Redis server.

Open a terminal and type:

```bash
redis-cli
```

You will see a prompt like `127.0.0.1:6379>`. Now you can type commands:

#### Check if it's alive
```
ping
```
Expected: `PONG`

#### See all keys currently stored
```
keys *
```
When the app is running and users are chatting, you will see keys like:
```
1) "unread:664f1a2b:507f1f77"
2) "active:507f1f77:chat"
3) "notif:dedup:664f1a2b:507f1f77"
```

If the list is empty, no one has sent a message yet — that is normal.

#### Read a specific unread count
```
get unread:664f1a2b3c4d5e6f7a8b9c0d:507f1f77bcf86cd799439013
```
Expected: a number like `"3"`, or `(nil)` if the key does not exist yet.

#### Check which chat a user has open
```
get active:507f1f77bcf86cd799439013:chat
```
Expected: a chatId string, or `(nil)` if the user is not currently in any chat.

#### Manually set a test value
```
set test:hello "world"
get test:hello
```
Expected: `"world"` — this confirms Redis is reading and writing correctly.

#### Delete the test key when done
```
del test:hello
```

#### Exit redis-cli
```
exit
```

---

### Step 4 — Test the full flow end-to-end

1. Start your server (`npm run dev`)
2. Open Postman and log in as two different users (User A and User B)
3. User A sends a message to User B via `POST /api/v1/messages`
4. Open `redis-cli` and run `keys *`
5. You should see a key like `unread:{chatId}:{userBId}` with value `"1"`
6. User B calls `POST /api/v1/messages/chat/{chatId}/read`
7. Run `get unread:{chatId}:{userBId}` again — it should now be `"0"`

If you see these values changing correctly, **Redis is working perfectly**.

---

## 🔴 What Happens If Redis Goes Down?

The app is designed to **not crash** if Redis is unavailable. Here is what degrades gracefully:

| Feature | Without Redis |
|---------|--------------|
| Unread counts in chat list | Shows `0` for everyone |
| Push notification deduplication | May send duplicate push notifications |
| Active-chat routing | Falls back to sending push notification |
| Typing indicators | Not affected (uses node-cache in memory) |
| Sending/receiving messages | ✅ Works normally |
| Message history | ✅ Works normally |

So if Redis goes down, users can still chat — they just might see wrong unread counts temporarily.

---

## 📋 Quick Reference Cheat Sheet

```bash
# Start Redis with Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Check if Redis is running
redis-cli ping

# Open Redis command line
redis-cli

# See all stored keys
keys *

# Read a value
get <key>

# Delete a value
del <key>

# Stop Redis (Docker)
docker stop redis

# Start Redis again (Docker)
docker start redis
```

---

## 🗂️ Files in This Project That Use Redis

| File | What it does with Redis |
|------|------------------------|
| `src/shared/redisClient.ts` | Creates the single shared Redis connection |
| `src/app/helpers/unreadHelper.ts` | Read/write/increment unread counts |
| `src/app/modules/message/message.service.ts` | Increments unread on send, resets on markRead, dedup push notifications |
| `src/app/modules/chat/chat.service.ts` | Batch-reads all unread counts for the chat list |
| `src/helpers/socketHelper.ts` | Writes/deletes `active:{userId}:chat` on JOIN_CHAT, LEAVE_CHAT, disconnect |
