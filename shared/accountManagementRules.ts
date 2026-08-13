export type ManagedAccount = {
  id: number;
  role: "admin" | "user";
  isActive: number;
  name?: string | null;
  email?: string | null;
};

export function canManageAccount(account: ManagedAccount, actorId: number) {
  return account.role !== "admin" && account.id !== actorId;
}

export function requiresDeactivationConfirmation(account: ManagedAccount, actorId: number) {
  return canManageAccount(account, actorId) && account.isActive === 1;
}

export function nextAccountActiveState(account: ManagedAccount, actorId: number) {
  if (!canManageAccount(account, actorId)) return null;
  return account.isActive !== 1;
}
