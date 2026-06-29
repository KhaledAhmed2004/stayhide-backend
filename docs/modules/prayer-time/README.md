# Prayer Time Calculation Module APIs

> **Section**: Backend API specifications for the Prayer Time Calculation module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Home Page Salat times widget (real-time, location-based prayer times)
> - App - Prayer times calendar (check timings for a specific day or location)

---

## Technical Concept

Calculates exact daily prayer times dynamically and entirely **offline** based on geographical coordinates (latitude and longitude) and dates using precise solar/astronomical equations. This guarantees 100% availability, zero network dependency, and microsecond response times.

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | GET | `/prayer-times` | None | **Done**: Dynamically calculates precise daily Salat times (including Jummah on Fridays) based on GPS coordinates. | [01-get-prayer-times.md](./01-get-prayer-times.md) |
