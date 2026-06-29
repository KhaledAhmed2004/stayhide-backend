# 03. Create Legal Page

```http
POST /legal
Content-Type: application/json
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Notun legal page create kore.

## Request Body
```json
{
  "title": "Terms and Conditions",
  "content": "<h1>Terms</h1><p>Welcome to...</p>"
}
```

## Business Logic (`createLegalPage`)
- **Admin Only**: Shudhu SUPER_ADMIN create korte pare.
- **Slug Generation**: Title theke `slugify` use kore unique slug generate kora hoy (lowercase & strict mode).
- **Uniqueness Check**: Jodi ek-i title-er page age thekei thake, tobe 409 Conflict error return kora hoy.
