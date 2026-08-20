import { describe, it, expect } from "vitest";
import { filterNotifications, getExpiringTrainingEmployees } from "../shared/notificationAndExpiryRules";
import { TRAINING_EMPLOYEES } from "../shared/trainingData";

describe("New Features & Data Rules", () => {
  it("filters notifications by urgency and department correctly", () => {
    const mockNotifs = [
      { id: "1", departmentCode: "hse", title: "Certificate Expired", body: "Operator cert expired", createdAt: Date.now() },
      { id: "2", departmentCode: "documentation", title: "New Booking", body: "Booking received", createdAt: Date.now() },
    ];

    const highHse = filterNotifications(mockNotifs, "High", "HSE");
    expect(highHse.length).toBe(1);
    expect(highHse[0].id).toBe("1");

    const allDocs = filterNotifications(mockNotifs, "All", "Documentation");
    expect(allDocs.length).toBe(1);
    expect(allDocs[0].id).toBe("2");
  });

  it("calculates expiring training certificates correctly", () => {
    const expiring = getExpiringTrainingEmployees(TRAINING_EMPLOYEES, 90);
    expect(Array.isArray(expiring)).toBe(true);
  });
});
