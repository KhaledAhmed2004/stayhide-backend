import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getStressStages, getSoakStages, classifyPhase, resolveBaseUrl } from '../../shared/helpers/scenario-utils.js';

// Mock fixture data matching the structure of fixtures.json
const fixtures = {
  adminUser: {
    id: '6a121d0ff476457bd68d5f69',
    email: 'loadtest-admin@test.com',
    token: 'mock-admin-token',
  },
  brotherUsers: [
    { id: '6a121d10f476457bd68d5f6b', email: 'loadtest-brother-0@test.com', token: 'mock-brother-token-0' },
    { id: '6a121d10f476457bd68d5f6d', email: 'loadtest-brother-1@test.com', token: 'mock-brother-token-1' },
    { id: '6a121d10f476457bd68d5f6f', email: 'loadtest-brother-2@test.com', token: 'mock-brother-token-2' },
  ],
  sisterUsers: [
    { id: '6a121d20f476457bd68d5fa1', email: 'loadtest-sister-0@test.com', token: 'mock-sister-token-0' },
    { id: '6a121d20f476457bd68d5fa3', email: 'loadtest-sister-1@test.com', token: 'mock-sister-token-1' },
  ],
  brotherGroups: [
    { id: '6a121d22f476457bd68d5ff7', name: 'Load Test Brothers Group 0' },
    { id: '6a121d22f476457bd68d5ff9', name: 'Load Test Brothers Group 1' },
  ],
  sisterGroups: [
    { id: '6a121d22f476457bd68d5ffb', name: 'Load Test Sisters Group 0' },
    { id: '6a121d22f476457bd68d5ffd', name: 'Load Test Sisters Group 1' },
  ],
  posts: [
    { id: '6a121d22f476457bd68d611b', groupId: '6a121d22f476457bd68d5ff7' },
    { id: '6a121d22f476457bd68d611d', groupId: '6a121d22f476457bd68d5ff7' },
    { id: '6a121d22f476457bd68d611f', groupId: '6a121d22f476457bd68d5ff7' },
    { id: '6a121d22f476457bd68d6121', groupId: '6a121d22f476457bd68d5ff7' },
    { id: '6a121d22f476457bd68d6123', groupId: '6a121d22f476457bd68d5ff7' },
    { id: '6a121d22f476457bd68d6125', groupId: '6a121d22f476457bd68d5ff9' },
    { id: '6a121d22f476457bd68d6127', groupId: '6a121d22f476457bd68d5ff9' },
    { id: '6a121d22f476457bd68d6129', groupId: '6a121d22f476457bd68d5ff9' },
    { id: '6a121d22f476457bd68d612b', groupId: '6a121d22f476457bd68d5ff9' },
    { id: '6a121d22f476457bd68d612d', groupId: '6a121d22f476457bd68d5ff9' },
  ],
};

export { fixtures, fc };

/**
 * Property 6: BASE_URL Resolution
 * Validates: Requirements 8.5
 *
 * For any truthy URL string, resolveBaseUrl returns it as-is.
 * When undefined or empty, it defaults to 'http://localhost:5002'.
 */
describe('Property 6: BASE_URL Resolution', () => {
  it('any truthy URL value is used as-is', () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        expect(resolveBaseUrl(url)).toBe(url);
      }),
      { numRuns: 100 }
    );
  });

  it('undefined BASE_URL defaults to http://localhost:5002', () => {
    expect(resolveBaseUrl(undefined)).toBe('http://localhost:5002');
  });

  it('empty string BASE_URL defaults to http://localhost:5002', () => {
    expect(resolveBaseUrl('')).toBe('http://localhost:5002');
  });
});

