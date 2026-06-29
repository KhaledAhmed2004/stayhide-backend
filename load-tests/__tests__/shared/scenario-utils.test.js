import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getStressProfile, getSoakProfile } from '../../shared/config/profiles.js';

/**
 * Feature: load-test-folder-restructure, Property 5: Profile Selection Defaults to Local
 *
 * Validates: Requirements 4.2, 4.4
 *
 * For any string value that is not exactly "production", the profile functions
 * (getStressProfile, getSoakProfile) SHALL return the local profile (lower VU counts,
 * shorter durations). When the value is undefined or empty, the local profile SHALL
 * also be returned.
 */
describe('Feature: load-test-folder-restructure, Property 5: Profile Selection Defaults to Local', () => {
  it('any non-"production" string returns local stress profile', () => {
    fc.assert(
      fc.property(fc.string(), (profileValue) => {
        fc.pre(profileValue !== 'production');
        const stages = getStressProfile(profileValue);
        // Local stress profile: first target is 10, 11 stages total
        expect(stages[0].target).toBe(10);
        expect(stages.length).toBe(11);
        expect(stages[stages.length - 1].target).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('any non-"production" string returns local soak profile', () => {
    fc.assert(
      fc.property(fc.string(), (profileValue) => {
        fc.pre(profileValue !== 'production');
        const stages = getSoakProfile(profileValue);
        // Local soak profile: 3 stages, first target 20, sustain 30m
        expect(stages.length).toBe(3);
        expect(stages[0].target).toBe(20);
        expect(stages[1].duration).toBe('30m');
      }),
      { numRuns: 100 }
    );
  });

  it('undefined returns local stress profile', () => {
    const stages = getStressProfile(undefined);
    expect(stages[0].target).toBe(10);
    expect(stages.length).toBe(11);
  });

  it('undefined returns local soak profile', () => {
    const stages = getSoakProfile(undefined);
    expect(stages.length).toBe(3);
    expect(stages[0].target).toBe(20);
  });

  it('"production" returns production stress profile', () => {
    const stages = getStressProfile('production');
    expect(stages[0].target).toBe(50);
    expect(stages.length).toBe(9);
  });

  it('"production" returns production soak profile', () => {
    const stages = getSoakProfile('production');
    expect(stages[1].duration).toBe('4h');
  });
});
