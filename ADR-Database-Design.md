# Architecture Decision Record (ADR): Centralized Database Architecture & Schema Design

## 1. Title & Status
**Title:** Design and Implementation of a Centralized Database Architecture for Health & Wellness Application (Stayhide)
**Status:** Approved / Active

## 2. Context & Background
The application requires a robust, scalable, and centralized database to manage users, their health data (diet, symptoms, medications), communication (chat, support tickets), and billing (subscriptions). Based on the fields (`ObjectId`, `Array`, `Embedded`, `Mixed`), the system utilizes a **NoSQL Database (MongoDB)**. This document outlines how the database is structured, what each field represents, and how different collections relate to each other in detail.

## 3. Decision (কী সিদ্ধান্ত নেওয়া হয়েছে)
**Decision:** We will use MongoDB (NoSQL) as the primary data store, employing a centralized identity model where all secondary domains strongly reference a central `User` document.

## 3.1. Database Architecture Strategy
- **Centralized User Hub:** The `User` collection acts as the core of the database. Almost all other collections maintain a reference to the User using `ObjectId`.
- **Referential Integrity vs. Embedded:** We use **References** (`ObjectId`) for scalable collections (e.g., Messages, Logs, Tickets) and **Embedded** documents for data strictly bound to a single parent (e.g., authentication details inside User, lastMessage inside Chat).
- **Time-Series Nature:** Collections like `SymptomLog`, `DietLog`, and `MedicationLog` are time-series in nature, tracking daily user inputs.

---

## 4. Schema Details & Data Dictionary (Full Details / প্রতিটি ফিল্ডের বিস্তারিত)

All collections by default contain the following fields which are not explicitly repeated in every schema below unless specific context is needed:
- `_id` (ObjectId): Primary Key.
- `createdAt` (Date): Timestamp when the document was created.
- `updatedAt` (Date): Timestamp when the document was last updated.

### 4.1. Core Identity & User Management

**`User` Collection** (Core entity)
- `name` (String): Full name of the user.
- `role` (String): System role (e.g., User, Admin).
- `email` (String): Primary contact and login email.
- `password` (String): Hashed password for authentication.
- `passwordHistory` (Array): Tracks old passwords to prevent reuse.
- `dateOfBirth` (Date): User's birth date for personalized health metrics.
- `profileImage` (String): URL of the user's avatar.
- `status` (String): Current account status (Active, Suspended, etc.).
- `isVerified` (Boolean): Indicates if the email address has been verified.
- `tokenVersion` (Number): Used for invalidating all active sessions/tokens upon password reset.
- `googleId` (String): ID for Google OAuth login.
- `appleId` (String): ID for Apple OAuth login.
- `subscriptionTier` (String): Caches current subscription level.
- `subscriptionStatus` (String): Caches if the subscription is active/expired.
- `subscriptionExpiryDate` (Date): Exact expiry date for easy UI rendering.
- `appleOriginalTransactionId` (String): Links to the primary Apple App Store purchase.
- `googlePurchaseToken` (String): Links to the primary Google Play Store purchase.
- `authentication` (Embedded): Nested object for OTPs/2FA or additional auth logic.
- `emailChange` (Embedded): Pending email change request details.
- `deletedAt` (Date): Soft delete timestamp.
- `recoveryDeadline` (Date): Time limit for recovering a soft-deleted account.
- `isDailySymptomReminderEnabled` (Boolean): User preference for daily push notifications.
- `timezone` (String): User's local timezone for accurate scheduled notifications.

**`DeviceToken` Collection** (Push Notification Tokens)
- `user` (ObjectId): Reference to the `User`.
- `token` (String): The actual FCM/APNS push token.
- `tokenHash` (String): Hashed token for secure lookups.
- `tokenPrefix` (String): First few characters of token for grouping/debugging.
- `platform` (String): OS of the device (iOS, Android, Web).
- `appVersion` (String): Installed app version.
- `firstSeenAt` (Date): First time this device connected.
- `lastSeenAt` (Date): Most recent activity from this device.
- `lastSeenIpHash` (String): Anonymized IP tracking for security.
- `lastSeenCity` (String): Estimated location of the device.
- `userAgent` (String): Browser or client user agent string.

**`ResetToken` Collection** (Password Reset System)
- `user` (ObjectId): Reference to the `User` requesting the reset.
- `token` (String): Unique, time-limited reset string.
- `expireAt` (Date): Exact time when the token becomes invalid.

### 4.2. Health & Wellness Tracking

**`DietLog` Collection** (Daily Meals)
- `user` (ObjectId): Reference to the `User`.
- `date` (String): Formatted date string (e.g., 'YYYY-MM-DD').
- `mealType` (String): Category (e.g., Breakfast, Lunch, Dinner).
- `name` (String): What the user ate.
- `note` (String): Additional context.

