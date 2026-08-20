export const DEPARTMENTS = [
  { code: "sales", label: "Sales & Client Relations" },
  { code: "documentation", label: "Documentation & Permits" },
  { code: "lifting-gears", label: "Lifting Gears / Engineering" },
  { code: "maintenance", label: "Maintenance" },
  { code: "crew", label: "Crew / Workmen Assignment" },
  { code: "hse", label: "HSE / Safety" },
  { code: "accounts", label: "Accounts" },
  { code: "hr", label: "HR" },
  { code: "transportation", label: "Transportation" },
  { code: "administrator", label: "Administrator / Super Admin" },
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];

export const DEPARTMENT_BY_CODE = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.code, department]),
) as Record<DepartmentCode, (typeof DEPARTMENTS)[number]>;

export const DEPARTMENT_LABEL_TO_CODE = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.label, department.code]),
) as Record<string, DepartmentCode>;

export type PortalRole = "admin" | "supervisor" | "user";
export type DepartmentAccessUser = {
  role: PortalRole;
  departmentCode?: string | null;
};

export function isAdmin(user: DepartmentAccessUser) {
  return user.role === "admin";
}

export function isSupervisor(user: DepartmentAccessUser) {
  return user.role === "supervisor";
}

export function canManageDepartmentUsers(user: DepartmentAccessUser, departmentCode?: string | null) {
  return user.role === "admin" || (user.role === "supervisor" && Boolean(user.departmentCode) && user.departmentCode === departmentCode);
}

export function roleLabel(role: PortalRole) {
  return role === "admin" ? "Administrator" : role === "supervisor" ? "Department supervisor" : "Department user";
}

export function isDepartmentCode(value: string): value is DepartmentCode {
  return value in DEPARTMENT_BY_CODE;
}

export function canAccessDepartment(
  user: DepartmentAccessUser,
  departmentCode: DepartmentCode,
) {
  return user.role === "admin" || user.departmentCode === departmentCode;
}

export const DEPARTMENT_WORKSPACE_VIEW: Record<DepartmentCode, string> = {
  sales: "bookings",
  documentation: "docs",
  "lifting-gears": "gear",
  maintenance: "department",
  crew: "crew",
  hse: "docs",
  accounts: "uploads",
  hr: "attendance",
  transportation: "department",
  administrator: "overview",
};

export function departmentsForUser(user: DepartmentAccessUser) {
  return user.role === "admin"
    ? [...DEPARTMENTS]
    : DEPARTMENTS.filter((department) => department.code === user.departmentCode);
}

export function canAccessWorkspaceView(user: DepartmentAccessUser, view: string) {
  const trainingAccess = view === "training" && ["hr", "hse", "crew"].includes(user.departmentCode ?? "");
  return user.role === "admin" || view === "overview" || view === "detail" || view === "department" || trainingAccess || (view === "users" && user.role === "supervisor") || DEPARTMENT_WORKSPACE_VIEW[user.departmentCode as DepartmentCode] === view;
}
