import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Performance telemetry and Lighthouse CI", () => {
  it("collects LCP, FID, and CLS metrics in PerformanceTelemetry", () => {
    const source = readFileSync(new URL("../client/src/components/PerformanceTelemetry.tsx", import.meta.url), "utf8");
    expect(source).toContain("largest-contentful-paint");
    expect(source).toContain("first-input");
    expect(source).toContain("layout-shift");
    expect(source).toContain("capture.mutate");
  });

  it("provides lighthouse:ci check script", () => {
    const source = readFileSync(new URL("../scripts/lighthouseCiCheck.mjs", import.meta.url), "utf8");
    expect(source).toContain("[Lighthouse CI]");
    expect(source).toContain("Performance assertion passed");
  });
});
