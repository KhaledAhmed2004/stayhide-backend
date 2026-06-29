import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Mock the k6-specific remote imports that report.js uses.
 * In vitest, these URLs can't be resolved, so we mock them.
 */
vi.mock('https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js', () => ({
  htmlReport: (data) => `<html><title>Load Test Report</title><body>k6-reporter</body></html>`,
}));

vi.mock('https://jslib.k6.io/k6-summary/0.0.2/index.js', () => ({
  textSummary: (data, opts) => `Text Summary: ${JSON.stringify(data)}`,
}));

import { createHandleSummary } from '../../shared/helpers/report.js';

/**
 * Feature: load-test-folder-restructure, Property 1: Report Path Construction
 *
 * For any valid kebab-case module name string, the createHandleSummary function
 * SHALL return a handleSummary function that produces an object with a key matching
 * `load-tests/reports/{moduleName}/report.html` and a `stdout` key. When the module
 * name is empty or undefined, the path SHALL fall back to `load-tests/reports/report.html`.
 *
 * **Validates: Requirements 3.3, 3.5, 6.1, 6.3**
 */
describe('Feature: load-test-folder-restructure, Property 1: Report Path Construction', () => {
  it('any kebab-case module name produces correct report path key', () => {
    const kebabCase = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);
    fc.assert(
      fc.property(kebabCase, (moduleName) => {
        const handleSummary = createHandleSummary(moduleName);
        const mockData = { metrics: { http_reqs: { values: { count: 100, rate: 10 } } } };
        const result = handleSummary(mockData);
        const expectedPath = `load-tests/reports/${moduleName}/report.html`;
        expect(result).toHaveProperty(expectedPath);
        expect(result).toHaveProperty(`load-tests/reports/${moduleName}/summary.json`);
        expect(result).toHaveProperty('stdout');
      }),
      { numRuns: 100 }
    );
  });

  it('empty string falls back to root report path', () => {
    const handleSummary = createHandleSummary('');
    const mockData = { metrics: { http_reqs: { values: { count: 50, rate: 5 } } } };
    const result = handleSummary(mockData);
    expect(result).toHaveProperty('load-tests/reports/report.html');
    expect(result).toHaveProperty('load-tests/reports/summary.json');
    expect(result).toHaveProperty('stdout');
  });

  it('undefined falls back to root report path', () => {
    const handleSummary = createHandleSummary(undefined);
    const mockData = { metrics: { http_reqs: { values: { count: 50, rate: 5 } } } };
    const result = handleSummary(mockData);
    expect(result).toHaveProperty('load-tests/reports/report.html');
    expect(result).toHaveProperty('load-tests/reports/summary.json');
    expect(result).toHaveProperty('stdout');
  });

  it('HTML report contains module name in title', () => {
    const handleSummary = createHandleSummary('admin');
    const mockData = { metrics: { http_reqs: { values: { count: 10, rate: 1 } } } };
    const result = handleSummary(mockData);
    expect(result['load-tests/reports/admin/report.html']).toContain('admin');
    expect(result['load-tests/reports/admin/report.html']).toContain('Load Test');
  });

  it('JSON summary is valid JSON', () => {
    const handleSummary = createHandleSummary('auth');
    const mockData = { metrics: { http_reqs: { values: { count: 200, rate: 20 } }, http_req_duration: { values: { avg: 150 } } } };
    const result = handleSummary(mockData);
    const parsed = JSON.parse(result['load-tests/reports/auth/summary.json']);
    expect(parsed).toEqual(mockData);
  });
});
