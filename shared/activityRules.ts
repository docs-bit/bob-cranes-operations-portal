export type UserActivityAction = "sign_in" | "profile_update" | "account_deactivated" | "account_activated";

export type UserActivityEntry = {
  userId: number;
  action: UserActivityAction;
  detail: string;
};

export const signInActivity = (userId: number): UserActivityEntry => ({
  userId,
  action: "sign_in",
  detail: "Signed in to the department workspace.",
});

export const profileUpdateActivity = (userId: number, actorLabel: string, roleLabel?: string, departmentLabel?: string): UserActivityEntry => ({
  userId,
  action: "profile_update",
  detail: `Profile updated by ${actorLabel}${roleLabel ? ` · role set to ${roleLabel}` : ""}${departmentLabel ? ` · department set to ${departmentLabel}` : ""}.`,
});

export const accountStatusActivity = (userId: number, isActive: boolean, actorLabel: string): UserActivityEntry => ({
  userId,
  action: isActive ? "account_activated" : "account_deactivated",
  detail: `${isActive ? "Account activated" : "Account deactivated"} by ${actorLabel}.`,
});
