import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Web Vitals Analytics Enhancements & Telemetry Fix", () => {
  it("includes date range filtering and CSV export in WebVitalsAnalyticsView", () => {
    const source = readFileSync(new URL("../client/src/components/WebVitalsAnalyticsView.tsx", import.meta.url), "utf8");
    expect(source).toContain("dateRange");
    expect(source).toContain("Export CSV");
    expect(source).toContain("Blob");
  });

  it("includes workspace loading skeleton component", () => {
    const source = readFileSync(new URL("../client/src/components/WorkspaceLoadingSkeleton.tsx", import.meta.url), "utf8");
    expect(source).toContain("WorkspaceLoadingSkeleton");
    expect(source).toContain("Loading departmental workspace");
  });
});
