---
name: code-reviewer
description:
  Use this skill to conduct a senior-level code review of local changes or remote PRs.
  Focuses on project-specific patterns (Express, Mongoose, Zod), clean code,
  and mandatory documentation standards.
---

# Code Reviewer Skill

This skill ensures that code reviews are thorough, consistent, and aligned with the project's high standards.

## Workflow

### 1. Pre-Review Checks
Run automated tools to catch low-hanging fruit before manual review:
*   **Linting**: `npm run lint:check`
*   **Types**: `npm run build` (to verify TS compilation)
*   **Tests**: `npm run test:run`

### 2. Review Pillars (Project-Specific)

#### A. Architecture & Patterns
*   **Layered Flow**: Does it follow `Route -> Validation -> Controller -> Service -> Model`?
*   **Naming**: Are Controllers named `*Controller` and Services named `*Service` (for auto-labeling)?
*   **Import Order**: In `app.ts` or `server.ts`, is the [MANDATORY import order](file:///architecture.md#L73) followed?

#### B. Clean Code (Uncle Bob & Airbnb)
*   **SRP**: Does each function/class have only one responsibility?
*   **Small Functions**: Are functions kept under 20-30 lines where possible?
*   **Naming**: Are names descriptive and following the [clean-code.md](file:///clean-code.md) rules?

#### C. Data & Validation
*   **Zod**: Are all `POST`/`PATCH` routes validated with `validateRequest(ZodSchema)`?
*   **Mongoose**: Are read-only queries using `.lean()`? Are indexes considered for new fields?

#### D. Observability
*   **Logging**: Is it using `catchAsync`?
*   **Context**: Is `getRequestContext()` used instead of passing user/req objects deep into services?

#### E. Documentation (MANDATORY)
*   **Protocol**: Did the author follow the [Documentation Update Protocol](file:///documentation-standards.md#L41)?
*   **Bangla**: Are architecture deep-dives and technical rationale written in Bangla?
*   **Status**: Is the `Module Documentation Status` table in [CLAUDE.md](file:///CLAUDE.md) updated?

### 3. Providing Feedback

*   **Structure**: Summary -> Critical Findings -> Improvements -> Nitpicks.
*   **Tone**: Senior Pair Programmer - constructive, educational, and firm on standards.
*   **Reference**: Link to the specific rule file (e.g., [route-design.md](file:///route-design.md)) when pointing out violations.

### 4. Post-Review
*   **Verify Fixes**: Re-run pre-review checks after changes.
*   **Update Docs**: Ensure the review itself is documented if it results in architectural changes.
