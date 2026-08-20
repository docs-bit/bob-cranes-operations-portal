import { describe, expect, it } from "vitest";
import { RENTAL_DURATION_OPTIONS, RENTAL_EQUIPMENT_TYPES } from "../shared/rentalEnquiryOptions";

describe("rental enquiry selection options", () => {
  it("exposes the approved equipment types and rental durations for public enquiry validation", () => {
    expect(RENTAL_EQUIPMENT_TYPES).toContain("Mobile crane");
    expect(RENTAL_EQUIPMENT_TYPES).toContain("Managed lifting service");
    expect(RENTAL_DURATION_OPTIONS).toContain("One day");
    expect(RENTAL_DURATION_OPTIONS).toContain("To be confirmed");
  });
});
