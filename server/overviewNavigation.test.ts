import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Operations Cockpit header navigation", () => {
  it("omits the Back control only on the overview while preserving it for other views", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('{view !== "overview" && (');
    expect(source).toContain('className="back-button"');
    expect(source).not.toContain('disabled={view === "overview"}');
  });

  it("personalizes the Operations Cockpit greeting with the saved template and signed-in name", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("title={formatDashboardGreeting(greetingTemplate, user.name)}");
    expect(source).toContain('data-testid="daily-operations-summary"');
    expect(source).toContain("greetingTemplate={dashboardGreetingQuery.data?.template}");
    expect(source).toContain('document.getElementById("dashboard-greeting-settings")');
  });
});
