/**
 * report.js — Enhanced handleSummary factory for k6 load test modules
 *
 * Generates a single beautiful HTML report combining:
 *   - k6-reporter interactive charts
 *   - Custom threshold analysis with pass/fail badges
 *   - Latency breakdown by scenario
 *   - Smart recommendations
 *   - JSON dump for CI/CD
 *
 * Live monitoring during test:
 *   npm run load:admin  →  http://localhost:5665 (real-time dashboard)
 */

import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

/**
 * Generate enhanced HTML report with threshold analysis & recommendations
 */
function generateEnhancedReport(data, moduleName) {
  const metrics = data.metrics || {};

  // Extract key metrics safely
  const totalRequests = metrics.http_reqs?.values?.count || 0;
  const totalRate = metrics.http_reqs?.values?.rate || 0;
  const errorRate = metrics.http_req_failed?.values?.rate || 0;
  const avgDuration = metrics.http_req_duration?.values?.avg || 0;
  const p95Duration = metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p90Duration = metrics.http_req_duration?.values?.['p(90)'] || 0;
  const minDuration = metrics.http_req_duration?.values?.min || 0;
  const maxDuration = metrics.http_req_duration?.values?.max || 0;
  const medDuration = metrics.http_req_duration?.values?.med || 0;
  const dataReceived = metrics.data_received?.values?.count || 0;
  const dataReceivedRate = metrics.data_received?.values?.rate || 0;
  const dataSent = metrics.data_sent?.values?.count || 0;
  const iterations = metrics.iterations?.values?.count || 0;
  const iterDuration = metrics.iteration_duration?.values || {};
  const vusMax = metrics.vus_max?.values?.max || metrics.vus?.values?.max || 0;

  // Calculate test duration from iteration_duration max or from iterations rate
  const testDurationSec = iterations > 0 && metrics.iterations?.values?.rate > 0
    ? iterations / metrics.iterations.values.rate
    : 0;

  // Checks
  const checksPass = metrics.checks?.values?.passes || 0;
  const checksFail = metrics.checks?.values?.fails || 0;
  const checksTotal = checksPass + checksFail;
  const checksRate = checksTotal > 0 ? ((checksPass / checksTotal) * 100).toFixed(1) : '100.0';

  // Threshold analysis — k6 v2 puts thresholds in data.thresholds as { metricName: { ok: bool } }
  // But also check metrics[x].thresholds for older format
  const thresholdResults = [];
  
  // Method 1: data.thresholds object
  if (data.thresholds && typeof data.thresholds === 'object') {
    for (const [key, val] of Object.entries(data.thresholds)) {
      if (val && typeof val === 'object') {
        thresholdResults.push({
          metric: key,
          passed: val.ok !== false && val.ok !== 0,
        });
      }
    }
  }
  
  // Method 2: metrics[x].thresholds (k6 v2 format)
  if (thresholdResults.length === 0) {
    for (const [key, val] of Object.entries(metrics)) {
      if (val && val.thresholds && typeof val.thresholds === 'object') {
        for (const [threshName, threshVal] of Object.entries(val.thresholds)) {
          thresholdResults.push({
            metric: `${key} [${threshName}]`,
            passed: threshVal.ok !== false,
          });
        }
      }
    }
  }

  const passedCount = thresholdResults.filter(t => t.passed).length;
  const failedCount = thresholdResults.filter(t => !t.passed).length;
  const totalThresholds = thresholdResults.length;

  // Scenario latency breakdown — filter out scenarios with 0 requests
  const scenarioLatencies = [];
  for (const [key, val] of Object.entries(metrics)) {
    const match = key.match(/^http_req_duration\{scenario:"([^"]+)"\}$/);
    if (match && val?.values) {
      const v = val.values;
      // Only include scenarios that actually ran (have non-zero avg or max)
      if (v.avg > 0 || v.max > 0) {
        scenarioLatencies.push({
          name: match[1],
          avg: v.avg || 0,
          med: v.med || 0,
          p90: v['p(90)'] || 0,
          p95: v['p(95)'] || 0,
          min: v.min || 0,
          max: v.max || 0,
        });
      }
    }
  }

  // Also get per-scenario error rates and request counts
  const scenarioErrors = {};
  for (const [key, val] of Object.entries(metrics)) {
    const match = key.match(/^http_req_failed\{scenario:"([^"]+)"\}$/);
    if (match && val?.values) {
      // In k6: passes = requests that did NOT fail, fails = total requests checked
      scenarioErrors[match[1]] = {
        rate: val.values.rate || 0,
        passes: val.values.passes || 0,  // failed requests count
        fails: val.values.fails || 0,    // successful requests count (confusing naming)
        totalRequests: (val.values.passes || 0) + (val.values.fails || 0),
      };
    }
  }

  // Sort scenarios: baseline first, then by avg latency
  scenarioLatencies.sort((a, b) => {
    if (a.name === 'baseline') return -1;
    if (b.name === 'baseline') return 1;
    return a.avg - b.avg;
  });

  // Format helpers
  function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
  }

  function formatMs(ms) {
    if (ms >= 60000) return (ms / 60000).toFixed(1) + 'min';
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return ms.toFixed(0) + 'ms';
  }

  function formatDuration(seconds) {
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}m ${s}s`;
    }
    return `${seconds.toFixed(1)}s`;
  }

  function getLatencyColor(ms, threshold) {
    if (ms <= threshold * 0.5) return '#10b981';
    if (ms <= threshold) return '#f59e0b';
    return '#ef4444';
  }

  const now = new Date().toLocaleString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  
  const overallStatus = failedCount === 0 ? 'ALL PASSED' : `${failedCount} FAILED`;
  const statusColor = failedCount === 0 ? '#10b981' : '#ef4444';
  const statusBg = failedCount === 0 ? '#10b98115' : '#ef444415';
  const statusBorder = failedCount === 0 ? '#10b98140' : '#ef444440';

  // Build threshold rows HTML
  const thresholdRowsHtml = thresholdResults.length > 0
    ? thresholdResults.map(t => `
          <tr>
            <td><code>${t.metric}</code></td>
            <td><span class="badge ${t.passed ? 'badge-pass' : 'badge-fail'}">${t.passed ? '✅ PASS' : '❌ FAIL'}</span></td>
          </tr>`).join('')
    : `<tr><td colspan="2" style="text-align:center;color:#64748b;padding:2rem;">No threshold data available in summary output</td></tr>`;

  // Build scenario rows HTML
  const scenarioRowsHtml = scenarioLatencies.length > 0
    ? scenarioLatencies.map(s => {
        const errInfo = scenarioErrors[s.name];
        const errRate = errInfo ? (errInfo.rate * 100).toFixed(2) + '%' : '0%';
        const errColor = errInfo && errInfo.rate > 0.05 ? '#ef4444' : '#10b981';
        const reqCount = errInfo ? errInfo.totalRequests : 0;
        return `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td>${formatMs(s.avg)}</td>
            <td>${formatMs(s.med)}</td>
            <td><strong>${formatMs(s.p95)}</strong></td>
            <td>${formatMs(s.p90)}</td>
            <td>${formatMs(s.max)}</td>
            <td style="color:${errColor}">${errRate}</td>
            <td>${reqCount.toLocaleString()}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:2rem;">No scenario data</td></tr>`;

  // Build recommendations
  const recommendations = [];
  if (failedCount > 0) {
    recommendations.push({ icon: '⚠️', color: '#ef4444', text: `${failedCount} threshold(s) crossed. Review the failed metrics and consider tuning thresholds or optimizing the API.` });
  }
  if (totalRate < 50 && totalRequests > 0) {
    recommendations.push({ icon: '📈', color: '#f59e0b', text: `RPS is ${totalRate.toFixed(1)} req/s (below 50 target). For higher throughput: use MongoDB replica set, add connection pooling, enable query caching, or scale horizontally.` });
  }
  if (p95Duration > 3000) {
    recommendations.push({ icon: '🐢', color: '#f59e0b', text: `Overall p95 latency is ${formatMs(p95Duration)}. Consider adding database indexes, Redis caching, or query optimization.` });
  }
  if (errorRate > 0.05) {
    recommendations.push({ icon: '🔴', color: '#ef4444', text: `Error rate is ${(errorRate * 100).toFixed(2)}%. Investigate server logs for 5xx errors, timeouts, or connection pool exhaustion.` });
  }
  if (errorRate === 0 && checksRate === '100.0') {
    recommendations.push({ icon: '🎉', color: '#10b981', text: `Zero errors and 100% checks passed! The ${moduleName || ''} module handles this load profile correctly.` });
  }
  if (scenarioLatencies.length > 0) {
    const stressScenario = scenarioLatencies.find(s => s.name === 'stress');
    if (stressScenario && stressScenario.p95 > 4000) {
      recommendations.push({ icon: '🔥', color: '#f59e0b', text: `Stress scenario p95 is ${formatMs(stressScenario.p95)} at ${vusMax} VUs. This indicates the server is near capacity. Consider horizontal scaling for production.` });
    }
  }

  const recsHtml = recommendations.map(r => `
        <div class="rec-item" style="border-left-color:${r.color}">
          <span class="rec-icon">${r.icon}</span> ${r.text}
        </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report: ${moduleName || 'All Modules'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0e1a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
      line-height: 1.6;
    }
    
    .container { max-width: 1280px; margin: 0 auto; }

    /* ─── Header ─── */
    .header {
      background: linear-gradient(135deg, #1a1f35 0%, #252d4a 50%, #1a2744 100%);
      border-radius: 20px;
      padding: 2.5rem 3rem;
      margin-bottom: 2rem;
      border: 1px solid #2d3a5c;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, ${statusColor}08 0%, transparent 70%);
      border-radius: 50%;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      position: relative;
      z-index: 1;
    }
    .header h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    .header .subtitle {
      color: #94a3b8;
      font-size: 0.85rem;
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .header .subtitle span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.85rem;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusBorder};
      backdrop-filter: blur(10px);
    }

    /* ─── Metric Cards ─── */
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 900px) { .cards { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 500px) { .cards { grid-template-columns: 1fr; } }
    
    .card {
      background: #141929;
      border-radius: 16px;
      padding: 1.5rem;
      border: 1px solid #1e2642;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: #3b4d7a;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .card .label {
      color: #64748b;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    .card .value {
      font-size: 1.75rem;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }
    .card .sub {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .card.success .value { color: #10b981; }
    .card.success { border-color: #10b98130; }
    .card.danger .value { color: #ef4444; }
    .card.danger { border-color: #ef444430; }
    .card.warning .value { color: #f59e0b; }
    .card.warning { border-color: #f59e0b30; }
    .card.info .value { color: #3b82f6; }
    .card.info { border-color: #3b82f630; }

    /* ─── Sections ─── */
    .section {
      margin-bottom: 2rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .section-header h2 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .section-header .count {
      background: #1e293b;
      color: #94a3b8;
      font-size: 0.7rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-weight: 600;
    }

    /* ─── Tables ─── */
    .table-wrap {
      background: #141929;
      border-radius: 16px;
      border: 1px solid #1e2642;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #0d1117;
      color: #64748b;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      padding: 0.9rem 1.25rem;
      text-align: left;
      border-bottom: 1px solid #1e2642;
    }
    td {
      padding: 0.85rem 1.25rem;
      font-size: 0.85rem;
      border-bottom: 1px solid #1a1f35;
      color: #cbd5e1;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1a2035; }
    
    code {
      background: #1e293b;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      color: #93c5fd;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.75rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .badge-pass { background: #10b98115; color: #34d399; border: 1px solid #10b98130; }
    .badge-fail { background: #ef444415; color: #f87171; border: 1px solid #ef444430; }

    /* ─── Recommendations ─── */
    .recommendations {
      background: #141929;
      border-radius: 16px;
      padding: 2rem;
      border: 1px solid #1e2642;
    }
    .rec-item {
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
      border-radius: 10px;
      background: #0d1117;
      border-left: 4px solid #3b82f6;
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.5;
      transition: all 0.2s;
    }
    .rec-item:hover { background: #1a2035; }
    .rec-item:last-child { margin-bottom: 0; }
    .rec-icon { margin-right: 0.5rem; }

    /* ─── Progress Bar ─── */
    .progress-bar {
      height: 6px;
      background: #1e293b;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }

    /* ─── Footer ─── */
    .footer {
      text-align: center;
      color: #475569;
      font-size: 0.75rem;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #1e2642;
    }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-top">
        <div>
          <h1>⚡ ${moduleName ? moduleName.charAt(0).toUpperCase() + moduleName.slice(1) : 'All'} Module — Load Test</h1>
          <div class="subtitle">
            <span>📅 ${now}</span>
            <span>⏱️ ${formatDuration(testDurationSec)}</span>
            <span>👥 ${vusMax} VUs max</span>
            <span>🔄 ${iterations.toLocaleString()} iterations</span>
          </div>
        </div>
        <div class="status-badge">${failedCount === 0 ? '✅' : '❌'} ${overallStatus} ${totalThresholds > 0 ? `(${passedCount}/${totalThresholds})` : ''}</div>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="cards">
      <div class="card ${errorRate === 0 ? 'success' : 'danger'}">
        <div class="label">Total Requests</div>
        <div class="value">${totalRequests.toLocaleString()}</div>
        <div class="sub">${totalRate.toFixed(1)} req/s</div>
      </div>
      <div class="card ${errorRate === 0 ? 'success' : 'danger'}">
        <div class="label">Error Rate</div>
        <div class="value">${(errorRate * 100).toFixed(2)}%</div>
        <div class="sub">${checksPass.toLocaleString()} checks passed</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${100 - errorRate * 100}%;background:${errorRate === 0 ? '#10b981' : '#ef4444'}"></div></div>
      </div>
      <div class="card info">
        <div class="label">Avg Latency</div>
        <div class="value">${formatMs(avgDuration)}</div>
        <div class="sub">med: ${formatMs(medDuration)} | min: ${formatMs(minDuration)}</div>
      </div>
      <div class="card ${p95Duration > 5000 ? 'danger' : p95Duration > 3000 ? 'warning' : 'info'}">
        <div class="label">p95 / p90 Latency</div>
        <div class="value">${formatMs(p95Duration)}</div>
        <div class="sub">p90: ${formatMs(p90Duration)} | max: ${formatMs(maxDuration)}</div>
      </div>
      <div class="card ${totalRate >= 50 ? 'success' : 'warning'}">
        <div class="label">RPS (Throughput)</div>
        <div class="value">${totalRate.toFixed(1)}<span style="font-size:0.8rem;color:#64748b"> /s</span></div>
        <div class="sub">Target: >50 req/s</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, (totalRate / 50) * 100)}%;background:${totalRate >= 50 ? '#10b981' : '#f59e0b'}"></div></div>
      </div>
      <div class="card">
        <div class="label">Data Transfer</div>
        <div class="value">${formatBytes(dataReceived)}</div>
        <div class="sub">↑ ${formatBytes(dataSent)} sent | ${formatBytes(dataReceivedRate)}/s</div>
      </div>
      <div class="card success">
        <div class="label">Checks</div>
        <div class="value">${checksRate}%</div>
        <div class="sub">${checksPass.toLocaleString()} pass / ${checksFail} fail</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${checksRate}%;background:#10b981"></div></div>
      </div>
      <div class="card">
        <div class="label">Iterations</div>
        <div class="value">${iterations.toLocaleString()}</div>
        <div class="sub">${(metrics.iterations?.values?.rate || 0).toFixed(1)} iter/s</div>
      </div>
    </div>

    <!-- Latency by Scenario -->
    <div class="section">
      <div class="section-header">
        <h2>⏱️ Latency Breakdown by Scenario</h2>
        <span class="count">${scenarioLatencies.length} scenarios</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Avg</th>
              <th>Median</th>
              <th>p95</th>
              <th>p90</th>
              <th>Max</th>
              <th>Errors</th>
              <th>Requests</th>
            </tr>
          </thead>
          <tbody>
            ${scenarioRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Threshold Results -->
    <div class="section">
      <div class="section-header">
        <h2>🎯 Threshold Results</h2>
        <span class="count">${passedCount} pass / ${failedCount} fail</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Metric / Threshold</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${thresholdRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recommendations -->
    <div class="section">
      <div class="section-header">
        <h2>💡 Recommendations</h2>
      </div>
      <div class="recommendations">
        ${recsHtml || '<div class="rec-item" style="border-left-color:#10b981"><span class="rec-icon">✨</span> No issues detected. System is performing within expected parameters.</div>'}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      Generated by <strong>k6 Load Test Suite</strong> | Module: ${moduleName || 'all'} | Peak VUs: ${vusMax} | Total Requests: ${totalRequests.toLocaleString()} | <a href="http://localhost:5665" target="_blank">Live Dashboard ↗</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Create a handleSummary function for a specific module.
 *
 * @param {string|undefined} moduleName - Module name in kebab-case (e.g., 'admin', 'auth').
 * @returns {function} k6 handleSummary function
 */
export function createHandleSummary(moduleName) {
  return function handleSummary(data) {
    const basePath = moduleName
      ? `load-tests/reports/${moduleName}`
      : 'load-tests/reports';

    return {
      // Single beautiful HTML report (custom enhanced)
      [`${basePath}/report.html`]: generateEnhancedReport(data, moduleName),
      // JSON dump for CI/CD or programmatic analysis
      [`${basePath}/summary.json`]: JSON.stringify(data, null, 2),
      // Colored text summary to terminal
      stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
  };
}
