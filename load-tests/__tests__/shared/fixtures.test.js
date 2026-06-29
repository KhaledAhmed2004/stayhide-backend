import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: load-test-folder-restructure, Property 3: Fixture Merge Semantics
 *
 * **Validates: Requirements 5.3, 5.4**
 *
 * For any base fixture object and any module fixture object, merging via
 * { ...baseFixtures, ...moduleFixtures } SHALL produce an object where:
 * (a) all keys from the module fixture are present with their module values,
 * (b) all keys from the base fixture that do not appear in the module fixture
 *     are present with their base values, and
 * (c) the resulting object contains exactly the union of keys from both inputs.
 */
describe('Feature: load-test-folder-restructure, Property 3: Fixture Merge Semantics', () => {
  const fixtureValue = fc.oneof(
    fc.array(fc.record({ id: fc.string(), email: fc.string() })),
    fc.record({ id: fc.string(), email: fc.string(), token: fc.string() })
  );
  const fixtureObject = fc.dictionary(fc.string(), fixtureValue);

  it('module keys take precedence, base keys preserved, result is exact union', () => {
    fc.assert(
      fc.property(fixtureObject, fixtureObject, (baseFixtures, moduleFixtures) => {
        const merged = { ...baseFixtures, ...moduleFixtures };

        // All module keys present with module values
        for (const key of Object.keys(moduleFixtures)) {
          expect(merged[key]).toEqual(moduleFixtures[key]);
        }

        // All non-overridden base keys present with base values
        for (const key of Object.keys(baseFixtures)) {
          if (!(key in moduleFixtures)) {
            expect(merged[key]).toEqual(baseFixtures[key]);
          }
        }

        // Result contains exactly the union of keys
        const expectedKeys = new Set([...Object.keys(baseFixtures), ...Object.keys(moduleFixtures)]);
        expect(new Set(Object.keys(merged))).toEqual(expectedKeys);
      }),
      { numRuns: 100 }
    );
  });
});