**`SymptomLog` Collection** (Menopause & General Symptoms)
- `user` (ObjectId): Reference to the `User`.
- `date` (String): Formatted date string.
- `hotFlashes_count` (Number): Frequency of hot flashes.
- `hotFlashes_severity` (Number): Severity scale.
- `nightSweats_severity` (Number): Severity scale.
- `mood_value` (String): Description/Scale of mood.
- `sleep_hours` (Number): Duration of sleep.
- `sleep_quality` (Number): Rating of sleep quality.
- `brainFog_severity` (Number): Severity scale.
- `jointPain_severity` (Number): Severity scale.
- `fatigue_severity` (Number): Severity scale.
- `anxiety_severity` (Number): Severity scale.
- `additionalNotes` (String): Free text notes.

### 4.3. Medication Management

**`Medication` Collection** (The Blueprint/Prescription)
- `user` (ObjectId): Reference to the `User`.
- `name` (String): Name of the medication.
- `dosage_amount` (Number): Quantity per dose (e.g., 500).
- `dosage_unit` (String): Unit of measurement (e.g., mg, ml).
- `type` (String): Form factor (e.g., Pill, Liquid).
- `notes` (String): Doctor's instructions or user notes.
- `startDate` (Date): When the regimen starts.
- `endDate` (Date): When the regimen ends (if applicable).
- `isOngoing` (Boolean): True if it's a permanent/recurring medication.
- `frequency_frequencyType` (String): Daily, Weekly, Custom, etc.
- `frequency_interval` (Number): E.g., every 2 days.
- `frequency_intervalUnit` (String): Days, Weeks, etc.
- `frequency_daysOfWeek` (Array): Specific days (Monday, Wednesday).
- `dosingTimes` (Array): Array of specific times in a day (e.g., ['08:00', '20:00']).
- `reminder_enabled` (Boolean): Should send a push notification.
- `reminder_minutesBefore` (Number): How early to send the reminder.
- `inventory_totalQuantity` (Number): Initial stock of medicine.
- `inventory_remainingQuantity` (Number): Current stock.
- `inventory_quantityPerDose` (Number): How much is reduced from inventory per intake.
- `status` (String): Active, Paused, or Completed.
- `archivedAt` (Date): When it was moved to history.

**`MedicationLog` Collection** (The actual intake events)
- `user` (ObjectId): Reference to the `User`.
- `medication` (ObjectId): Reference to the specific `Medication`.
- `dateString` (String): Expected date.
- `scheduledTime` (String): Expected time.
- `status` (String): Taken, Skipped, or Missed.
- `source` (String): Logged by user manually or auto-marked.
- `takenAt` (Date): Exact timestamp when marked as taken.

### 4.4. Communication & Chat

**`Chat` Collection** (Conversation Threads)
- `participants` (Array): List of `User` ObjectIds in this chat.
- `lastMessage` (Embedded): Duplicates the latest message for fast UI inbox rendering.

**`Message` Collection** (Individual Messages)
- `chatId` (ObjectId): Reference to the `Chat`.
- `sender` (ObjectId): Reference to the `User` who sent it.
- `text` (String): The message body.
- `type` (String): Text, Image, System, etc.
- `attachments` (Array): List of file/image URLs.
- `readBy` (Array): List of `User` ObjectIds who have seen this.

**`ChatSession` Collection** (AI/Contextual Sessions)
- `user` (ObjectId): Reference to the `User`.
- `title` (String): Subject of the session.
- `messages` (Array): Inline messages for AI Context or specialized threads.

### 4.5. Support & Helpdesk

