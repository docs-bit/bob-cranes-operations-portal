import {
  BOOKING_STAGES,
  STAGE_ROLES,
  transitionBooking,
  type BookingStage,
} from "@shared/bookingRules";
import { isDepartmentCode, type DepartmentCode } from "@shared/departmentAccess";
import { isKnownCrewAssignmentMember } from "../../shared/crewAssignmentRoster";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { storagePut } from "../storage";
import { requireDepartmentAccess } from "../_core/helpers";

const lifecycleStageDepartment: Partial<Record<BookingStage, DepartmentCode>> = {
  "Documentation Supervisor": "sales",
  "Crew Assigned": "documentation",
  "Gear Confirmed": "crew",
  "Docs In Progress": "lifting-gears",
  "All Docs Submitted": "documentation",
  Reviewed: "sales",
  Dispatched: "sales",
};

const teamByDepartment: Record<DepartmentCode, string> = {
  sales: "Sales",
  documentation: "Documentation",
  hse: "HSE",
  accounts: "Accounts",
  administrator: "Operations Management",
  "lifting-gears": "Operations Management",
  maintenance: "Operations Management",
  crew: "Operations Management",
  hr: "Operations Management",
  transportation: "Operations Management",
};

export const operationsRouter = router({
  seed: protectedProcedure.mutation(async () => {
    await db.seedInitialDataIfNeeded();
    return { success: true };
  }),

  getBookings: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.getAllBookings();
  }),

  getBooking: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await db.getBookingById(input.id);
    }),

  createBooking: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string(),
        projectName: z.string(),
        projectManager: z.string(),
        lpoReference: z.string(),
        mobilizationDate: z.string(),
        offHireDate: z.string(),
        clientContactName: z.string(),
        clientEmail: z.string(),
        clientPhone: z.string(),
        priority: z.string(),
        stage: z.string(),
        craneId: z.string().optional(),
        crewIds: z.array(z.string()).optional(),
        gearIds: z.array(z.string()).optional(),
        trailerIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      return await db.createBooking(input);
    }),

  updateStage: protectedProcedure
    .input(z.object({ id: z.string(), stage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      return await db.updateBookingStage(input.id, input.stage);
    }),

  advanceBookingStage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        currentStage: z.enum(BOOKING_STAGES),
        nextStage: z.enum(BOOKING_STAGES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentStage = input.currentStage as BookingStage;
      const nextStage = input.nextStage as BookingStage;
      const department = lifecycleStageDepartment[nextStage];
      if (!department)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That lifecycle stage has no owning department.",
        });
      requireDepartmentAccess(ctx.user, department);
      const booking = await db.getBookingById(input.id);
      let transition;
      try {
        transition = transitionBooking(
          currentStage,
          nextStage,
          STAGE_ROLES[nextStage]
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "The lifecycle transition is not valid.",
        });
      }
      const updated = booking
        ? await db.updateBookingStage(input.id, transition.stage)
        : { id: input.id, stage: transition.stage };
      const timestamp = Date.now();
      await Promise.all(
        transition.notifications.map((notification, index) =>
          db.addNotification({
            id: `lifecycle-${input.id}-${timestamp}-${index}`,
            userId: null,
            departmentCode: notification.departmentCode ?? department,
            title: notification.title,
            body: `${notification.body} · ${input.id}`,
          })
        )
      );
      return {
        booking: updated,
        stage: transition.stage,
        notifications: transition.notifications,
      };
    }),

  completeBookingWorkstream: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        workstream: z.enum(["maintenance", "hse", "accounts", "hr", "transportation"]),
        stage: z.enum(BOOKING_STAGES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workstreamDepartment: Record<string, DepartmentCode> = {
        maintenance: "maintenance",
        hse: "hse",
        accounts: "accounts",
        hr: "hr",
        transportation: "transportation",
      };
      const department = workstreamDepartment[input.workstream];
      requireDepartmentAccess(ctx.user, department);
      await db.getBookingById(input.id);
      await db.addNotification({
        id: `workstream-${input.id}-${input.workstream}-${Date.now()}`,
        userId: null,
        departmentCode: "documentation",
        title: `${input.workstream} workstream complete`,
        body: `${department} confirmed its evidence for ${input.id}. Documentation can review the parallel readiness queue.`,
      });
      return {
        id: input.id,
        workstream: input.workstream,
        stage: input.stage,
        departmentCode: department,
      };
    }),

  updateAssignment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        craneId: z.string().optional(),
        crewIds: z.array(z.string()).optional(),
        gearIds: z.array(z.string()).optional(),
        trailerIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "documentation");
      return await db.updateBookingAssignment(input.id, input);
    }),

  getCrewAllocations: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.listBookingCrewAllocations();
  }),

  saveCrewAllocations: protectedProcedure
    .input(
      z.object({
        crewId: z.string(),
        crewName: z.string().min(1),
        bookingIds: z.array(z.string()).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "crew");
      const crewList = await db.getAllCrew();
      if (
        !crewList.some(
          member =>
            member.id === input.crewId && member.name === input.crewName
        ) &&
        !isKnownCrewAssignmentMember(input.crewId, input.crewName)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That employee is not in the persisted crew roster.",
        });
      }
      for (const bookingId of input.bookingIds) {
        if (!(await db.getBookingById(bookingId))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Booking ${bookingId} is not available for persisted allocation.`,
          });
        }
      }
      const allocations = await db.replaceCrewBookingAllocations({
        ...input,
        assignedBy: ctx.user.id,
      });
      return { allocations };
    }),

  getEquipment: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.getAllEquipment();
  }),

  getCrew: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.getAllCrew();
  }),

  getGears: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.getAllLiftingGears();
  }),

  uploadGearDocument: protectedProcedure
    .input(
      z.object({
        fileName: z.string().trim().min(1).max(180),
        contentType: z
          .string()
          .trim()
          .max(120)
          .default("application/octet-stream"),
        base64: z.string().min(1).max(10_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "lifting-gears");
      const allowedTypes = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);
      const contentType = allowedTypes.has(input.contentType)
        ? input.contentType
        : "application/octet-stream";
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 7_500_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Each lifting-gear document must be between 1 byte and 7.5 MB.",
        });
      }
      const safeName =
        input.fileName
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^-+|-+$/, "") || "gear-document";
      const { key, url } = await storagePut(
        `lifting-gears/${ctx.user.id}/${Date.now()}-${safeName}`,
        bytes,
        contentType
      );
      return {
        key,
        url,
        name: input.fileName,
        contentType,
        size: bytes.length,
      };
    }),

  getTrailers: protectedProcedure.query(async () => {
    await db.seedInitialDataIfNeeded();
    return await db.getAllTrailers();
  }),

  getDocuments: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      return await db.getDocumentsForBooking(input.bookingId);
    }),

  upsertDocument: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        bookingId: z.string(),
        departmentCode: z.string(),
        name: z.string(),
        state: z.string(),
        expiryDate: z.string().optional(),
        required: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const departmentByDocumentCode: Record<string, DepartmentCode> = {
        documentation: "documentation",
        hse: "hse",
        crew: "crew",
        accounts: "accounts",
        "lifting-gears": "lifting-gears",
        transportation: "transportation",
      };
      const departmentCode = departmentByDocumentCode[input.departmentCode];
      if (departmentCode) requireDepartmentAccess(ctx.user, departmentCode);
      return await db.upsertDocument(input);
    }),

  getChat: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      return await db.getChatForBooking(input.bookingId);
    }),

  addChat: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        bookingId: z.string(),
        team: z.string(),
        sender: z.string(),
        body: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expectedTeam =
        ctx.user.role === "admin"
          ? input.team
          : teamByDepartment[ctx.user.departmentCode as DepartmentCode];
      if (
        ctx.user.role !== "admin" &&
        (!expectedTeam || input.team !== expectedTeam)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your department account cannot post as another team.",
        });
      }
      return await db.addChatMessage({
        ...input,
        team: expectedTeam ?? input.team,
        sender:
          ctx.user.role === "admin"
            ? input.sender
            : (ctx.user.name ?? ctx.user.email ?? "Department user"),
      });
    }),

  getNotifications: protectedProcedure
    .input(z.object({ departmentCode: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        input?.departmentCode &&
        input.departmentCode !== ctx.user.departmentCode
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Your department account cannot access these notifications.",
        });
      }
      return await db.getNotifications({
        departmentCode:
          ctx.user.role === "admin"
            ? input?.departmentCode
            : (ctx.user.departmentCode ?? undefined),
        userId: ctx.user.id,
      });
    }),

  addNotification: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        departmentCode: z
          .string()
          .refine(isDepartmentCode, "Choose a valid department."),
        title: z.string(),
        body: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        requireDepartmentAccess(
          ctx.user,
          input.departmentCode as DepartmentCode
        );
      return await db.addNotification(input);
    }),

  clearNotifications: protectedProcedure
    .input(z.object({ departmentCode: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        input?.departmentCode &&
        input.departmentCode !== ctx.user.departmentCode
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Your department account cannot clear these notifications.",
        });
      }
      await db.markAllNotificationsRead({
        departmentCode:
          ctx.user.role === "admin"
            ? input?.departmentCode
            : (ctx.user.departmentCode ?? undefined),
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  requestDispatchBundle: protectedProcedure
    .input(z.object({ bookingId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "sales");
      const booking = await db.getBookingById(input.bookingId);
      if (!booking)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The booking dossier could not be found.",
        });
      if (booking.stage !== "Reviewed" && booking.stage !== "Dispatched") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "A dispatch bundle can be generated only after the dossier has been reviewed.",
        });
      }
      const docs = await db.getDocumentsForBooking(input.bookingId);
      const outstanding = docs.filter(
        document =>
          document.required === 1 &&
          !["Uploaded", "Approved"].includes(document.state)
      );
      if (outstanding.length) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Required documents are still incomplete, so the dispatch bundle is locked.",
        });
      }
      await db.addUserActivity({
        userId: ctx.user.id,
        action: "dispatch_bundle_generated",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Sales"} requested the dispatch PDF bundle for ${input.bookingId}.`,
      });
      return { booking, documents: docs };
    }),
});
