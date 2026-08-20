import { describe, expect, it } from "vitest";
import { activityToCsv } from "../shared/activityExport";
import { filterAccounts } from "../shared/userManagementRules";

describe("admin dashboard filters and exports", () => {
  const accounts = [
    { id: 1, name: "HSE Staging User", email: "hse@example.com", departmentCode: "hse", isActive: 1 },
    { id: 2, name: "Accounts User", email: "accounts@example.com", departmentCode: "accounts", isActive: 0 },
    { id: 3, name: "Sales User", email: "sales@example.com", departmentCode: "sales", isActive: 1 },
  ];
  const label = (code: string | null | undefined) => ({ hse: "HSE / Safety", accounts: "Accounts", sales: "Sales & Client Relations" }[code ?? ""] ?? "Unassigned");

  it("combines search, department, and status filters", () => {
    expect(filterAccounts(accounts, "hse", "all", "all", label).map((account) => account.id)).toEqual([1]);
    expect(filterAccounts(accounts, "", "accounts", "inactive", label).map((account) => account.id)).toEqual([2]);
    expect(filterAccounts(accounts, "user", "sales", "active", label).map((account) => account.id)).toEqual([3]);
    expect(filterAccounts(accounts, "missing", "all", "all", label)).toEqual([]);
  });

  it("exports audit rows with stable headers and escaped CSV cells", () => {
    const csv = activityToCsv([{
      id: 7,
      userId: 2,
      userName: "Accounts, User",
      userEmail: "accounts@example.com",
      departmentCode: "accounts",
      action: "profile_update",
      detail: 'Changed role from "user" to "admin"',
      createdAt: "2026-08-13T07:00:00.000Z",
    }]);

    expect(csv.split("\r\n")[0]).toBe('"Event ID","User ID","User name","Email","Department","Action","Detail","Created at"');
    expect(csv).toContain('"Accounts, User"');
    expect(csv).toContain('"Changed role from ""user"" to ""admin"""');
  });
});
