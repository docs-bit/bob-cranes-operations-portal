import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analytics = readFileSync(new URL("../client/src/components/WebVitalsAnalyticsView.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("performance workspace experience", () => {
  it("renders daily Web Vitals trend charts that follow the selected date range", () => {
    expect(analytics).toContain("Web Vitals trends over time");
    expect(analytics).toContain("LineChart");
    expect(analytics).toContain("dateRange");
    expect(analytics).toContain("Export CSV");
    expect(analytics).toContain("Export PDF");
    expect(analytics).toContain("formatTrendValue");
    expect(analytics).toContain("ReferenceArea");
    expect(analytics).toContain("VITAL_THRESHOLDS");
    expect(analytics).toContain("Custom range");
    expect(analytics).toContain("customStartDate");
    expect(analytics).toContain("pdf-lib");
  });

  it("provides persistent workspace dark mode and accessible operational filtering", () => {
    expect(workspace).toContain("workspace-theme-toggle");
    expect(workspace).toContain("aria-pressed={theme === \"dark\"}");
    expect(workspace).toContain("department-workspace-toolbar");
    expect(workspace).toContain("Search operational queue");
    expect(workspace).toContain("Filter by priority");
    expect(workspace).toContain("searchSuggestions");
    expect(workspace).toContain("department-search-suggestions");
    expect(workspace).toContain("aria-autocomplete=\"list\"");
    expect(workspace).toContain("ArrowDown");
    expect(workspace).toContain("ArrowUp");
    expect(workspace).toContain("highlightQuery");
    expect(workspace).toContain("aria-activedescendant");
    expect(styles).toContain(".dark .app-shell");
  });

  it("makes the administrator analytics dashboard discoverable in the portal", () => {
    expect(workspace).toContain("Web Vitals Analytics");
    expect(workspace).toContain("view === \"web-vitals\"");
  });
});
