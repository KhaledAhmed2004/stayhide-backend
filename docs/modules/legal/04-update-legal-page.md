# 04. Update Legal Page

```http
PATCH /legal/:slug
Content-Type: application/json
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Existing legal page update kore.

## Business Logic (`updateBySlug`)
- **Slug Re-generation**: Jodi title change kora hoy, tobe automatically notun slug generate hoy ebong uniqueness verify kora hoy.
- **Partial Update**: Shudhu pathano fields (title ba content) update kora hoy.
