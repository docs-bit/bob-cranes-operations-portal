import { describe, expect, it } from "vitest";
import { canAccessDepartment, canAccessWorkspaceView, departmentsForUser } from "../shared/departmentAccess";
import { hashPassword, normalizeEmail, verifyPassword } from "./localAuth";
import { accountStatusActivity, profileUpdateActivity, signInActivity } from "../shared/activityRules";
import { accountUpdateNotification } from "../shared/accountNotifications";
import { canManageAccount, nextAccountActiveState, requiresDeactivationConfirmation } from "../shared/accountManagementRules";

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

describe("account activity and deactivation safety", () => {
  it("constructs stable activity entries for sign-in, profile update, and status changes", () => {
    expect(signInActivity(44)).toEqual({ userId: 44, action: "sign_in", detail: "Signed in to the department workspace." });
    expect(profileUpdateActivity(44, "Administrator")).toEqual({ userId: 44, action: "profile_update", detail: "Profile updated by Administrator." });
    expect(profileUpdateActivity(44, "Administrator", "Administrator", "Administrator").detail).toContain("role set to Administrator");
    expect(accountUpdateNotification("Department user", "HSE / Safety")).toEqual({
      title: "Your profile or role was updated",
      body: "An administrator updated your profile. Your access is now Department user in HSE / Safety. Sign in to review the latest details.",
    });
    expect(accountStatusActivity(44, false, "Administrator")).toEqual({ userId: 44, action: "account_deactivated", detail: "Account deactivated by Administrator." });
    expect(accountStatusActivity(44, true, "Administrator")).toEqual({ userId: 44, action: "account_activated", detail: "Account activated by Administrator." });
  });

  it("requires explicit confirmation only for active department accounts", () => {
    const activeDepartmentUser = { id: 44, role: "user" as const, isActive: 1 };
    const inactiveDepartmentUser = { id: 44, role: "user" as const, isActive: 0 };
    const administrator = { id: 60001, role: "admin" as const, isActive: 1 };

    expect(canManageAccount(activeDepartmentUser, 60001)).toBe(true);
    expect(requiresDeactivationConfirmation(activeDepartmentUser, 60001)).toBe(true);
    expect(nextAccountActiveState(activeDepartmentUser, 60001)).toBe(false);
    expect(requiresDeactivationConfirmation(inactiveDepartmentUser, 60001)).toBe(false);
    expect(nextAccountActiveState(inactiveDepartmentUser, 60001)).toBe(true);
    expect(canManageAccount(administrator, 60001)).toBe(false);
    expect(nextAccountActiveState(administrator, 60001)).toBeNull();
  });
});
