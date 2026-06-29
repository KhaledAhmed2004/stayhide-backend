# Real-Time Patterns — WebSocket, SSE & Polling

Read this when deciding how to deliver live updates: match scores, booking notifications, club activity feeds, chat.

---

## 1. Decision Guide — Choose the Right Pattern

| Scenario | Best fit | Why |
|---|---|---|
| Live match scores | WebSocket | Bidirectional, low-latency, high-frequency updates |
| Booking confirmation push | SSE | Server-to-client only, simple, works over HTTP |
| Notification bell count | SSE or polling | Infrequent, no user action needed |
| Club activity feed (infinite scroll) | Polling or SSE | Acceptable slight delay |
| Real-time chat | WebSocket | Bidirectional by nature |
| Admin dashboard live stats | SSE | One-way data stream, easy to implement |
| File processing progress | SSE | Server streams progress events to client |
| Background job status | Polling | Simple, client-initiated, low complexity |

**Rule of thumb**:
- Need **bidirectional** communication (client sends + receives)? → **WebSocket**
- **Server pushes only**, client never sends data after connecting? → **SSE**
- Updates are **infrequent** or latency tolerance > 10s? → **Polling**

---

## 2. Socket.io (WebSocket) — Setup

Socket.io is the industry standard for WebSocket in Node.js. It handles reconnection, fallback to long-polling, and rooms (grouping clients) out of the box.

### Install
```bash
npm install socket.io
npm install -D @types/socket.io
```

### `src/config/socket.ts`

```typescript
import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../shared/logger';

let io: SocketServer;

export const initSocket = (httpServer: HTTPServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware — validate JWT before any connection is accepted
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
      socket.data.user = decoded; // attach user to socket for all handlers
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId } = socket.data.user;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Join a user-specific room — enables targeted notifications
    socket.join(`user:${userId}`);

    // Join a club room (client sends which club they're viewing)
    socket.on('join:club', (clubId: string) => {
      socket.join(`club:${clubId}`);
    });

    socket.on('leave:club', (clubId: string) => {
      socket.leave(`club:${clubId}`);
    });

    socket.on('disconnect', () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
};

// Export for use in services (emit events from anywhere)
export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
};
```

### `src/server.ts` — attach to HTTP server

```typescript
import http from 'http';
import app from './app';
import { initSocket } from './config/socket';

const httpServer = http.createServer(app);
initSocket(httpServer); // Socket.io MUST attach to the HTTP server, not the Express app

httpServer.listen(process.env.PORT || 5000, () => {
  logger.info('Server started');
});
```

### Emitting from a service

```typescript
// src/modules/bookings/bookings.service.ts
import { getIO } from '../../config/socket';

const create = async (payload: TBookingCreate, userId: string) => {
  const booking = await Booking.create({ ...payload, userId });

  // Push confirmation to the specific user — wherever they're connected
  getIO().to(`user:${userId}`).emit('booking:confirmed', {
    bookingId: booking._id,
    message: 'Your booking is confirmed',
    slot: booking.slot,
  });

  // Notify the turf owner
  getIO().to(`user:${payload.turfOwnerId}`).emit('booking:new', {
    bookingId: booking._id,
    message: 'New booking received',
  });

  return booking;
};
```

### Common event naming conventions

```
booking:confirmed          ← resource + event
booking:cancelled
match:score-updated
club:member-joined
notification:new
user:typing                ← for chat
```

---

## 3. Server-Sent Events (SSE) — Simple Server Push

SSE is HTTP-based — no special library needed. The client opens one long-lived GET request and the server streams events. Simpler than WebSocket for server-to-client-only flows.

```typescript
// src/modules/notifications/notifications.controller.ts
const stream = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // SSE headers — tell the client this is a streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  // Send a heartbeat every 30s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Subscribe to this user's notification events
  const handler = (notification: unknown) => {
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  };

  // In a real implementation use Redis pub/sub or an event emitter
  notificationEmitter.on(`user:${userId}`, handler);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationEmitter.off(`user:${userId}`, handler);
  });
});

// Route — no body, no rate limiting (it's a stream)
router.get('/stream', auth(), NotificationController.stream);
```

### Client-side SSE usage
```javascript
const source = new EventSource('/api/v1/notifications/stream', {
  headers: { Authorization: `Bearer ${token}` },
});

source.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // update UI
};

source.onerror = () => {
  // browser auto-reconnects after 3s by default
};
```

---

## 4. Polling — Simplest Option

Use when updates are infrequent or slight latency is acceptable.

```typescript
// Standard REST endpoint — client polls on a timer
GET /api/v1/notifications?unreadOnly=true&since=2024-01-01T10:00:00Z

// Client polls every 30s
setInterval(() => {
  fetch('/api/v1/notifications?unreadOnly=true')
    .then(r => r.json())
    .then(updateBadgeCount);
}, 30_000);
```

This is just a normal GET endpoint with a `since` filter — nothing special to implement on the server side.

---

## 5. REST vs Real-Time Decision Tree

```
Does the client need to receive updates WITHOUT initiating a request?
│
├─ No  → Use standard REST (polling if updates are needed periodically)
│
└─ Yes → Does the client also need to SEND data over the same connection?
         │
         ├─ Yes (chat, collaborative editing, live game actions)
         │   └─ Use WebSocket (Socket.io)
         │
         └─ No (notifications, live scores, progress updates)
             └─ How frequent are the updates?
                ├─ < every 10s → Use SSE
                └─ > every 10s → Use polling
```
