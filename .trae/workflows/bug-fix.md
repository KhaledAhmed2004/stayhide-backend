---
description: Systematic bug investigation and root-cause fix
---

# Bug Fix Workflow

Use this when the user reports a bug, an error, or unexpected behavior.

## Steps

1. **Read CLAUDE.md** — Load architecture and clean code rules before starting.

2. **Reproduce the Bug**
   - Identify the specific endpoint, function, or behavior that is broken
   - Collect the error message, stack trace, and logs

3. **Root Cause Analysis** (invoke `superpowers-debugging` skill if complex)
   - Trace the request flow: Route → Controller → Service → Model
   - Check for: wrong status codes, missing await, wrong field names, auth failures

4. **Identify the Fix**
   - Find the exact line(s) that are wrong
   - **No hacks** — if a quick fix feels dirty, step back and implement the clean solution

5. **Implement the Fix**
   - Change only what is necessary
   - Follow all rules from CLAUDE.md (naming, patterns, error handling)

6. **Verify the Fix**
   - Run `npm run build` — must compile with zero errors
   - Test the previously failing scenario — confirm it is resolved
   - Run `npm run lint:fix`

7. **Check for Regressions**
   - Test related endpoints to ensure nothing else broke

8. **Update Postman** (if route/response shape changed)
   - Update `public/postman-collection.json`
