# Notification Module

The Notification module handles in-app, real-time (Socket.io), and push (FCM) notifications for the OKJT100 platform. It includes features for users to manage their notifications and for admins to broadcast messages to specific audiences.

## Core Features
- **Real-time Delivery**: Instant notification delivery via Socket.io.
- **Push Notifications**: Mobile device notifications via Firebase Cloud Messaging.
- **Admin Broadcast**: Targeted messaging to all users, brothers only, sisters only, or specific mosque members.
- **Persistence**: Full history of notifications stored in MongoDB.
- **Sent History**: Admin log of all broadcasted notifications.

## Endpoint Inventory

### User Notifications
- [01-Get My Notifications](01-get-my-notifications.md) - Fetch notifications for the logged-in user (`GET /notifications/me`).
- [02-Mark as Read](02-mark-as-read.md) - Mark a specific notification as read.
- [03-Mark All as Read](03-mark-all-as-read.md) - Mark all notifications as read.

### Admin Tools
- [04-Send Broadcast](04-send-broadcast.md) - Send a notification to a targeted audience.
- [05-Get Sent History](05-get-sent-history.md) - Retrieve the log of notifications sent by admins.

## Implementation Details
- **Builder Pattern**: Uses `NotificationBuilder` for unified delivery across all channels.
- **Channel Support**: Database, Socket, and Push.
- **Audience Targeting**: Supports `all`, `brothers`, `sisters`, and `mosque`.
