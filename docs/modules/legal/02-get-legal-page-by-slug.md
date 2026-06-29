# 02. Get Legal Page by Slug

```http
GET /legal/:slug
Auth: None
```

> Slug diye specific legal page-er full HTML/Markdown content fetch korar jonno.

## Business Logic (`getBySlug`)
- **Public Access**: Authentication chada-i access kora jay.
- **Error Handling**: Jodi slug match na kore, tobe 404 Not Found error return kora hoy.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Legal page content retrieved successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d10",
    "title": "Terms and Conditions",
    "slug": "terms-and-conditions",
    "content": "<h1>Terms and Conditions</h1><p>Welcome to our application...</p>"
  }
}
```
