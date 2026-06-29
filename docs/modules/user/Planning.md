# User Module Design

## 1. Overview
The User module handles profile management, authentication rules, account lifecycle (including soft deletion), and admin-led verification processes.

---

## 2. Authentication & User Registration

### 2.1 User Roles
During registration, users must select their role:
* **BROTHER (Male)** — Requires admin verification before becoming ACTIVE.
* **SISTER (Female)** — Requires admin verification before becoming ACTIVE.
* **JUMMAH** — Community/visitor role. No admin verification needed; auto-activated upon OTP verification.

This selection is used for profile visibility, matching, group permissions, and content filtering.

### 2.2 Registration Fields

**All roles (BROTHER / SISTER / JUMMAH)**:
* **Name** (Required)
* **Email Address** (Required, Unique)
* **Password** (Required, Hashed)
* **Date of Birth** (Required, minimum 16 years)
* **Role Selection** (BROTHER / SISTER / JUMMAH)

**BROTHER / SISTER only** (additional verification fields):
* **Revert Date** (How long since becoming Muslim — required for BROTHER/SISTER)
* **Profile Picture** (Verification purposes)
* **Verification Image** (Manual admin approval)
* **Verification Video** (Manual admin approval)

> JUMMAH users skip all verification fields and are auto-activated after email OTP verification.

---

## 3. Verification System

### Admin Review Process
After registration, **BROTHER** and **SISTER** accounts are set to `PENDING`. Admins manually review:
* Verification Image
* Verification Video

Admins can **Approve** or **Reject** the user.

> **JUMMAH users bypass this process** — upon successful OTP verification, their account status is automatically set to `ACTIVE` and auth tokens are issued immediately (auto-login).

### Email Notifications
* **If Approved (BROTHER/SISTER)**: Acceptance email and welcome message.
* **If Rejected (BROTHER/SISTER)**: Rejection email with reason.

---

## 4. Login & Access Restrictions
* **Restricted Statuses**: Users with status `pending`, `rejected`, or `suspended` cannot log in.
* **Messages**:
    * “Your account is pending approval.”
    * “Your account was rejected.”
    * “Your account has been suspended.”

---

## 5. First-Time Login Setup
### Mandatory Location Access
* Location permission is required to continue past the first login.
* Used for: Nearby matching, safety, recommendations, and group discovery.

---

## 6. User Profile Module

### 6.1 Profile Information
* **Public Profile**: Name, Age, Gender, Location, Revert Duration, About Me, Revert Story, Interests (Tags), Member Since.
* **About Me**: Short intro about personality, lifestyle, goals, and journey.
* **Revert Story**: Personal journey of accepting Islam.
* **Interest Tags**: Tags for matching and community discovery (e.g., Quran Study, Sports, Fitness).

### 6.2 Verification Badge
Approved users receive a badge indicating their identity was reviewed and approved.

---

## 7. Account Management

### 7.1 Edit Profile
Users can update their About Me, Revert Story, Interests, Profile Image, and Location.

### 7.2 Account Statuses
* `pending`
* `approved`
* `rejected`
* `suspended`
* `deleted`

---

## 8. Account Deletion & Recovery (Soft Delete)

### 8.1 Deletion Process
* Users can request deletion from settings.
* **30-Day Recovery Period**: Account enters a soft-delete state.
    * Login is disabled.
    * Profile is hidden.
    * Interactions are disabled.

### 8.2 Recovery
* Users can recover their account within 30 days by logging back in and confirming restoration.

### 8.3 Permanent Deletion
* After 30 days, the account and all associated data are permanently removed.

---

## 9. Suggested Data Model
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "password": "hashed_string",
  "role": "BROTHER | SISTER | JUMMAH | ADMIN | SUPER_ADMIN",
  "revertDate": "string",
  "age": "number",
  "profileImage": "string",
  "verificationVideo": "string",
  "aboutMe": "string",
  "revertStory": "string",
  "interests": ["string"],
  "location": {
    "country": "string",
    "city": "string",
    "latitude": "number",
    "longitude": "number"
  },
  "status": "pending | approved | rejected | suspended | deleted",
  "rejectionReason": "string",
  "isVerified": "boolean",
  "joinedAt": "date",
  "deletedAt": "date",
  "recoveryDeadline": "date",
  "createdAt": "date",
  "updatedAt": "date"
}
```
