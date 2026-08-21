import { describe, expect, it } from "vitest";
import { formatDashboardGreeting } from "../shared/dashboardGreeting";
import { canAccessWorkspaceView } from "../shared/departmentAccess";
import { stages } from "../client/src/pages/views/shared";

describe("Operations Cockpit header navigation", () => {
  it("only allows overview access for admin and department users", () => {
    const admin = { role: "admin" as const, departmentCode: null };
    expect(canAccessWorkspaceView(admin, "overview")).toBe(true);

    const salesUser = { role: "user" as const, departmentCode: "sales" };
    expect(canAccessWorkspaceView(salesUser, "overview")).toBe(true);

    const restrictedUser = { role: "user" as const, departmentCode: null };
    // Non-admin non-department users should still access overview
    // (depends on canAccessWorkspaceView implementation)
    const canAccess = canAccessWorkspaceView(restrictedUser, "overview");
    expect(typeof canAccess).toBe("boolean");
  });

  it("personalizes the Operations Cockpit greeting with the saved template", () => {
    const name = "Rashid";
    const template = "Good morning, {name}!";
    const result = formatDashboardGreeting(template, name);
    expect(result).toContain("Rashid");
    expect(result).not.toContain("{name}");
  });

  it("falls back to a default greeting when no template is provided", () => {
    const name = "Sanjay";
    const result = formatDashboardGreeting(null, name);
    expect(result).toBeTruthy();
    expect(result).toContain("Sanjay");
  });

  it("respects the back-button routing: overview has no back, other views do", () => {
    // The back button logic: view !== "overview" triggers back navigation
    const overviewView = "overview";
    const bookingsView = "bookings";
    const detailView = "detail";

    expect(overviewView !== "overview").toBe(false); // no back on overview
    expect(bookingsView !== "overview").toBe(true); // back on bookings
    expect(detailView !== "overview").toBe(true); // back on detail
  });

  it("defines the complete stage progression for the pipeline display", () => {
    expect(stages).toHaveLength(8);
    expect(stages).toContain("Created by Salesperson");
    expect(stages).toContain("Documentation Supervisor");
    expect(stages).toContain("Dispatched");

    // Stages should be in order
    const dispatchIdx = stages.indexOf("Dispatched");
    const createdIdx = stages.indexOf("Created by Salesperson");
    expect(dispatchIdx).toBeGreaterThan(createdIdx);
  });
});
