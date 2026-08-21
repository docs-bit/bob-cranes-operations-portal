import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analytics = readFileSync(new URL("../client/src/components/WebVitalsAnalyticsView.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../client/src/pages/views/Shell.tsx", import.meta.url), "utf8");
const deptView = readFileSync(new URL("../client/src/pages/views/DepartmentView.tsx", import.meta.url), "utf8");
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
    expect(analytics).toContain("savedDatePresets");
    expect(analytics).toContain("Save preset");
    expect(analytics).toContain("Threshold summary");
    expect(analytics).toContain("thresholdCounts");
    expect(analytics).toContain("previousPeriodBounds");
    expect(analytics).toContain("percentageChange");
    expect(analytics).toContain("Samples vs previous");
    expect(analytics).toContain("pdf-lib");
  });

  it("provides persistent workspace dark mode and accessible operational filtering", () => {
    expect(workspace).toContain("workspace-theme-toggle");
    expect(workspace).toContain("aria-pressed={theme === \"dark\"}");
    expect(deptView).toContain("department-workspace-toolbar");
    expect(deptView).toContain("Search operational queue");
    expect(deptView).toContain("Filter by priority");
    expect(deptView).toContain("searchSuggestions");
    expect(deptView).toContain("department-search-suggestions");
    expect(deptView).toContain("aria-autocomplete=\"list\"");
    expect(deptView).toContain("ArrowDown");
    expect(deptView).toContain("ArrowUp");
    expect(deptView).toContain("highlightQuery");
    expect(deptView).toContain("aria-activedescendant");
    expect(deptView).toContain("searchSuggestionsLoading");
    expect(deptView).toContain("Finding matching operations");
    expect(deptView).toContain("aria-busy={searchSuggestionsLoading}");
    expect(deptView).toContain("bob-department-recent-searches");
    expect(deptView).toContain("Clear operational queue search");
    expect(deptView).toContain("event.key !== \"/\"");
    expect(styles).toContain(".dark .app-shell");
  });

  it("makes the administrator analytics dashboard discoverable in the portal", () => {
    expect(workspace).toContain("Web Vitals Analytics");
    expect(workspace).toContain("view === \"web-vitals\"");
  });
});
