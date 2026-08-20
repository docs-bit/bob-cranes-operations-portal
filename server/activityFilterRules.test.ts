import { describe, expect, it } from "vitest";
import { activityFilterInput, isValidActivityDate } from "@shared/activityFilterRules";

describe("activity filter input rules", () => {
  it("accepts only complete calendar dates", () => {
    expect(isValidActivityDate("2026-08-14")).toBe(true);
    expect(isValidActivityDate("2026-02-29")).toBe(false);
    expect(isValidActivityDate("60814-02-02")).toBe(false);
  });

  it("omits malformed values rather than issuing an invalid filter query", () => {
    expect(activityFilterInput("60814-02-02", "2026-08-14")).toEqual({ to: "2026-08-14", limit: 250 });
  });
});
