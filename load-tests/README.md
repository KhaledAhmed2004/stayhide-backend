# Load Tests

k6-based load testing infrastructure organized by API module. Each module has its own scenarios, fixtures, and entry point, while shared helpers and configuration are centralized for reuse.

## Prerequisites

### Required Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| [k6](https://k6.io/docs/get-started/installation/) | v0.45+ | Load test runner |
| [Node.js](https://nodejs.org/) | v18+ | Seed scripts, test runner |
| npm | (bundled with Node.js) | Script execution |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` or `DATABASE_URL` | Yes (for seeding) | MongoDB connection string. `LOAD_TEST_DB` is also accepted. |
| `JWT_SECRET` | Yes (for seeding) | Secret used to sign JWT tokens for fixture users |
| `BASE_URL` | No | API base URL for k6 scenarios. Defaults to `http://localhost:5002` |
| `STRESS_PROFILE` | No | Set to `"production"` for production-level VU counts. Defaults to local profile. |
| `SOAK_PROFILE` | No | Set to `"production"` for production-level soak duration. Defaults to local profile. |
| `SKIP_LOAD_TESTS` | No | Set to `"true"` to skip scenario execution (useful in CI) |

---

## Directory Structure

```
load-tests/
├── modules/                          # Per-module load test directories
│   └── groups/                       # Groups module (reference implementation)
│       ├── scenarios/                # k6 scenario scripts for this module
│       │   ├── baseline.js           # Single-VU smoke test
│       │   ├── chaos.js              # Fault injection / error handling
│       │   ├── read-load.js          # Read-heavy concurrent load
│       │   ├── role-auth.js          # Authorization enforcement checks
│       │   ├── soak.js               # Extended duration stability test
│       │   ├── spike.js              # Sudden traffic burst simulation
│       │   ├── stress.js             # Gradual VU ramp to breaking point
│       │   ├── user-journey.js       # Multi-step realistic user flow
│       │   └── write-load.js         # Write-heavy concurrent load
│       ├── fixtures/                 # Module-specific test data
│       │   └── group-fixtures.json   # Groups, posts, memberships
│       └── groups.load.js            # Module entry point (k6 main script)
├── shared/                           # Cross-cutting code shared by all modules
│   ├── helpers/                      # Reusable utility modules
│   │   ├── auth.js                   # Token and auth header helpers
│   │   ├── scenario-utils.js         # Stage generation, phase classification, URL resolution
│   │   └── report.js                 # Reusable handleSummary factory
│   ├── config/                       # Centralized configuration
│   │   ├── thresholds.js             # Base k6 threshold definitions
│   │   └── profiles.js               # Stress/soak stage profiles (local vs production)
│   └── fixtures/                     # Shared fixture data
│       └── base-fixtures.json        # Admin, brother, sister user accounts and tokens
├── scripts/                          # Node.js seed scripts
│   ├── seed-groups.js                # Seeds Groups module fixture data
│   └── seed-template.js              # Template for creating new module seed scripts
├── __tests__/                        # Vitest unit and property-based tests
│   ├── groups/                       # Tests for Groups module scenarios
│   │   └── advanced-scenarios.test.js
│   └── shared/                       # Tests for shared helpers
│       ├── auth.test.js
│       ├── fixtures.test.js
│       ├── report.test.js
│       ├── scenario-utils.test.js
│       └── thresholds.test.js
├── reports/                          # Generated test reports (gitignored except .gitkeep)
│   ├── groups/                       # Groups module reports
│   │   └── report.html
│   └── report.html                   # Legacy fallback report location
├── config/                           # Legacy config (thresholds migrated to shared/config/)
│   └── thresholds.js
├── helpers/                          # Legacy helpers (migrated to shared/helpers/)
│   ├── auth.js
│   ├── scenario-utils.js
│   └── seed.js
├── scenarios/                        # Legacy flat scenarios (migrated to modules/)
│   ├── baseline.js
│   ├── chaos.js
│   ├── read-load.js
│   ├── role-auth.js
│   ├── soak.js
│   ├── spike.js
│   ├── stress.js
│   ├── user-journey.js
│   └── write-load.js
└── fixtures.json                     # Legacy combined fixtures (split into shared + module)
```

---

## NPM Scripts

### Module-Specific Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `load:groups` | `k6 run --out web-dashboard load-tests/modules/groups/groups.load.js` | Run all Groups scenarios with live dashboard |
| `load:groups:stress` | `k6 run --out web-dashboard load-tests/modules/groups/scenarios/stress.js` | Run Groups stress scenario |
| `load:groups:soak` | `k6 run --out web-dashboard load-tests/modules/groups/scenarios/soak.js` | Run Groups soak scenario |
| `load:groups:chaos` | `k6 run --out web-dashboard load-tests/modules/groups/scenarios/chaos.js` | Run Groups chaos scenario |
| `load:groups:baseline` | `k6 run load-tests/modules/groups/groups.load.js --env SCENARIO=baseline` | Run Groups baseline scenario |
| `load:seed:groups` | `node load-tests/scripts/seed-groups.js` | Seed Groups fixture data into MongoDB |

### Script Patterns

When adding a new module, register scripts following these patterns:

```
load:{module}              → Run all scenarios for a module (entry point)
load:{module}:{scenario}   → Run a single scenario for a module
load:seed:{module}         → Seed fixture data for a module
```

### Backward-Compatible Aliases

These scripts point to the Groups module for backward compatibility with existing CI pipelines:

| Script | Alias For | Description |
|--------|-----------|-------------|
| `load:test` | `load:groups` | Run all Groups scenarios |
| `load:stress` | `load:groups:stress` | Run Groups stress scenario |
| `load:soak` | `load:groups:soak` | Run Groups soak scenario |
| `load:chaos` | `load:groups:chaos` | Run Groups chaos scenario |
| `load:seed` | `load:seed:groups` | Seed Groups fixtures |

### CI/Reporting Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `load:report` | `k6 run load-tests/modules/groups/groups.load.js` | Run Groups and generate HTML report (no dashboard) |
| `load:ci` | `k6 run ... --out json=load-tests/reports/groups/results.json` | CI mode with JSON output (exits 99 on threshold breach) |

---

## Shared Helper APIs

### `shared/helpers/auth.js`

Token and authentication header utilities for k6 scenarios.

#### `getUser(fixtures, role, vuIndex)`

Get a user entry from the fixture pool using round-robin selection.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fixtures` | `object` | Loaded fixtures object containing `adminUser`, `brotherUsers`, `sisterUsers` |
| `role` | `'admin' \| 'brother' \| 'sister'` | User role to select from |
| `vuIndex` | `number` | VU index (0-based), used for round-robin: `pool[vuIndex % pool.length]` |

**Returns:** `{ id: string, email: string, token: string }`

```js
import { getUser } from '../../../shared/helpers/auth.js';

const user = getUser(fixtures, 'brother', __VU - 1);
console.log(user.email); // "loadtest-brother-3@test.com"
```

#### `getToken(fixtures, role, vuIndex)`

Get the JWT token for a user in the fixture pool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fixtures` | `object` | Loaded fixtures object |
| `role` | `'admin' \| 'brother' \| 'sister'` | User role |
| `vuIndex` | `number` | VU index for round-robin selection |

**Returns:** `string` — JWT token

```js
import { getToken } from '../../../shared/helpers/auth.js';

const token = getToken(fixtures, 'admin', 0);
// Use in custom header construction
```

#### `getAuthHeaders(fixtures, role, vuIndex)`

Get an Authorization header object for a user in the fixture pool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fixtures` | `object` | Loaded fixtures object |
| `role` | `'admin' \| 'brother' \| 'sister'` | User role |
| `vuIndex` | `number` | VU index for round-robin selection |

**Returns:** `{ Authorization: string }` — Header object with Bearer token

```js
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import http from 'k6/http';

const headers = getAuthHeaders(fixtures, 'brother', __VU - 1);
const res = http.get(`${BASE_URL}/api/v1/groups`, { headers });
```

---

### `shared/helpers/report.js`

Reusable `handleSummary` factory for generating per-module HTML reports.

#### `createHandleSummary(moduleName)`

Create a `handleSummary` function for a specific module.

| Parameter | Type | Description |
|-----------|------|-------------|
| `moduleName` | `string \| undefined` | Module name in kebab-case (e.g., `'groups'`, `'auth'`). Falls back to root report path when empty or undefined. |

**Returns:** `function(data)` — k6 `handleSummary` function that returns `{ [reportPath]: data, stdout: data }`

- When `moduleName` is provided: report path is `load-tests/reports/{moduleName}/report.html`
- When `moduleName` is empty/undefined: report path is `load-tests/reports/report.html`

```js
import { createHandleSummary } from '../../shared/helpers/report.js';

// In a module entry point:
export const handleSummary = createHandleSummary('groups');
// → Writes report to load-tests/reports/groups/report.html
```

---

### `shared/helpers/scenario-utils.js`

Stage generation, phase classification, and URL resolution utilities.

#### `getStressStages(profileValue)`

Get stress test stages based on the profile environment variable.

| Parameter | Type | Description |
|-----------|------|-------------|
| `profileValue` | `string \| undefined` | `'production'` for production stages, anything else returns local stages |

**Returns:** `Array<{ duration: string, target: number }>` — k6-compatible stages array

- **Local** (default): 10→25→50→75→100 VUs with 1-min ramp / 2-min hold, then 2-min ramp-down
- **Production**: 50→100→200→300 VUs with 2-min ramp / 5-min hold, then 10-min ramp-down

```js
const { getStressStages } = require('../../shared/helpers/scenario-utils.js');

const stages = getStressStages(__ENV.STRESS_PROFILE);
// Local: [{ duration: '1m', target: 10 }, { duration: '2m', target: 10 }, ...]
```

#### `getSoakStages(profileValue)`

Get soak test stages based on the profile environment variable.

| Parameter | Type | Description |
|-----------|------|-------------|
| `profileValue` | `string \| undefined` | `'production'` for production stages, anything else returns local stages |

**Returns:** `Array<{ duration: string, target: number }>` — k6-compatible stages array

- **Local** (default): ramp to 20 VUs over 2 min, sustain 30 min, ramp down 2 min
- **Production**: ramp to 20 VUs over 2 min, sustain 4 hours, ramp down 2 min

```js
const { getSoakStages } = require('../../shared/helpers/scenario-utils.js');

const stages = getSoakStages(__ENV.SOAK_PROFILE);
```

#### `classifyPhase(elapsedSeconds)`

Classify the current phase of a soak test based on elapsed time.

| Parameter | Type | Description |
|-----------|------|-------------|
| `elapsedSeconds` | `number` | Seconds elapsed since test start |

**Returns:** `'early' | 'late' | 'middle'`

- `'early'`: 120s ≤ elapsed < 420s (first 5 min of sustain)
- `'late'`: 1620s ≤ elapsed < 1920s (last 5 min of sustain)
- `'middle'`: everything else

```js
const { classifyPhase } = require('../../shared/helpers/scenario-utils.js');

const phase = classifyPhase(300); // → 'early'
const phase2 = classifyPhase(1000); // → 'middle'
```

#### `resolveBaseUrl(envValue)`

Resolve the base URL for HTTP requests.

| Parameter | Type | Description |
|-----------|------|-------------|
| `envValue` | `string \| undefined` | Value of `BASE_URL` environment variable |

**Returns:** `string` — Resolved URL. Returns `envValue` if truthy, otherwise `'http://localhost:5002'`

```js
const { resolveBaseUrl } = require('../../shared/helpers/scenario-utils.js');

const url = resolveBaseUrl(__ENV.BASE_URL);
// → 'http://localhost:5002' (when BASE_URL is not set)
```

---

## Adding a New Module

Follow these steps to add load tests for a new API module (e.g., `auth`):

### Step 1: Create the Directory Structure

```bash
mkdir -p load-tests/modules/auth/scenarios
mkdir -p load-tests/modules/auth/fixtures
```

### Step 2: Create Module Fixtures

Create `load-tests/modules/auth/fixtures/auth-fixtures.json` with module-specific test data:

```json
{
  "testAccounts": [
    { "email": "loadtest-auth-0@test.com", "password": "LoadTest123!" }
  ]
}
```

Scenarios automatically merge this with `shared/fixtures/base-fixtures.json` at runtime.

### Step 3: Create Scenario Files

Create scenario files under `load-tests/modules/auth/scenarios/`. Each scenario exports a single exec function:

```js
// load-tests/modules/auth/scenarios/baseline.js
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('auth-fixtures', function () {
  return [JSON.parse(open('../fixtures/auth-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

export function runBaseline() {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: fixtures.testAccounts[0].email,
    password: fixtures.testAccounts[0].password,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'login returns 200': (r) => r.status === 200 });
}
```

### Step 4: Create the Module Entry Point

Create `load-tests/modules/auth/auth.load.js`:

```js
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { THRESHOLDS } from '../../shared/config/thresholds.js';

import { runBaseline } from './scenarios/baseline.js';

export { runBaseline };

export const options = {
  scenarios: {
    baseline: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      exec: 'runBaseline',
      startTime: '0s',
    },
  },
  thresholds: { ...THRESHOLDS },
};

export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') return;
}

export function handleSummary(data) {
  return {
    'load-tests/reports/auth/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### Step 5: Create a Seed Script (Optional)

Copy the template and adapt it:

```bash
cp load-tests/scripts/seed-template.js load-tests/scripts/seed-auth.js
```

Edit `seed-auth.js`: replace `{module-name}` with `auth`, import your models, and add data creation logic.

### Step 6: Register NPM Scripts

Add to `package.json`:

```json
{
  "load:auth": "k6 run --out web-dashboard load-tests/modules/auth/auth.load.js",
  "load:auth:baseline": "k6 run --out web-dashboard load-tests/modules/auth/scenarios/baseline.js",
  "load:seed:auth": "node load-tests/scripts/seed-auth.js"
}
```

### Step 7: Add Tests

Create at least one test file at `load-tests/__tests__/auth/` covering your scenario logic.

---

## Running Tests

```bash
# Run all load test unit/property tests
npx vitest run load-tests/__tests__

# Run tests for a specific module
npx vitest run load-tests/__tests__/groups

# Run shared helper tests
npx vitest run load-tests/__tests__/shared
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed fixture data (requires MongoDB running)
npm run load:seed:groups

# 3. Start the API server
npm run dev

# 4. Run all Groups scenarios (opens dashboard at localhost:5665)
npm run load:groups

# 5. Run a specific scenario
npm run load:groups:stress
```
