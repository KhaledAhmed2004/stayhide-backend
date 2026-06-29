# Reset Token Module (Auth)

This module manages short-lived, single-use tokens for password reset flows.

- Generates a reset token after OTP verification.
- Validates token existence and expiration.
- Allows password updates without requiring an access JWT.

Files:
- `resetToken.model.ts` — Mongoose model with helpers.
- `resetToken.interface.ts` — Types and static method signatures.
