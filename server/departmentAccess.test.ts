import { describe, expect, it } from "vitest";
import { canAccessDepartment, canManageDepartmentUsers, canAccessWorkspaceView, roleLabel } from "@shared/departmentAccess";

describe("department supervisor access", () => {
  const supervisor = { role: "supervisor" as const, departmentCode: "hse" };
  const user = { role: "user" as const, departmentCode: "hse" };
  const admin = { role: "admin" as const, departmentCode: "administrator" };

  it("limits supervisors to their own department", () => {
    expect(canAccessDepartment(supervisor, "hse")).toBe(true);
    expect(canAccessDepartment(supervisor, "sales")).toBe(false);
    expect(canManageDepartmentUsers(supervisor, "hse")).toBe(true);
    expect(canManageDepartmentUsers(supervisor, "sales")).toBe(false);
    expect(canManageDepartmentUsers(user, "hse")).toBe(false);
  });

  it("lets administrators manage every department and keeps the user workspace protected", () => {
    expect(canManageDepartmentUsers(admin, "sales")).toBe(true);
    expect(canAccessWorkspaceView(supervisor, "users")).toBe(true);
    expect(canAccessWorkspaceView(user, "users")).toBe(false);
    expect(roleLabel("supervisor")).toBe("Department supervisor");
  });
});
