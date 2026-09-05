import { describe, expect, it } from "vitest";
import { findExpiringDatedItems } from "@shared/notificationAndExpiryRules";

const NOW = Date.parse("2026-08-05T00:00:00Z");

describe("findExpiringdatedItems", () => {
  it("flags expired and 20-day items, ignores far-future and garbage", () => {
    const result = findExpiringDatedItems(
      [
        { key: "past", label: "Crane B-205 inspection", expiry: "2026-07-01", ownerDepartment: "maintenance" },
        { key: "soon", label: "Vijayakumar certificate", expiry: "2026-08-16", ownerDepartment: "crew" },
        { key: "late", label: "Sling INS-218", expiry: "2026-12-01", ownerDepartment: "lifting-gears" },
        { key: "junk", label: "Mystery doc", expiry: "unknown", ownerDepartment: "crew" },
      ],
      NOW,
      20
    );
    expect(result.map(item => item.key)).toEqual(["past", "soon"]);
    expect(result[0].status).toBe("expired");
    expect(result[1].status).toBe("expiring");
    expect(result[1].daysLeft).toBe(11);
  });
});
