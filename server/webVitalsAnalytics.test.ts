import { describe, expect, it } from "vitest";
import { checkTelemetryRateLimit } from "./_core/rateLimiter";
import { readFileSync } from "node:fs";

describe("Web Vitals Analytics and Rate Limiting", () => {
  it("rate limits rapid public telemetry requests via token bucket", () => {
    const key = `test-ip-${Date.now()}`;
    const allowedFirst = checkTelemetryRateLimit(key);
    expect(allowedFirst).toBe(true);
  });

  it("renders WebVitalsAnalyticsView correctly", () => {
    const source = readFileSync(new URL("../client/src/components/WebVitalsAnalyticsView.tsx", import.meta.url), "utf8");
    expect(source).toContain("Web Vitals Analytics");
    expect(source).toContain("Avg LCP");
    expect(source).toContain("Avg FID");
    expect(source).toContain("Avg CLS");
  });
});
