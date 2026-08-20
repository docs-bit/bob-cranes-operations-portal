import { describe, expect, it } from "vitest";
import { VEHICLE_FLEET, VEHICLE_FLEET_SOURCE } from "../shared/vehicleFleetData";
import { filterVehicleFleet, vehicleRegistrationStatus } from "../shared/vehicleFleetRules";

describe("Transportation vehicle fleet workbook integration", () => {
  it("exposes every valid workbook vehicle row with stable unique IDs", () => {
    expect(VEHICLE_FLEET_SOURCE.recordCount).toBe(533);
    expect(VEHICLE_FLEET).toHaveLength(533);
    expect(new Set(VEHICLE_FLEET.map((vehicle) => vehicle.id)).size).toBe(VEHICLE_FLEET.length);
    expect(VEHICLE_FLEET.find((vehicle) => vehicle.fleetCode === "B-253" && vehicle.registrationNumber === "2190")).toMatchObject({ fleetName: "60 Ton Mobile Crane", mulkiyaExpiry: "27/04/2027" });
  });

  it("filters by workbook fields and classifies Mulkiya dates safely", () => {
    const referenceDate = new Date(Date.UTC(2026, 7, 14));
    expect(vehicleRegistrationStatus("04/08/2026", referenceDate)).toBe("Expired");
    expect(vehicleRegistrationStatus("31/08/2026", referenceDate)).toBe("Expiring soon");
    expect(vehicleRegistrationStatus("27/04/2027", referenceDate)).toBe("Valid");
    expect(vehicleRegistrationStatus("", referenceDate)).toBe("Unknown");
    expect(filterVehicleFleet(VEHICLE_FLEET, "BFT-207", "All", "All", referenceDate)).toHaveLength(1);
    expect(filterVehicleFleet(VEHICLE_FLEET, "", "40 Ft. Trailer", "All", referenceDate).every((vehicle) => vehicle.fleetName === "40 Ft. Trailer")).toBe(true);
  });
});
