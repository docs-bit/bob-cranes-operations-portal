import type { Request } from "express";

type Bucket = {
  tokens: number;
  lastRefill: number;
};

type RateLimit = {
  capacity: number;
  refillRatePerSecond: number;
};

const buckets = new Map<string, Bucket>();

const TELEMETRY_RATE_LIMIT: RateLimit = {
  capacity: 30,
  refillRatePerSecond: 5,
};

const PUBLIC_MUTATION_RATE_LIMITS = {
  login: { capacity: 8, refillRatePerSecond: 8 / (15 * 60) },
  bootstrap: { capacity: 4, refillRatePerSecond: 4 / (15 * 60) },
  passwordReset: { capacity: 5, refillRatePerSecond: 5 / (60 * 60) },
  enquiry: { capacity: 8, refillRatePerSecond: 8 / (10 * 60) },
  feedback: { capacity: 8, refillRatePerSecond: 8 / (10 * 60) },
} as const satisfies Record<string, RateLimit>;

function consumeToken(key: string, limit: RateLimit): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: limit.capacity, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      limit.capacity,
      bucket.tokens + elapsedSeconds * limit.refillRatePerSecond,
    );
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function getRequestRateLimitKey(req: Request | undefined): string {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  const forwardedAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];
  const address =
    forwardedAddress?.trim() || req?.socket?.remoteAddress || "unknown";
  return `ip-${address}`;
}

export function checkTelemetryRateLimit(identity = "global-public"): boolean {
  return consumeToken(`telemetry:${identity}`, TELEMETRY_RATE_LIMIT);
}

export function checkPublicMutationRateLimit(
  req: Request,
  scope: keyof typeof PUBLIC_MUTATION_RATE_LIMITS,
): boolean {
  return consumeToken(
    `public:${scope}:${getRequestRateLimitKey(req)}`,
    PUBLIC_MUTATION_RATE_LIMITS[scope],
  );
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
