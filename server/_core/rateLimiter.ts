const buckets = new Map<string, { tokens: number; lastRefill: number }>();
const CAPACITY = 30;
const REFILL_RATE_PER_SECOND = 5;

export function checkTelemetryRateLimit(ipKey = "global-public"): boolean {
  const now = Date.now();
  let bucket = buckets.get(ipKey);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(ipKey, bucket);
  } else {
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_RATE_PER_SECOND);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}
