import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync(new URL("../client/src/pages/views/Shell.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../client/src/pages/views/Overview.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

describe("Operations Cockpit header navigation", () => {
  it("omits the Back control only on the overview while preserving it for other views", () => {
    expect(shell).toContain('{view !== "overview" && (');
    expect(shell).toContain('className="back-button"');
    expect(shell).not.toContain('disabled={view === "overview"}');
  });

  it("personalizes the Operations Cockpit greeting with the saved template and signed-in name", () => {
    expect(overview).toContain("title={formatDashboardGreeting(greetingTemplate, user.name)}");
    expect(overview).toContain('data-testid="daily-operations-summary"');
    expect(home).toContain("greetingTemplate={dashboardGreetingQuery.data?.template}");
    expect(shell).toContain('document.getElementById("dashboard-greeting-settings")');
  });
});
