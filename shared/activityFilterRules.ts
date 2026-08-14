export function isValidActivityDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function activityFilterInput(from: string, to: string, limit = 250) {
  return {
    ...(isValidActivityDate(from) ? { from } : {}),
    ...(isValidActivityDate(to) ? { to } : {}),
    limit,
  };
}
