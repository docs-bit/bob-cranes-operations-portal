import { describe, expect, it } from "vitest";
import { TRAINING_EMPLOYEES, TRAINING_SOURCE_FILE } from "@shared/trainingData";

describe("training register dataset", () => {
  it("contains the current workbook source and employee coverage", () => {
    expect(TRAINING_SOURCE_FILE).toBe("ONSHORE&OFFSHORE.xlsx");
    expect(TRAINING_EMPLOYEES.length).toBe(718);
    expect(TRAINING_EMPLOYEES.every((employee) => employee.employeeId && employee.employeeName && employee.certifications.length > 0)).toBe(true);
  });

  it("preserves certificate statuses and both workstreams", () => {
    const certifications = TRAINING_EMPLOYEES.flatMap((employee) => employee.certifications);
    expect(certifications.length).toBe(8843);
    expect(certifications.some((item) => item.status === "Missing")).toBe(true);
    expect(certifications.some((item) => item.status === "Processing")).toBe(true);
    expect(certifications.some((item) => item.workstream === "Onshore")).toBe(true);
    expect(certifications.some((item) => item.workstream === "Offshore")).toBe(true);
  });
});
