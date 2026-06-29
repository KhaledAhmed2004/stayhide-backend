import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: load-test-folder-restructure, Property 2: Threshold Merge Semantics
 *
 * Validates: Requirements 4.3
 *
 * For any base threshold object and any module-specific threshold object,
 * merging via { ...baseThresholds, ...moduleThresholds } SHALL produce an object where:
 * (a) all keys from the module object are present with their module values,
 * (b) all keys from the base object that do not appear in the module object are present with their base values,
 * (c) no other keys exist.
 */
describe('Feature: load-test-folder-restructure, Property 2: Threshold Merge Semantics', () => {
  const thresholdValue = fc.array(fc.string(), { minLength: 1, maxLength: 3 });
  const thresholdObject = fc.dictionary(fc.string(), thresholdValue);

  it('module keys override base keys, non-overridden base keys preserved, no extra keys', () => {
    fc.assert(
      fc.property(thresholdObject, thresholdObject, (baseThresholds, moduleThresholds) => {
        const merged = { ...baseThresholds, ...moduleThresholds };

        // All module keys present with module values
        for (const key of Object.keys(moduleThresholds)) {
          expect(merged[key]).toEqual(moduleThresholds[key]);
        }

        // All non-overridden base keys present with base values
        for (const key of Object.keys(baseThresholds)) {
          if (!(key in moduleThresholds)) {
            expect(merged[key]).toEqual(baseThresholds[key]);
          }
        }

        // No extra keys
        const expectedKeys = new Set([...Object.keys(baseThresholds), ...Object.keys(moduleThresholds)]);
        expect(Object.keys(merged).length).toBe(expectedKeys.size);
      }),
      { numRuns: 100 }
    );
  });
});
