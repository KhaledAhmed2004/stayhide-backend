# 05. Delete Legal Page

```http
DELETE /legal/:slug
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Legal page delete kore.

## Business Logic (`deleteBySlug`)
- **Hard Delete**: `findOneAndDelete` use kore record permanent delete kora hoy.
- **Existence Check**: Delete korar age page-ti ache kina ta verify kora hoy (404 check).
