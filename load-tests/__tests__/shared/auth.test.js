import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUser } from '../../shared/helpers/auth.js';

/**
 * Feature: load-test-folder-restructure, Property 4: Auth Round-Robin Distribution
 *
 * For any valid fixtures object with N users in a role pool and any VU index (0–999),
 * getUser(fixtures, role, vuIndex) SHALL return the user at index vuIndex % N,
 * ensuring all VU indices map to a valid user without out-of-bounds access.
 *
 * **Validates: Requirements 3.1, 10.3**
 */
describe('Feature: load-test-folder-restructure, Property 4: Auth Round-Robin Distribution', () => {
  const userEntry = fc.record({
    id: fc.string(),
    email: fc.emailAddress(),
    token: fc.string(),
  });

  it('getUser returns user at vuIndex % pool.length for brother role', () => {
    fc.assert(
      fc.property(
        fc.array(userEntry, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 999 }),
        (brotherUsers, vuIndex) => {
          const fixtures = {
            adminUser: { id: 'admin-id', email: 'admin@test.com', token: 'admin-token' },
            brotherUsers,
            sisterUsers: [{ id: 'sister-id', email: 'sister@test.com', token: 'sister-token' }],
          };
          const result = getUser(fixtures, 'brother', vuIndex);
          const expectedIndex = vuIndex % brotherUsers.length;
          expect(result).toEqual(brotherUsers[expectedIndex]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getUser returns user at vuIndex % pool.length for sister role', () => {
    fc.assert(
      fc.property(
        fc.array(userEntry, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 999 }),
        (sisterUsers, vuIndex) => {
          const fixtures = {
            adminUser: { id: 'admin-id', email: 'admin@test.com', token: 'admin-token' },
            brotherUsers: [{ id: 'brother-id', email: 'brother@test.com', token: 'brother-token' }],
            sisterUsers,
          };
          const result = getUser(fixtures, 'sister', vuIndex);
          const expectedIndex = vuIndex % sisterUsers.length;
          expect(result).toEqual(sisterUsers[expectedIndex]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getUser returns admin user regardless of vuIndex', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (vuIndex) => {
        const adminUser = { id: 'admin-id', email: 'admin@test.com', token: 'admin-token' };
        const fixtures = {
          adminUser,
          brotherUsers: [{ id: 'b', email: 'b@t.com', token: 't' }],
          sisterUsers: [{ id: 's', email: 's@t.com', token: 't' }],
        };
        const result = getUser(fixtures, 'admin', vuIndex);
        expect(result).toEqual(adminUser);
      }),
      { numRuns: 100 }
    );
  });
});
