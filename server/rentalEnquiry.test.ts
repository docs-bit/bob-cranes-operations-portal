import { describe, expect, it, vi, afterEach } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("public rental enquiry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stores a bounded, validated equipment-rental enquiry without requiring portal sign-in", async () => {
    const create = vi.spyOn(db, "createRentalEnquiry").mockResolvedValue({ id: "rental-enquiry-test", status: "New" });
    const notifySales = vi.spyOn(db, "addNotification").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.rental.submitEnquiry({
      contactName: "Amina Hassan",
      companyName: "Gulf Project Works",
      email: "AMINA@EXAMPLE.COM",
      phone: "+971 50 123 4567",
      projectLocation: "Dubai Industrial City",
      equipmentInterest: "Managed lifting service",
      rentalDuration: "1–4 weeks",
      liftDetails: "Planned lifting support for a controlled plant maintenance mobilisation.",
    });

    expect(result).toEqual({ id: "rental-enquiry-test", status: "New" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      email: "amina@example.com",
      equipmentInterest: "Managed lifting service",
      rentalDuration: "1–4 weeks",
    }));
    expect(notifySales).toHaveBeenCalledWith(expect.objectContaining({
      departmentCode: "sales",
      title: "New rental quote follow-up",
      body: expect.stringContaining("Gulf Project Works"),
    }));
    expect(notifySales).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining("1–4 weeks"),
    }));
  });
});
