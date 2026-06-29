# 01. List Legal Pages

```http
GET /legal
Auth: None
```

> Shob available legal pages (Terms, Privacy, etc.) er title ebong slug list fetch korar jonno. Admin-side e same endpoint use kora hoy CMS list view-er jonno.

## Business Logic (`getAll`)
- **Public Access**: Authentication chada-i access kora jay.
- **Sorting**: Title-er upor vitti kore alphabetical order-e sort kora hoy (`sort({ title: 1 })`).
- **Data Selection**: Efficiency-er jonno shudhu matro `slug` ebong `title` select kora hoy, full content bad diye.

## Responses

### Scenario: Success — App view (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Legal pages retrieved successfully",
  "data": [
    { "_id": "664a1b2c3d4e5f6a7b8c9d10", "title": "Terms and Conditions", "slug": "terms-and-conditions" },
    { "_id": "664a1b2c3d4e5f6a7b8c9d11", "title": "Privacy Policy", "slug": "privacy-policy" }
  ]
}
```

### Scenario: Success — Admin CMS view (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Legal pages retrieved successfully",
  "data": [
    {
      "title": "Privacy Policy",
      "slug": "privacy-policy",
      "updatedAt": "2026-04-10T10:00:00.000Z"
    }
  ]
}
```