**`SupportTicket` Collection** (User Issues)
- `ticketNumber` (String): Sequential human-readable ID (e.g., #TKT-1001).
- `userId` (ObjectId): Reference to the `User` needing help.
- `subject` (String): Main topic.
- `category` (String): Bug, Billing, General.
- `status` (String): Open, In Progress, Closed.
- `priority` (String): Low, Medium, High.
- `assignedAdminId` (ObjectId): Reference to the Admin `User` handling this.
- `lastReplyAt` (Date): Timestamp for sorting inbox.
- `lastReplyBy` (String): Indicates if last reply was from Admin or User.
- `messagesCount` (Number): Total number of messages in the thread.

**`TicketMessage` Collection** (Ticket Replies)
- `ticketId` (ObjectId): Reference to `SupportTicket`.
- `senderType` (String): Admin or User.
- `senderId` (ObjectId): Reference to the specific `User` (or Admin).
- `message` (String): Reply content.
- `attachments` (Array): Uploaded screenshots or files.

### 4.6. Subscriptions & Payments

**`Subscription` Collection** (Current Status)
- `userId` (ObjectId): Reference to the `User`.
- `plan` (String): E.g., Monthly, Yearly.
- `status` (String): Active, Canceled, Past Due.
- `platform` (String): Apple, Google, Stripe.
- `environment` (String): Sandbox, Production.
- `productId` (String): Store-specific ID.
- `autoRenewing` (Boolean): True if it will charge again.
- `appleOriginalTransactionId` (String): Apple source of truth ID.
- `appleLatestTransactionId` (String): Apple most recent renewal ID.
- `googlePurchaseToken` (String): Google source of truth ID.
- `googleOrderId` (String): Google transaction ID.
- `startedAt` (Date): Initial subscription date.
- `currentPeriodEnd` (Date): When the current paid cycle ends.
- `gracePeriodEndsAt` (Date): Buffer time if payment fails.
- `canceledAt` (Date): When the user pressed cancel.
- `metadata` (Mixed): Any extra provider data.

**`SubscriptionEvent` Collection** (Audit Log)
- `userId` (ObjectId): Reference to the `User`.
- `subscriptionId` (ObjectId): Reference to `Subscription`.
- `eventType` (String): Renewed, Upgraded, Canceled.
- `previousPlan` (String), `nextPlan` (String): Plan changes.
- `previousStatus` (String), `nextStatus` (String): Status changes.
- `platform` (String), `productId` (String): Context.
- `externalTransactionId` (String): Payment gateway ID.
- `metadata` (Mixed): Raw webhook payload for debugging.
- `occurredAt` (Date): Exact time of event.

### 4.7. System & Infrastructure (Notifications, Webhooks, Emails)

**`Notification` Collection** (In-app notifications for users)
- `receiver` (ObjectId): Reference to the `User`.
- `type` (String): Push, In-app, System.
- `title` (String), `text` (String): Message content.
- `schemaVersion` (Number): For backwards compatibility in UI.
- `resourceType` (String), `resourceId` (String): Deep-linking info (e.g., navigate to a specific Ticket or Medication).
- `link_label` (String), `link_url` (String): Web link fallback.
- `metadata` (Mixed): Extra data payload.
- `isRead` (Boolean), `readAt` (Date): Seen status.
- `icon` (String): Display image.

**`SentNotification` Collection** (Broadcast tracking)
- `title` (String), `text` (String): The broadcasted message.
- `audience` (String): Who it was sent to (e.g., "All Users").
- `recipientCount` (Number): How many received it.

**`PendingEmail` Collection** (Email Queue Worker)
- `kind` (String): Welcome, Reset Password, etc.
- `to` (String), `subject` (String), `html` (String): Email contents.
- `status` (String): Pending, Sent, Failed.
- `attempts` (Number), `maxAttempts` (Number): Retry logic.
- `nextAttemptAt` (Date), `lastError` (String): Retry scheduling.
- `workerId` (String), `leaseExpiresAt` (Date): Concurrency locking.
- `messageId` (String), `sentAt` (Date): Success confirmation.

**`PendingWebhook` & `ProcessedWebhook` Collections** (Idempotent Webhooks)
- External incoming events (from Apple/Google/Stripe) are stored in `PendingWebhook` (`externalPurchaseId`, `provider`, `payload`).
- Once successfully applied to the database, they are logged in `ProcessedWebhook` (`webhookId`, `provider`, `processedAt`) to prevent double-processing.

**`LegalPage` Collection** (CMS for Terms/Privacy)
- `slug` (String): URL friendly identifier (e.g., 'privacy-policy').
- `title` (String): Display name.
- `content` (String): HTML or Markdown content.

---

## 5. Relationships overview (কীভাবে একটা আরেকটার সাথে যুক্ত)

Here is how the data fundamentally interconnects (Foreign Key / Reference mappings):

1. **User is Central:**
   - `User._id` is referenced by -> `DietLog.user`, `SymptomLog.user`, `Medication.user`, `MedicationLog.user`, `DeviceToken.user`, `ResetToken.user`.
2. **Medication Workflow:**
   - A `User` creates a `Medication` (Parent).
   - The system generates `MedicationLog` (Child) entries daily, linking back to `Medication._id`.
3. **Chat Workflow:**
   - A `Chat` contains an array of `User._id`s in `participants`.
   - A `Message` references `Chat._id` (where it belongs) and `User._id` (who sent it).
4. **Support Workflow:**
   - `User` creates `SupportTicket`.
   - `TicketMessage` references `SupportTicket._id`.
5. **Subscription Workflow:**
   - `Subscription` references `User._id`.
   - Store Webhooks are logged in `SubscriptionEvent`, referencing `Subscription._id`.

## 6. Consequences & Considerations
- **Pros:** Highly normalized for a NoSQL structure, ensuring data consistency. The use of robust referencing allows dynamic queries without massive document sizes. Every sub-system (Chat, Support, Meds) cleanly isolates its own data but points back to the User.
- **Cons:** Fetching a User's full dashboard (Diet, Meds, Symptoms, Chat) will require multiple queries or `$lookup` aggregations, which is standard but requires proper indexing.
- **Action Required:** Ensure indexes are created on all foreign key fields (`user`, `chatId`, `ticketId`, etc.) and compound indexes on `(user, date)` for `DietLog` and `SymptomLog` to ensure high query performance.
