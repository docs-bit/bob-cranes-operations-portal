import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_GREETING_TEMPLATE,
  formatDashboardGreeting,
  isValidDashboardGreetingTemplate,
  preferredDashboardName,
} from "../shared/dashboardGreeting";

describe("dashboard greeting rules", () => {
  it("uses the signed-in user's preferred first name in a valid saved template", () => {
    expect(formatDashboardGreeting("Welcome back, {name}", "Amina Hassan")).toBe("Welcome back, Amina");
    expect(preferredDashboardName("  Omar Al Mansoori ")).toBe("Omar");
  });

  it("falls back safely when a template or name is missing", () => {
    expect(formatDashboardGreeting("Hello team", null)).toBe("Hello, there");
    expect(formatDashboardGreeting(undefined, "Maya")).toBe("Hello, Maya");
    expect(DEFAULT_DASHBOARD_GREETING_TEMPLATE).toBe("Hello, {name}");
  });

  it("requires the name token so administrative copy stays personalized", () => {
    expect(isValidDashboardGreetingTemplate("Hello, {name}")).toBe(true);
    expect(isValidDashboardGreetingTemplate("Hello team")).toBe(false);
  });
});
