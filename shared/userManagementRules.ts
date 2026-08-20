export type FilterableAccount = {
  name?: string | null;
  email?: string | null;
  departmentCode?: string | null;
  isActive: number;
};

export type AccountStatusFilter = "all" | "active" | "inactive";

export function filterAccounts<T extends FilterableAccount>(accounts: T[], query: string, departmentCode: string, status: AccountStatusFilter, departmentLabel: (code: string | null | undefined) => string) {
  const normalized = query.trim().toLowerCase();
  return accounts.filter((account) => {
    const matchesSearch = !normalized || [account.name, account.email, departmentLabel(account.departmentCode)].some((value) => value?.toLowerCase().includes(normalized));
    const matchesDepartment = departmentCode === "all" || account.departmentCode === departmentCode;
    const matchesStatus = status === "all" || (status === "active" ? account.isActive === 1 : account.isActive !== 1);
    return matchesSearch && matchesDepartment && matchesStatus;
  });
}
