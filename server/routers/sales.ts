import { normalizeEmail } from "../localAuth";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { requireDepartmentAccess } from "../_core/helpers";
import { checkPublicMutationRateLimit } from "../_core/rateLimiter";
import { RENTAL_DURATION_OPTIONS, RENTAL_EQUIPMENT_TYPES } from "../../shared/rentalEnquiryOptions";

const SALES_ENQUIRY_STATUSES = ["New", "In review", "Quoted", "Converted", "Closed"] as const;

export const rentalRouter = router({
  submitEnquiry: publicProcedure
    .input(
      z.object({
        contactName: z.string().trim().min(2).max(160),
        companyName: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        phone: z.string().trim().min(7).max(48),
        projectLocation: z.string().trim().min(2).max(255),
        equipmentInterest: z.enum(RENTAL_EQUIPMENT_TYPES),
        rentalDuration: z.enum(RENTAL_DURATION_OPTIONS),
        liftDetails: z.string().trim().min(12).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!checkPublicMutationRateLimit(ctx.req, "enquiry")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many quote requests. Please try again later.",
        });
      }
      const enquiry = await db.createRentalEnquiry({ ...input, email: normalizeEmail(input.email) });
      await db.addNotification({
        id: `rental-enquiry-follow-up-${enquiry.id}`,
        userId: null,
        departmentCode: "sales",
        title: "New rental quote follow-up",
        body: `${input.contactName} from ${input.companyName} requested ${input.equipmentInterest} for ${input.rentalDuration} at ${input.projectLocation}. Enquiry ${enquiry.id} is ready for Sales follow-up.`,
      });
      return enquiry;
    }),
});

export const salesEnquiriesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum([...SALES_ENQUIRY_STATUSES, "all"]).default("all") }).optional())
    .query(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      return await db.listRentalEnquiries({ status: input?.status ?? "all" });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64) }))
    .query(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      return enquiry;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64), status: z.enum(SALES_ENQUIRY_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      if (enquiry.convertedBookingId && input.status !== "Converted") throw new TRPCError({ code: "BAD_REQUEST", message: "Converted enquiries retain their Converted status for traceability." });
      const updated = await db.updateRentalEnquirySalesContext(input);
      await db.addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_status_updated", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} changed enquiry ${input.id} to ${input.status}.` });
      return updated;
    }),

  assignOwner: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64), assignedToUserId: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      if (ctx.user.role !== "admin" && ctx.user.role !== "supervisor") throw new TRPCError({ code: "FORBIDDEN", message: "Only Sales supervisors can assign enquiry ownership." });
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      if (input.assignedToUserId !== null) {
        const owner = (await db.listLocalUsers()).find(user => user.id === input.assignedToUserId && user.departmentCode === "sales" && user.isActive === 1);
        if (!owner) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an active Sales account as enquiry owner." });
      }
      const updated = await db.updateRentalEnquirySalesContext(input);
      await db.addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_owner_assigned", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales supervisor"} ${input.assignedToUserId ? "assigned" : "cleared"} ownership for enquiry ${input.id}.` });
      if (input.assignedToUserId) await db.addNotification({ id: `sales-enquiry-assigned-${input.id}-${Date.now()}`, userId: input.assignedToUserId, departmentCode: "sales", title: "Rental enquiry assigned to you", body: `${enquiry.contactName} · ${enquiry.equipmentInterest} · ${enquiry.projectLocation}.` });
      return updated;
    }),

  getAuditEvents: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64) }))
    .query(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      return await db.listRentalEnquiryEvents(input.id);
    }),

  recordQuickReply: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      const event = await db.createRentalEnquiryEvent({
        rentalEnquiryId: input.id,
        actorUserId: ctx.user.id,
        eventType: "quick_reply_sent",
        summary: `Quick reply email opened for ${enquiry.contactName} at ${enquiry.email}.`,
      });
      await db.addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_quick_reply_sent", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} opened a quick reply for enquiry ${input.id}.` });
      return event;
    }),

  getSlaConfig: protectedProcedure
    .query(async ({ ctx }) => {
      requireDepartmentAccess(ctx.user, "sales");
      return await db.getSalesEnquirySlaConfig();
    }),

  updateSlaConfig: protectedProcedure
    .input(z.object({ warningHours: z.number().int().min(1).max(168), criticalHours: z.number().int().min(2).max(336) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can update Sales SLA thresholds." });
      if (input.criticalHours <= input.warningHours) throw new TRPCError({ code: "BAD_REQUEST", message: "Critical threshold must be greater than warning threshold." });
      const config = await db.setSalesEnquirySlaConfig(input, ctx.user.id);
      await db.addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_sla_updated", detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} set Sales SLA thresholds to ${input.warningHours}h warning and ${input.criticalHours}h critical.` });
      return config;
    }),

  convertToBooking: protectedProcedure
    .input(z.object({ id: z.string().trim().min(4).max(64) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const enquiry = await db.getRentalEnquiryById(input.id);
      if (!enquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Sales enquiry not found." });
      if (enquiry.convertedBookingId) throw new TRPCError({ code: "CONFLICT", message: "This enquiry has already been converted to a booking." });
      const bookingId = `BOB Booking-${Date.now().toString().slice(-8)}`;
      await db.createBooking({
        id: bookingId,
        clientName: enquiry.companyName,
        projectName: `Rental enquiry · ${enquiry.projectLocation}`,
        projectManager: ctx.user.name ?? ctx.user.email ?? "Sales follow-up",
        lpoReference: `Enquiry ${enquiry.id}`,
        mobilizationDate: "To be confirmed",
        offHireDate: "To be confirmed",
        clientContactName: enquiry.contactName,
        clientEmail: enquiry.email,
        clientPhone: enquiry.phone,
        priority: "Standard",
        stage: "Created by Salesperson",
      });
      const converted = await db.markRentalEnquiryConverted({ id: enquiry.id, bookingId });
      const booking = await db.getBookingById(bookingId);
      await db.addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_converted", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} converted enquiry ${enquiry.id} to ${bookingId}.` });
      await db.addNotification({ id: `sales-enquiry-converted-${enquiry.id}`, departmentCode: "sales", title: "Rental enquiry converted to booking", body: `${enquiry.companyName} is now tracked as ${bookingId}. Complete mobilisation and off-hire dates in the booking dossier.` });
      return { enquiry: converted, booking: booking ?? { id: bookingId } };
    }),
});
