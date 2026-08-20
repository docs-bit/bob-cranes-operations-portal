export const DEFAULT_DASHBOARD_GREETING_TEMPLATE = "Hello, {name}";

export function isValidDashboardGreetingTemplate(template: string) {
  const normalized = template.trim();
  return normalized.length >= 3 && normalized.length <= 120 && normalized.includes("{name}");
}

export function preferredDashboardName(name?: string | null) {
  const normalized = name?.trim();
  return normalized ? normalized.split(/\s+/)[0] : "there";
}

export function formatDashboardGreeting(template: string | null | undefined, name?: string | null) {
  const activeTemplate = template && isValidDashboardGreetingTemplate(template)
    ? template.trim()
    : DEFAULT_DASHBOARD_GREETING_TEMPLATE;
  return activeTemplate.replaceAll("{name}", preferredDashboardName(name));
}
