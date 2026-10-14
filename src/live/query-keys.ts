// Query keys are orval's: the request path first. These are the ones data.changed makes stale.
const LIVE_PREFIXES = ['/api/v1/reports/', '/api/v1/events', '/api/v1/intervals', '/api/v1/system-log/'];

export function isLiveDataKey(queryKey: readonly unknown[]): boolean {
  const path = queryKey[0];
  return typeof path === 'string' && LIVE_PREFIXES.some((p) => path.startsWith(p));
}
