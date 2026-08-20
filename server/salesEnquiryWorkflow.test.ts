import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const enquiry = {
  id: "rental-enquiry-qa",
  contactName: "Amina Hassan",
  companyName: "Gulf Project Works",
  email: "amina@example.com",
  phone: "+971501234567",
  projectLocation: "Dubai Industrial City",
  equipmentInterest: "Managed lifting service",
  liftDetails: "Planned lifting support for controlled maintenance mobilisation.",
  status: "New",
  assignedToUserId: null,
  convertedBookingId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function contextFor(user: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  return {
    user: {
      id: 71,
      openId: "sales-enquiry-test",
      email: "sales@bobcranes.com",
      name: "Sales Supervisor",
      loginMethod: "password",
      role: "supervisor",
      departmentCode: "sales",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...user,
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("Sales enquiry workflow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("limits the enquiry inbox to Sales users and administrators", async () => {
    const caller = appRouter.createCaller(contextFor({ role: "user", departmentCode: "hse" }));
    await expect(caller.salesEnquiries.list({ status: "all" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a Sales supervisor to assign an active Sales owner and notify that owner", async () => {
    vi.spyOn(db, "getRentalEnquiryById").mockResolvedValue(enquiry as any);
    vi.spyOn(db, "listLocalUsers").mockResolvedValue([{ id: 72, departmentCode: "sales", isActive: 1, name: "Sales Coordinator" }] as any);
    const update = vi.spyOn(db, "updateRentalEnquirySalesContext").mockResolvedValue({ ...enquiry, assignedToUserId: 72 } as any);
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    const notify = vi.spyOn(db, "addNotification").mockResolvedValue({} as any);

    const result = await appRouter.createCaller(contextFor({})).salesEnquiries.assignOwner({ id: enquiry.id, assignedToUserId: 72 });

    expect(result?.assignedToUserId).toBe(72);
    expect(update).toHaveBeenCalledWith({ id: enquiry.id, assignedToUserId: 72 });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 72, departmentCode: "sales", title: "Rental enquiry assigned to you" }));
  });

  it("converts an unconverted Sales enquiry to a traceable booking dossier", async () => {
    vi.spyOn(db, "getRentalEnquiryById").mockResolvedValueOnce(enquiry as any).mockResolvedValueOnce({ ...enquiry, status: "Converted", convertedBookingId: "BOB Booking-12345678" } as any);
    const createBooking = vi.spyOn(db, "createBooking").mockResolvedValue({} as any);
    const markConverted = vi.spyOn(db, "markRentalEnquiryConverted").mockResolvedValue({ ...enquiry, status: "Converted", convertedBookingId: "BOB Booking-12345678" } as any);
    vi.spyOn(db, "getBookingById").mockResolvedValue({ id: "BOB Booking-12345678", clientName: enquiry.companyName, projectName: `Rental enquiry · ${enquiry.projectLocation}` } as any);
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    vi.spyOn(db, "addNotification").mockResolvedValue({} as any);

    const result = await appRouter.createCaller(contextFor({ role: "user", departmentCode: "sales" })).salesEnquiries.convertToBooking({ id: enquiry.id });

    expect(result.booking.id).toMatch(/^BOB Booking-/);
    expect(createBooking).toHaveBeenCalledWith(expect.objectContaining({ clientName: enquiry.companyName, clientEmail: enquiry.email, lpoReference: `Enquiry ${enquiry.id}` }));
    expect(markConverted).toHaveBeenCalledWith(expect.objectContaining({ id: enquiry.id, bookingId: expect.stringMatching(/^BOB Booking-/) }));
  });
});
