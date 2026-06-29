# Legal Module APIs

> **Section**: Backend API specifications for the legal module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - [App Profile](../../app-screens/06-profile.md) — Read T&C / Privacy Policy
> - [Dashboard Legal Management](../../dashboard-screens/05-legal-management.md) — Admin CMS for legal pages

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation | Used By |
|---|---|---|---|---|---|
| 01 | GET | `/legal` | Public | [01-list-legal-pages.md](./01-list-legal-pages.md) | [App Profile], [Dashboard Legal Mgmt] |
| 02 | GET | `/legal/:slug` | Public | [02-get-legal-page-by-slug.md](./02-get-legal-page-by-slug.md) | [App Profile], [Dashboard Legal Mgmt] |
| 03 | POST | `/legal` | SUPER_ADMIN | [03-create-legal-page.md](./03-create-legal-page.md) | [Dashboard Legal Mgmt] |
| 04 | PATCH | `/legal/:slug` | SUPER_ADMIN | [04-update-legal-page.md](./04-update-legal-page.md) | [Dashboard Legal Mgmt] |
| 05 | DELETE | `/legal/:slug` | SUPER_ADMIN | [05-delete-legal-page.md](./05-delete-legal-page.md) | [Dashboard Legal Mgmt] |

---

## Edge Cases

| Scenario | Behavior |
| :--- | :--- |
| **Duplicate Slug** | `POST /legal` e existing slug dile validation error ba duplicate key error ashte pare. |
| **Invalid Slug** | GET/PATCH/DELETE request e non-existent slug dile 404 Not Found return kore. |
| **Unauthorized Access** | Non-admin user theke create/update/delete attempt korle 403 Forbidden return kore. |
| **Empty Legal Pages** | Jodi kono legal page na thake, `GET /legal` empty array return korbe (`"data": []`). Client empty state dekhabe. |

---

## API Status

| # | Endpoint | Status | Notes |
|---|---|:---:|---|
| 01 | `GET /legal` | Done | Publicly accessible — list of titles & slugs |
| 02 | `GET /legal/:slug` | Done | Publicly accessible — full page content |
| 03 | `POST /legal` | Done | Admin only |
| 04 | `PATCH /legal/:slug` | Done | Admin only |
| 05 | `DELETE /legal/:slug` | Done | Admin only |
