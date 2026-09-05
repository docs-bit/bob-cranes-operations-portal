import { describe, expect, it } from "vitest";
import {
  certStatus,
  consoleReadiness,
  inspectionStatus,
  roleBucket,
  transitionTrainingFlagStatus,
} from "@shared/docConsoleRules";

describe("docConsoleRules", () => {
  it("buckets crew roles for the console", () => {
    expect(roleBucket("Crane Operator")).toBe("Operators");
    expect(roleBucket("Rigger")).toBe("Riggers");
    expect(roleBucket("Site Supervisor")).toBe("Supervisors");
    expect(roleBucket("Banksman")).toBe("Banksmen");
    expect(roleBucket("Store Keeper")).toBe("Other");
  });

  it("classifies certificate strings", () => {
    expect(certStatus("Valid · 12 Mar 2027").level).toBe("valid");
    expect(certStatus("Renewal due in 16 days").level).toBe("expiring");
    expect(certStatus("Training required").level).toBe("missing");
    expect(certStatus("Expired · 22 Jul 2026").level).toBe("expired");
  });

  it("flags expired crane inspections", () => {
    expect(inspectionStatus("Inspection valid · 15 Jan 2027").level).toBe(
      "valid"
    );
    expect(inspectionStatus("Inspection expired · 18 Jul 2026").level).toBe(
      "expired"
    );
  });

  it("gates Confirm Coordination on a complete roster", () => {
    const blocked = consoleReadiness({
      craneName: null,
      craneBlocked: false,
      crewByBucket: { Operators: 0, Riggers: 0, Supervisors: 0, Banksmen: 0 },
      extraCrew: 0,
      gearCount: 0,
      trailerCount: 0,
      trailerRequired: true,
      expiredItems: [],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers.length).toBeGreaterThan(0);

    const ready = consoleReadiness({
      craneName: "200T Mobile Crane · B-205",
      craneBlocked: false,
      crewByBucket: { Operators: 1, Riggers: 1, Supervisors: 1, Banksmen: 1 },
      extraCrew: 0,
      gearCount: 2,
      trailerCount: 1,
      trailerRequired: true,
      expiredItems: [],
    });
    expect(ready).toEqual({ ready: true, blockers: [] });
  });

  it("blocks confirmation when expired items remain selected", () => {
    const result = consoleReadiness({
      craneName: "200T Mobile Crane · B-205",
      craneBlocked: false,
      crewByBucket: { Operators: 1, Riggers: 1, Supervisors: 1, Banksmen: 1 },
      extraCrew: 0,
      gearCount: 1,
      trailerCount: 1,
      trailerRequired: true,
      expiredItems: ["Vijayakumar"],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers.join(" ")).toContain("Vijayakumar");
  });

  it("moves training flags OPEN → ACKNOWLEDGED → RESOLVED", () => {
    expect(transitionTrainingFlagStatus("OPEN", "acknowledge")).toBe(
      "ACKNOWLEDGED"
    );
    expect(transitionTrainingFlagStatus("ACKNOWLEDGED", "resolve")).toBe(
      "RESOLVED"
    );
    expect(transitionTrainingFlagStatus("OPEN", "resolve")).toBe("RESOLVED");
  });

  it("rejects invalid training-flag transitions", () => {
    expect(() =>
      transitionTrainingFlagStatus("ACKNOWLEDGED", "acknowledge")
    ).toThrow();
    expect(() => transitionTrainingFlagStatus("RESOLVED", "resolve")).toThrow();
    expect(() =>
      transitionTrainingFlagStatus("RESOLVED", "acknowledge")
    ).toThrow();
  });
});
