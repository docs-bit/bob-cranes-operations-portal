import { TrainingEmployee } from "./trainingData";

export type UrgencyFilter = "All" | "High" | "Warning" | "Standard";
export type DepartmentNotificationFilter = "All" | "Documentation" | "HSE" | "Crew" | "Accounts" | "Transportation";

export function filterNotifications(
  notifications: Array<{ id: string; departmentCode?: string | null; title: string; body: string; read?: number | null; createdAt: number | Date }>,
  urgency: UrgencyFilter,
  department: DepartmentNotificationFilter
) {
  return notifications.filter((item) => {
    const titleLower = item.title.toLowerCase();
    const bodyLower = item.body.toLowerCase();
    
    // Urgency match
    let matchesUrgency = true;
    if (urgency === "High") {
      matchesUrgency = titleLower.includes("expired") || titleLower.includes("critical") || bodyLower.includes("expired") || bodyLower.includes("urgent");
    } else if (urgency === "Warning") {
      matchesUrgency = titleLower.includes("renewal") || titleLower.includes("flagged") || bodyLower.includes("renewal") || bodyLower.includes("due");
    } else if (urgency === "Standard") {
      matchesUrgency = !titleLower.includes("expired") && !titleLower.includes("critical") && !titleLower.includes("renewal") && !titleLower.includes("flagged");
    }

    // Department match
    let matchesDept = true;
    if (department !== "All") {
      const deptCodeMap: Record<DepartmentNotificationFilter, string> = {
        All: "",
        Documentation: "documentation",
        HSE: "hse",
        Crew: "crew",
        Accounts: "accounts",
        Transportation: "transportation",
      };
      matchesDept = item.departmentCode === deptCodeMap[department];
    }

    return matchesUrgency && matchesDept;
  });
}

export function getExpiringTrainingEmployees(employees: TrainingEmployee[], daysThreshold = 30) {
  const now = Date.now();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  
  const results: Array<{ employeeId: string; employeeName: string; position: string; trainingName: string; expiryDateStr: string; daysRemaining: number }> = [];

  for (const emp of employees) {
    for (const cert of emp.certifications) {
      if (cert.status === "Recorded" && cert.value && cert.value !== "N/A") {
        const parsed = Date.parse(cert.value);
        if (!Number.isNaN(parsed)) {
          const diff = parsed - now;
          const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
          if (daysRemaining <= daysThreshold) {
            results.push({
              employeeId: emp.employeeId,
              employeeName: emp.employeeName,
              position: emp.position,
              trainingName: cert.training,
              expiryDateStr: cert.value,
              daysRemaining,
            });
          }
        }
      }
    }
  }

  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
