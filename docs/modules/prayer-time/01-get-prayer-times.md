# 01. Get Prayer Times

```http
GET /prayer-times
Content-Type: application/json
Auth: None
```

> Computes highly accurate Salat (Prayer) times dynamically and offline based on geographical coordinates (GPS) and a date.

## Query Parameters

| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `latitude` | `number` | ✅ | Latitude of the location (must be between -90 and 90) | `23.8103` |
| `longitude`| `number` | ✅ | Longitude of the location (must be between -180 and 180) | `90.4125` |
| `date` | `string` | ❌ | Target date in `YYYY-MM-DD` format (defaults to current date) | `2026-06-12` |
| `timezone` | `string` | ❌ | Standard IANA timezone identifier (defaults to `Asia/Dhaka`) | `Asia/Dhaka` |
| `madhab` | `string` | ❌ | Madhab for Asr calculation: `Hanafi` (default) or `Shafi` | `Hanafi` |
| `method` | `string` | ❌ | Calculation method authority (default: `karachi`) | `karachi` |

### Supported Calculation Methods
- `karachi` (default): University of Islamic Sciences, Karachi (common in South Asia)
- `isna`: Islamic Society of North America (ISNA)
- `mwl`: Muslim World League (MWL)
- `egyptian`: Egyptian General Authority of Survey
- `saudi`: Umm Al-Qura (Saudi Arabia)
- `turkey`: Turkey Directorate of Religious Affairs
- `qatar`: Qatar
- `singapore`: Singapore
- `dubai`: Dubai
- `kuwait`: Kuwait

---

## Implementation

- **Route**: [prayer-time.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/prayer-time/prayer-time.route.ts)
- **Controller**: [prayer-time.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/prayer-time/prayer-time.controller.ts) — `getPrayerTimes`
- **Service**: [prayer-time.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/prayer-time/prayer-time.service.ts) — `calculatePrayerTimes`
- **Validation**: [prayer-time.validation.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/prayer-time/prayer-time.validation.ts) — `getPrayerTimesZodSchema`

---

## Business Logic

1. **100% Offline Computation**: The endpoint performs astronomical calculations locally using the official `adhan` engine. There is zero latency or network dependency on 3rd party APIs.
2. **Local Midnight Date Correction**: To prevent date shifting when users are in different timezones than the server, date strings (`YYYY-MM-DD`) are processed as local midnight, matching the exact calendar date requested.
3. **Flexible Timezone Formatting**: Output timings are dynamically formatted into the requested timezone (e.g., `America/New_York` or `Asia/Dhaka`) as standard `HH:MM` (24-hour style) strings.
4. **Friday Jummah Integration**: On Fridays (day 5), the timings object dynamically includes a **`jummah`** timing matching the start time of **`dhuhr`**, making it extremely easy for frontend developers to display Jummah information.

---

## Responses

### Scenario: Success on a Friday (200 OK)

On Fridays, the response dynamically contains the `jummah` key.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Prayer times retrieved successfully",
  "data": {
    "weekday": "Friday",
    "hijriDate": "26 Dhu'l-Hijjah",
    "location": "Dhaka, Bangladesh",
    "timings": {
      "fajr": "03:43",
      "sunrise": "05:11",
      "dhuhr": "11:59",
      "asr": "16:39",
      "maghrib": "18:46",
      "isha": "20:13",
      "jummah": "11:59"
    }
  }
}
```

### Scenario: Success on other weekdays (200 OK)

On other days, the response timings contain the standard 5 prayers + sunrise.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Prayer times retrieved successfully",
  "data": {
    "weekday": "Wednesday",
    "hijriDate": "3 Dhu'l-Hijjah",
    "location": "Dhaka, Bangladesh",
    "timings": {
      "fajr": "03:50",
      "sunrise": "05:14",
      "dhuhr": "11:56",
      "asr": "16:34",
      "maghrib": "18:36",
      "isha": "20:00"
    }
  }
}
```

### Scenario: Validation Error - Missing Latitude (400 Bad Request)

```json
{
  "success": false,
  "message": "Validation Error",
  "errorMessages": [
    {
      "path": "query.latitude",
      "message": "Missing required field 'query.latitude'."
    }
  ]
}
```

### Scenario: Validation Error - Coordinates Out of Bounds (400 Bad Request)

```json
{
  "success": false,
  "message": "Validation Error",
  "errorMessages": [
    {
      "path": "query.latitude",
      "message": "Latitude must be between -90 and 90"
    }
  ]
}
```
