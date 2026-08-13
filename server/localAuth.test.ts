import { describe, expect, it } from "vitest";
import { canAccessDepartment, canAccessWorkspaceView, departmentsForUser } from "../shared/departmentAccess";
import { hashPassword, normalizeEmail, verifyPassword } from "./localAuth";

describe("local password security", () => {
  it("normalizes email addresses and verifies only the correct password", async () => {
    const hash = await hashPassword("A secure password 2026");

    expect(normalizeEmail("  Operations@BOBCranes.com ")).toBe("operations@bobcranes.com");
    await expect(verifyPassword("A secure password 2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password", hash)).resolves.toBe(false);
  });
});

describe("department access rules", () => {
  it("allows administrators to all departments and users only to their assigned department", () => {
    expect(canAccessDepartment({ role: "admin", departmentCode: "administrator" }, "sales")).toBe(true);
    expect(canAccessDepartment({ role: "user", departmentCode: "hse" }, "hse")).toBe(true);
    expect(canAccessDepartment({ role: "user", departmentCode: "hse" }, "accounts")).toBe(false);
    expect(departmentsForUser({ role: "user", departmentCode: "hse" })).toEqual([{ code: "hse", label: "HSE / Safety" }]);
    expect(canAccessWorkspaceView({ role: "user", departmentCode: "hse" }, "overview")).toBe(true);
    expect(canAccessWorkspaceView({ role: "user", departmentCode: "hse" }, "docs")).toBe(true);
    expect(canAccessWorkspaceView({ role: "user", departmentCode: "hse" }, "bookings")).toBe(false);
    expect(canAccessWorkspaceView({ role: "user", departmentCode: "hse" }, "users")).toBe(false);
    expect(canAccessWorkspaceView({ role: "admin", departmentCode: "administrator" }, "users")).toBe(true);
  });
});