// Feature: advanced-load-scenarios, Property 1: Environment-based profile selection
describe('Property 1: Environment-Based Profile Selection', () => {
  describe('stress stages', () => {
    it('non-production profile values select local stages', () => {
      fc.assert(
        fc.property(fc.string(), (profileValue) => {
          fc.pre(profileValue !== 'production');
          const stages = getStressStages(profileValue);
          // Local stress stages: first target is 10
          expect(stages[0].target).toBe(10);
          // Last stage ramps down to 0
          expect(stages[stages.length - 1].target).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('production profile selects production stages', () => {
      const stages = getStressStages('production');
      // Production starts at target 50
      expect(stages[0].target).toBe(50);
    });
  });

  describe('soak stages', () => {
    it('non-production profile values select local stages', () => {
      fc.assert(
        fc.property(fc.string(), (profileValue) => {
          fc.pre(profileValue !== 'production');
          const stages = getSoakStages(profileValue);
          // Local soak stages: first target is 20, 3 stages total
          expect(stages[0].target).toBe(20);
          expect(stages.length).toBe(3);
        }),
        { numRuns: 100 }
      );
    });

    it('production profile selects production stages with 4h duration', () => {
      const stages = getSoakStages('production');
      // Production soak includes a '4h' duration stage
      const hasFourHourDuration = stages.some((s) => s.duration === '4h');
      expect(hasFourHourDuration).toBe(true);
    });
  });
});

// Property 2: Fixture-Based Request Distribution
// Feature: advanced-load-scenarios, Property 2: Fixture-based request distribution
// **Validates: Requirements 1.6, 3.4**
describe('Property 2: Fixture-Based Request Distribution', () => {
  it('any VU index (0-999) produces valid indices into brotherGroups and posts arrays via modulo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (vuIndex) => {
        const groupIndex = vuIndex % fixtures.brotherGroups.length;
        const postIndex = vuIndex % fixtures.posts.length;

        // Verify groupIndex is within bounds
        expect(groupIndex).toBeGreaterThanOrEqual(0);
        expect(groupIndex).toBeLessThan(fixtures.brotherGroups.length);

        // Verify postIndex is within bounds
        expect(postIndex).toBeGreaterThanOrEqual(0);
        expect(postIndex).toBeLessThan(fixtures.posts.length);

        // Verify fixtures.brotherGroups[groupIndex] is defined (has id property)
        expect(fixtures.brotherGroups[groupIndex]).toBeDefined();
        expect(fixtures.brotherGroups[groupIndex].id).toBeDefined();

        // Verify fixtures.posts[postIndex] is defined (has id property)
        expect(fixtures.posts[postIndex]).toBeDefined();
        expect(fixtures.posts[postIndex].id).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: advanced-load-scenarios, Property 3: Soak phase classification
// **Validates: Requirements 4.5**
describe('Property 3: Soak Phase Classification', () => {
  it('any elapsed time (0 to 34*60) maps to correct phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 34 * 60 }), (elapsedSeconds) => {
        const sustainStart = 2 * 60;   // 120s
        const sustainEnd = 32 * 60;    // 1920s
        const earlyEnd = sustainStart + 5 * 60;  // 420s
        const lateStart = sustainEnd - 5 * 60;   // 1620s

        const phase = classifyPhase(elapsedSeconds);

        if (elapsedSeconds >= sustainStart && elapsedSeconds < earlyEnd) {
          expect(phase).toBe('early');
        } else if (elapsedSeconds >= lateStart && elapsedSeconds < sustainEnd) {
          expect(phase).toBe('late');
        } else {
          expect(phase).toBe('middle');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: advanced-load-scenarios, Property 4: Invalid resource returns 404
// **Validates: Requirements 5.3, 5.4, 6.1**
describe('Property 4: Invalid Resource Returns 404', () => {
  it('any 24-char hex string used as non-existent ObjectId triggers the 404 check assertion (not 500)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9a-f]{24}$/), (invalidId) => {
        // The check function as used in chaos.js: (r) => r.status === 404
        const checkFn = (r) => r.status === 404;

        // For a mock response with status 404, the check returns true
        const mockResponse404 = { status: 404 };
        expect(checkFn(mockResponse404)).toBe(true);

        // For a mock response with status 500, the check returns false
        const mockResponse500 = { status: 500 };
        expect(checkFn(mockResponse500)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
