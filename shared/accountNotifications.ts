export function accountUpdateNotification(roleLabel: string, departmentLabel: string) {
  return {
    title: "Your profile or role was updated",
    body: `An administrator updated your profile. Your access is now ${roleLabel} in ${departmentLabel}. Sign in to review the latest details.`,
  };
}
