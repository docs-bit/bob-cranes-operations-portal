import {
  BOOKING_STAGES,
  STAGE_ROLES,
  transitionBooking,
  type BookingStage,
} from "@shared/bookingRules";
import {
  transitionTrainingFlagStatus,
  type TrainingFlagAction,
} from "@shared/docConsoleRules";
import {
  generatePortalToken,
  hashPortalToken,
  isPortalTokenLive,
  portalTokenExpiry,
} from "../portalTokens";
import {
  isAllowedUploadType,
  MAX_UPLOAD_BYTES,
  saveUploadedFile,
} from "../localFiles";
import { nanoid } from "nanoid";
import { isDepartmentCode, type DepartmentCode } from "@shared/departmentAccess";
import { isKnownCrewAssignmentMember } from "../../shared/crewAssignmentRoster";
import { parseDossierDate } from "@shared/dossierDates";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
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
        id: z.string().trim().min(1).max(64),
        clientName: z.string().trim().min(1).max(255),
        projectName: z.string().trim().min(1).max(255),
        projectManager: z.string().trim().min(1).max(255),
        lpoReference: z.string().trim().min(1).max(128),
        mobilizationDate: z.string().trim().min(1).max(64),
        offHireDate: z.string().trim().min(1).max(64),
        clientContactName: z.string().trim().min(1).max(255),
        clientEmail: z.string().trim().email().max(320),
        clientPhone: z.string().trim().min(1).max(64),
        priority: z.string().trim().min(1).max(32),
        stage: z.string().trim().min(1).max(128),
        craneId: z.string().trim().min(1).max(64).optional(),
        crewIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
        gearIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
        trailerIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
      })
      .superRefine((value, ctx) => {
        const mob = parseDossierDate(value.mobilizationDate);
        const offHire = parseDossierDate(value.offHireDate);
        if (mob && offHire && offHire.getTime() <= mob.getTime()) {
          ctx.addIssue({
            code: "custom",
            path: ["offHireDate"],
            message: "Off-hire must be after mobilization.",
          });
        }
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

  listTrainingFlags: protectedProcedure
    .input(z.object({ bookingId: z.string().min(1) }))
    .query(async ({ input }) => {
      return await db.listTrainingFlags(input.bookingId);
    }),

  listAllTrainingFlags: protectedProcedure
    .input(z.object({ status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"]).default("ALL") }).optional())
    .query(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        !["crew", "hse", "documentation"].includes(ctx.user.departmentCode ?? "")
      )
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Crew, HSE, Documentation or an administrator can review training flags.",
        });
      const flags = await db.listAllTrainingFlags();
      const status = input?.status ?? "ALL";
      return status === "ALL"
        ? flags
        : flags.filter(flag => flag.status === status);
    }),

  getAttendance: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "hr");
      return await db.getAttendanceForDate(input.date);
    }),

  saveAttendance: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        rows: z
          .array(
            z.object({
              employeeName: z.string().trim().min(1).max(255),
              status: z.enum([
                "Present",
                "Half-day",
                "Late",
                "On Leave",
                "Assigned",
                "Off-Site",
              ]),
              checkIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
              checkOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
              note: z.string().trim().max(255).nullable().optional(),
            })
          )
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "hr");
      const saved = await db.saveAttendanceDay(input.date, input.rows, ctx.user.id);
      await db.addUserActivity({
        userId: ctx.user.id,
        action: "attendance_saved",
        detail: `${ctx.user.name ?? ctx.user.email ?? "HR"} saved attendance for ${input.date} (${saved.length} employees).`,
      });
      return { rows: saved };
    }),

  getIntegrations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin")
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only an administrator can review integrations.",
      });
    const settings = await db.getIntegrationSettings();
    return {
      settings,
      drive: {
        serviceAccountConfigured: ENV.googleDriveServiceJson.trim().length > 0,
        rootFolder: settings.driveRootFolder || ENV.googleDriveRootFolder,
      },
      smtp: {
        host: settings.smtpHost || ENV.smtpHost,
        port: settings.smtpPort || ENV.smtpPort,
        fromName: settings.smtpFromName,
        fromEmail: settings.smtpFromEmail || ENV.smtpFromEmail,
        credentialsConfigured:
          (ENV.smtpUser.trim().length > 0 &&
            ENV.smtpPassword.trim().length > 0) ||
          false,
        sendingEnabled: false,
      },
    };
  }),

  saveIntegrations: protectedProcedure
    .input(
      z.object({
        driveRootFolder: z.string().trim().max(128),
        smtpHost: z.string().trim().max(255),
        smtpPort: z.string().trim().regex(/^$|^\d{1,5}$/),
        smtpFromName: z.string().trim().max(128),
        smtpFromEmail: z.string().trim().email().max(320).or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only an administrator can configure integrations.",
        });
      if (input.smtpFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.smtpFromEmail))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter a valid sender email or leave it blank.",
        });
      const settings = await db.saveIntegrationSettings(
        {
          driveRootFolder: input.driveRootFolder,
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort || "587",
          smtpFromName: input.smtpFromName || "BOB Cranes",
          smtpFromEmail: input.smtpFromEmail,
        },
        ctx.user.id
      );
      await db.addUserActivity({
        userId: ctx.user.id,
        action: "integrations_updated",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} updated integration settings. Secrets stay environment-managed.`,
      });
      return { settings };
    }),

  testDriveConfig: protectedProcedure
    .input(
      z.object({
        serviceJson: z.string().trim().min(1).max(20000),
        rootFolderId: z.string().trim().min(1).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only an administrator can test integrations.",
        });
      const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(input.serviceJson) as Record<string, unknown>;
        checks.push({
          name: "Service account JSON parses",
          ok: true,
          detail: "Valid JSON object.",
        });
      } catch {
        checks.push({
          name: "Service account JSON parses",
          ok: false,
          detail: "Paste the full service-account JSON key file.",
        });
      }
      const isServiceAccount =
        parsed !== null && parsed.type === "service_account";
      checks.push({
        name: "Service account type",
        ok: isServiceAccount,
        detail: isServiceAccount
          ? `Client: ${String(parsed?.client_email ?? "unknown")}.`
          : 'The JSON "type" field must be "service_account".',
      });
      const hasKey =
        parsed !== null &&
        typeof parsed.private_key === "string" &&
        parsed.private_key.includes("BEGIN PRIVATE KEY");
      checks.push({
        name: "Private key present",
        ok: hasKey,
        detail: hasKey
          ? "A private key block is embedded."
          : "No private_key block found in the JSON.",
      });
      const folderOk = /^[A-Za-z0-9_-]{10,}$/.test(input.rootFolderId);
      checks.push({
        name: "Root folder ID shape",
        ok: folderOk,
        detail: folderOk
          ? "Looks like a Drive folder ID."
          : "Folder IDs are at least 10 URL-safe characters.",
      });
      checks.push({
        name: "Live connection",
        ok: false,
        detail:
          "Not attempted — pasting a key here never stores or transmits it. Configure GOOGLE_DRIVE_SA_JSON server-side to enable sync.",
      });
      return { checks, passed: checks.every(check => check.ok) };
    }),

  testSmtpConnection: protectedProcedure
    .input(
      z.object({
        host: z.string().trim().min(1).max(255),
        port: z.number().int().min(1).max(65535),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only an administrator can test integrations.",
        });
      const reachable = await new Promise<boolean>(resolve => {
        let settled = false;
        const done = (value: boolean) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        void import("node:net").then(({ Socket }) => {
          const socket = new Socket();
          socket.setTimeout(5000);
          socket.once("connect", () => {
            socket.destroy();
            done(true);
          });
          socket.once("timeout", () => {
            socket.destroy();
            done(false);
          });
          socket.once("error", () => done(false));
          socket.connect(input.port, input.host);
        }).catch(() => done(false));
        setTimeout(() => done(false), 6000).unref?.();
      });
      return {
        reachable,
        detail: reachable
          ? `TCP connect to ${input.host}:${input.port} succeeded. No email was sent.`
          : `Could not open TCP to ${input.host}:${input.port} within 5s. Check host, port, and outbound firewall rules. No email was sent.`,
      };
    }),

  createTrainingFlag: protectedProcedure
    .input(
      z.object({
        bookingId: z.string().min(1).max(64),
        crewId: z.string().min(1).max(64),
        crewName: z.string().trim().min(1).max(255),
        flagType: z.string().trim().min(1).max(64),
        note: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "documentation");
      const raisedBy =
        ctx.user.name ?? ctx.user.email ?? "Documentation Supervisor";
      const flag = await db.createTrainingFlag({
        id: `tflag-${nanoid(12)}`,
        bookingId: input.bookingId,
        crewId: input.crewId,
        crewName: input.crewName,
        flagType: input.flagType,
        note: input.note,
        raisedBy,
        raisedByUserId: ctx.user.id,
      });
      const timestamp = Date.now();
      const notifications = await Promise.all(
        (["documentation", "crew", "hse"] as const).map(
          (departmentCode, index) =>
            db.addNotification({
              id: `tflag-${flag.id}-${departmentCode}-${timestamp}-${index}`,
              userId: null,
              departmentCode,
              title: `Training flag raised · ${input.crewName}`,
              body: `${input.flagType} on ${input.bookingId} — ${input.note} (raised by ${raisedBy}).`,
            })
        )
      );
      return { flag, notifications };
    }),

  updateTrainingFlag: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(64),
        action: z.enum(["acknowledge", "resolve"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const action = input.action as TrainingFlagAction;
      if (ctx.user.role !== "admin") {
        const department = ctx.user.departmentCode ?? "";
        if (action === "resolve") {
          if (department !== "hse")
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only HSE or an administrator can resolve a training flag.",
            });
        } else if (!["documentation", "crew", "hse"].includes(department)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Only Crew, HSE, Documentation or an administrator can acknowledge flags.",
          });
        }
      }
      const existing = (await db.listTrainingFlags("")).find(
        row => row.id === input.id
      );
      const current = existing?.status ?? "OPEN";
      let next: "ACKNOWLEDGED" | "RESOLVED";
      try {
        next = transitionTrainingFlagStatus(
          current as "OPEN" | "ACKNOWLEDGED" | "RESOLVED",
          action
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "This flag cannot change state that way.",
        });
      }
      const flag = await db.updateTrainingFlagStatus(
        input.id,
        next,
        ctx.user.name ?? ctx.user.email ?? null
      );
      return { flag };
    }),

  runExpiryCheck: protectedProcedure.mutation(async ({ ctx }) => {
    if (
      ctx.user.role !== "admin" &&
      !["hse", "documentation", "crew"].includes(ctx.user.departmentCode ?? "")
    )
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only HSE, Crew, Documentation or an administrator can run the expiry check.",
      });
    return await db.runCertificateExpiryCheckIfStale();
  }),

  getExpiryCheckStatus: protectedProcedure.query(async () => ({
    lastRun: await db.getExpiryCheckLastRun(),
  })),

  issuePortalToken: protectedProcedure
    .input(
      z.object({
        bookingId: z.string().trim().min(1).max(64),
        clientName: z.string().trim().min(1).max(255),
        projectName: z.string().trim().min(1).max(255),
        mobDate: z.string().trim().min(1).max(64),
        offHireDate: z.string().trim().min(1).max(64),
        priority: z.string().trim().min(1).max(32).default("Standard"),
        requiredDocs: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(255),
              departmentCode: z.string().trim().min(1).max(32),
            })
          )
          .max(30)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "documentation");
      for (const doc of input.requiredDocs) {
        if (!isDepartmentCode(doc.departmentCode))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown department: ${doc.departmentCode}.`,
          });
      }
      const token = generatePortalToken();
      const record = await db.createPortalToken({
        id: `ptk-${nanoid(12)}`,
        tokenHash: hashPortalToken(token),
        bookingId: input.bookingId,
        clientName: input.clientName,
        projectName: input.projectName,
        mobDate: input.mobDate,
        offHireDate: input.offHireDate,
        priority: input.priority,
        createdBy: ctx.user.id,
        expiresAt: portalTokenExpiry(),
      });
      let seeded = 0;
      for (const doc of input.requiredDocs) {
        await db.upsertDocument({
          id: `req-${nanoid(12)}`,
          bookingId: input.bookingId,
          departmentCode: doc.departmentCode,
          name: doc.name,
          state: "Required",
          required: 1,
        });
        seeded += 1;
      }
      await db.addNotification({
        id: `portal-issued-${record.id}`,
        userId: null,
        departmentCode: "documentation",
        title: `Client portal link issued · ${input.bookingId}`,
        body: `A 24-hour portal link was issued by ${ctx.user.name ?? ctx.user.email ?? "Documentation"} with ${seeded} required documents.`,
      });
      return { token, expiresAt: record.expiresAt, seeded };
    }),

  revokePortalTokens: protectedProcedure
    .input(z.object({ bookingId: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "documentation");
      const tokens = await db.revokePortalTokensForBooking(input.bookingId);
      await db.addNotification({
        id: `portal-revoked-${input.bookingId}-${Date.now()}`,
        userId: null,
        departmentCode: "documentation",
        title: `Client portal closed · ${input.bookingId}`,
        body: `All portal links were revoked by ${ctx.user.name ?? ctx.user.email ?? "Documentation"}.`,
      });
      return { tokens };
    }),

  listPortalTokens: protectedProcedure
    .input(z.object({ bookingId: z.string().trim().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      requireDepartmentAccess(ctx.user, "documentation");
      return await db.listPortalTokens(input.bookingId);
    }),

  getPortalContext: publicProcedure
    .input(z.object({ token: z.string().trim().min(1).max(128) }))
    .query(async ({ input }) => {
      const row = await db.getPortalTokenByHash(hashPortalToken(input.token));
      if (!row || !isPortalTokenLive(row))
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This link is no longer valid. Contact your BOB Cranes coordinator for a new one.",
        });
      const [documents, metadata, chat] = await Promise.all([
        db.getDocumentsForBooking(row.bookingId),
        db.listPersistedDocumentMetadata(row.bookingId),
        db.getChatForBooking(row.bookingId),
      ]);
      return {
        booking: {
          id: row.bookingId,
          clientName: row.clientName,
          projectName: row.projectName,
          mobDate: row.mobDate,
          offHireDate: row.offHireDate,
          priority: row.priority,
        },
        documents: documents.filter(document => document.required === 1),
        metadata,
        chat: chat.slice(-20),
        expiresAt: row.expiresAt,
      };
    }),

  postPortalChat: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(1).max(128),
        team: z.enum([
          "Sales",
          "Documentation",
          "HSE",
          "Accounts",
          "Operations Management",
        ]),
        displayName: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const row = await db.getPortalTokenByHash(hashPortalToken(input.token));
      if (!row || !isPortalTokenLive(row))
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This link is no longer valid. Contact your BOB Cranes coordinator for a new one.",
        });
      const message = await db.addChatMessage({
        id: `pchat-${nanoid(12)}`,
        bookingId: row.bookingId,
        team: input.team,
        sender: `Client · ${input.displayName}`,
        body: input.body,
      });
      await db.addNotification({
        id: `pchat-${message.id}`,
        userId: null,
        departmentCode:
          input.team === "Documentation"
            ? "documentation"
            : input.team === "HSE"
              ? "hse"
              : input.team === "Sales"
                ? "sales"
                : input.team === "Accounts"
                  ? "accounts"
                  : "documentation",
        title: `Client message · ${row.bookingId}`,
        body: `${input.displayName} wrote to ${input.team}: ${input.body.slice(0, 140)}`,
      });
      return { message };
    }),

  uploadPortalDocument: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(1).max(128),
        documentId: z.string().trim().min(1).max(64),
        fileName: z.string().trim().min(1).max(255),
        fileType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
        fileSize: z.number().int().min(1).max(25 * 1024 * 1024),
        contentBase64: z.string().min(1).max(35_000_000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const row = await db.getPortalTokenByHash(hashPortalToken(input.token));
      if (!row || !isPortalTokenLive(row))
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This link is no longer valid. Contact your BOB Cranes coordinator for a new one.",
        });
      const docs = await db.getDocumentsForBooking(row.bookingId);
      const target = docs.find(document => document.id === input.documentId);
      if (!target)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That required document is not on this booking checklist.",
        });
      let storageKey: string | null = null;
      if (input.contentBase64) {
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (bytes.length !== input.fileSize)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The uploaded file arrived incomplete. Please retry.",
          });
        const stored = await saveUploadedFile({
          fileName: input.fileName,
          contentType: input.fileType,
          bytes,
        });
        storageKey = stored.key;
      }
      await db.upsertDocument({
        id: target.id,
        bookingId: row.bookingId,
        departmentCode: target.departmentCode,
        name: target.name,
        state: "Uploaded",
        required: 1,
      });
      await db.upsertPersistedDocumentMetadata({
        id: target.id,
        bookingId: row.bookingId,
        name: target.name,
        departmentCode: target.departmentCode,
        state: "Uploaded",
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        storageKey,
        uploadedBy: null,
      });
      await db.addNotification({
        id: `pupload-${target.id}-${Date.now()}`,
        userId: null,
        departmentCode: "documentation",
        title: `Client upload · ${row.bookingId}`,
        body: `${target.name} was uploaded by the client (${input.fileName}).`,
      });
      return { documentId: target.id, state: "Uploaded" as const };
    }),

  requestPortalLink: publicProcedure
    .input(
      z.object({
        bookingLabel: z.string().trim().max(255).optional(),
        contactEmail: z.string().trim().email().max(320),
        message: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      await db.addNotification({
        id: `portal-request-${Date.now()}`,
        userId: null,
        departmentCode: "documentation",
        title: "Client requested a portal link",
        body: `${input.contactEmail}${input.bookingLabel ? ` · ${input.bookingLabel}` : ""}: ${input.message}`,
      });
      return { received: true };
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

  uploadDocumentFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
        base64: z.string().min(1).max(35_000_000),
      })
    )
    .mutation(async ({ input }) => {
      const bytes = Buffer.from(input.base64, "base64");
      return await saveUploadedFile({
        fileName: input.fileName,
        contentType: input.contentType,
        bytes,
      });
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
      // Managed Forge storage when configured; otherwise self-hosted disk.
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
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
      }
      const stored = await saveUploadedFile({
        fileName: safeName,
        contentType:
          contentType === "application/octet-stream"
            ? "application/pdf"
            : contentType,
        bytes,
      });
      return {
        key: stored.key,
        url: stored.url,
        name: input.fileName,
        contentType,
        size: stored.size,
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

  recordDispatch: protectedProcedure
    .input(
      z.object({
        id: z.string().trim().min(1).max(64),
        bookingId: z.string().trim().min(1).max(64),
        sentToEmail: z.string().trim().email().max(320),
        subject: z.string().trim().min(1).max(255),
        summary: z.string().trim().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        requireDepartmentAccess(ctx.user, "documentation");
      const record = await db.createDispatchRecord({
        ...input,
        dispatchedBy: ctx.user.id,
      });
      await db.addUserActivity({
        userId: ctx.user.id,
        action: "dispatch_recorded",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Documentation"} recorded dispatch ${input.id} for ${input.bookingId}. Email sending is not configured; the package was NOT emailed.`,
      });
      return { record };
    }),
});
