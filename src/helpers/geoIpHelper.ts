/**
 * GeoIP city lookup — stub.
 *
 * Returns a human-readable city/country string (e.g. "Chicago, IL")
 * for the supplied IP, or null if unresolvable / no provider wired.
 *
 * Activation: drop in a provider in this file. The shape is async so a
 * remote service (ipapi.co, ipgeolocation.io) or a local MaxMind DB
 * (geoip-lite) can swap in without changing call sites.
 *
 * Until configured, every lookup returns null and the session list
 * surfaces "Unknown" location — graceful degradation.
 */
import { logger } from '../shared/logger';

let warnedUnconfigured = false;

export const lookupCity = async (ip: string | undefined): Promise<string | null> => {
  if (!ip) return null;

  // Localhost / private IPs — never resolvable, don't bother.
  if (
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)
  ) {
    return null;
  }

  // No provider wired yet. Log once so the gap is visible in dev logs
  // without spamming production.
  if (!warnedUnconfigured) {
    warnedUnconfigured = true;
    logger.info(
      'GeoIP lookup not configured (geoIpHelper.lookupCity returns null). ' +
        'Wire a provider (maxmind / ipapi / etc.) in src/helpers/geoIpHelper.ts.',
    );
  }
  return null;
};
