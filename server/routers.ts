import { LOCAL_AUTH_COOKIE_NAME, COOKIE_NAME } from "@shared/const";
import {
  canAccessDepartment,
  canManageDepartmentUsers,
  DEPARTMENTS,
  isDepartmentCode,
  roleLabel,
  type DepartmentCode,
  type PortalRole,
} from "@shared/departmentAccess";
import {
  BOOKING_STAGES,
  STAGE_ROLES,
  transitionBooking,
  type BookingStage,
} from "@shared/bookingRules";
import {
  accountStatusActivity,
  profileUpdateActivity,
  signInActivity,
} from "@shared/activityRules";
import { accountUpdateNotification } from "@shared/accountNotifications";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  publicProcedure,
  protectedProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import { isKnownCrewAssignmentMember } from "../shared/crewAssignmentRoster";
import * as db from "./db";
import {
  createLocalSession,
  hashPassword,
  normalizeEmail,
  toSessionUser,
  verifyPassword,
} from "./localAuth";
import { storagePut } from "./storage";
import { runtimeErrorFingerprint, sanitizeRuntimeMessage } from "../shared/runtimeMonitoring";
import {
  canAccessProvisionedDepartmentDashboard,
  canManageProvisionedDepartmentDashboard,
  createDepartmentDashboardConfig,
  DEPARTMENT_DASHBOARD_ACCENTS,
  DEPARTMENT_DASHBOARD_ICONS,
  DEPARTMENT_DASHBOARD_METRICS,
  DEPARTMENT_DASHBOARD_WIDGETS,
  DEPARTMENT_WORKSTREAMS,
  defaultWorkflowChecklist,
  isValidProvisionedDepartmentCode,
  normalizeDepartmentDashboardConfig,
  normalizeDepartmentCode,
} from "../shared/departmentDashboardRules";
import { isValidDashboardGreetingTemplate } from "../shared/dashboardGreeting";

db.seedInitialDataIfNeeded().catch(console.error);

const accountInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(10).max(160),
  departmentCode: z.string().trim().min(3).max(16),
});

const registrationInput = accountInput.extend({
  role: z.enum(["user", "supervisor"]).default("user"),
});

const localSessionMaxAge = 12 * 60 * 60 * 1000;
const SALES_ENQUIRY_STATUSES = ["New", "In review", "Quoted", "Converted", "Closed"] as const;
const lifecycleStageDepartment: Partial<Record<BookingStage, DepartmentCode>> =
  {
    "Documentation Supervisor": "sales",
    "Crew Assigned": "documentation",
    "Gear Confirmed": "crew",
    "Docs In Progress": "lifting-gears",
    "All Docs Submitted": "documentation",
    Reviewed: "sales",
    Dispatched: "sales",
  };
const lifecycleNotificationDepartment: Record<string, DepartmentCode> = {
  SAL: "sales",
  DOC: "documentation",
  LG: "lifting-gears",
  MNT: "maintenance",
  CRW: "crew",
  HSE: "hse",
  ACC: "accounts",
  HR: "hr",
  TRN: "transportation",
  ADM: "administrator",
};

function writeLocalSession(ctx: { req: any; res: any }, token: string) {
  ctx.res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: localSessionMaxAge,
  });
}

function requireDepartmentAccess(
  user: { role: PortalRole; departmentCode?: string | null },
  code: DepartmentCode
) {
  if (!canAccessDepartment(user, code)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your department account cannot access this workspace.",
    });
  }
}

function requireAccountManagementAccess(
  user: { role: PortalRole; departmentCode?: string | null },
  targetDepartment?: string | null
) {
  if (user.role === "admin") return;
  if (
    user.role === "supervisor" &&
    user.departmentCode &&
    targetDepartment === user.departmentCode
  )
    return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "Only an administrator or the department supervisor can manage this account.",
  });
}

const workflowChecklistInput = z.object({
  id: z.string().trim().min(2).max(64),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  required: z.boolean(),
  guidance: z.string().trim().min(2).max(600),
});

async function requireActiveProvisionedDepartment(code: string) {
  const dashboard = await db.getProvisionedDepartmentDashboard(code);
  if (!dashboard || dashboard.active !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose an active department dashboard before assigning access.",
    });
  }
  return dashboard;
}

export const appRouter = router({
  system: systemRouter,
  departments: router({
    listProvisioned: protectedProcedure.query(async ({ ctx }) => {
      const dashboards = await db.listProvisionedDepartmentDashboards({
        includeArchived: ctx.user.role === "admin",
      });
      return ctx.user.role === "admin"
        ? dashboards
        : dashboards.filter(
            dashboard =>
              dashboard.active === 1 &&
              dashboard.code === ctx.user.departmentCode
          );
    }),
    getProvisioned: protectedProcedure
      .input(z.object({ code: z.string().trim().min(3).max(16) }))
      .query(async ({ ctx, input }) => {
        if (
          !canAccessProvisionedDepartmentDashboard(ctx.user, input.code)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your account cannot access this department dashboard.",
          });
        }
        const dashboard = await db.getProvisionedDepartmentDashboard(input.code);
        if (!dashboard)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This provisioned department dashboard was not found.",
          });
        if (dashboard.active !== 1 && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This department workspace is archived and unavailable.",
          });
        }
        return dashboard;
      }),
    createProvisioned: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(3).max(120),
          code: z.string().trim().min(3).max(32),
          description: z.string().trim().min(12).max(600),
          accent: z.enum(DEPARTMENT_DASHBOARD_ACCENTS),
          icon: z.enum(DEPARTMENT_DASHBOARD_ICONS),
          workstream: z.enum(DEPARTMENT_WORKSTREAMS),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const code = normalizeDepartmentCode(input.code);
        if (!isValidProvisionedDepartmentCode(code) || isDepartmentCode(code)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Use a new 3–16 character department code with lowercase letters, numbers, or hyphens.",
          });
        }
        try {
          const dashboardConfig = createDepartmentDashboardConfig({
            name: input.name,
            workstream: input.workstream,
          });
          const created = await db.createProvisionedDepartmentDashboard({
            code,
            name: input.name,
            description: input.description,
            accent: input.accent,
            icon: input.icon,
            dashboardConfig,
            createdBy: ctx.user.id,
          });
          await db.addUserActivity({
            userId: ctx.user.id,
            action: "department_created",
            detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} provisioned the ${input.name} department dashboard.`,
          });
          await db.addNotification({
            id: `department-provisioned-${code}-${Date.now()}`,
            departmentCode: code,
            title: `${input.name} dashboard is ready`,
            body: "Assign a supervisor and department users to begin working in this workspace.",
          });
          return created;
        } catch (caught) {
          if (caught instanceof TRPCError) throw caught;
          throw new TRPCError({
            code: "CONFLICT",
            message:
              caught instanceof Error
                ? caught.message
                : "The department could not be provisioned.",
          });
        }
      }),
    updateDashboardConfig: protectedProcedure
      .input(
        z.object({
          code: z.string().trim().min(3).max(16),
          overviewLabel: z.string().trim().min(3).max(160),
          objective: z.string().trim().min(12).max(600),
          widgets: z.array(z.enum(DEPARTMENT_DASHBOARD_WIDGETS)).min(1).max(DEPARTMENT_DASHBOARD_WIDGETS.length),
          metrics: z.tuple([
            z.enum(DEPARTMENT_DASHBOARD_METRICS),
            z.enum(DEPARTMENT_DASHBOARD_METRICS),
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!canManageProvisionedDepartmentDashboard(ctx.user, input.code)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only this department’s supervisor or an administrator can configure its dashboard." });
        }
        const dashboard = await requireActiveProvisionedDepartment(input.code);
        const current = normalizeDepartmentDashboardConfig(
          dashboard.dashboardConfig,
          { name: dashboard.name }
        );
        const updated = await db.updateProvisionedDepartmentDashboardConfig({
          code: input.code,
          description: dashboard.description,
          dashboardConfig: {
            ...current,
            overviewLabel: input.overviewLabel,
            objective: input.objective,
            widgets: input.widgets,
            metrics: input.metrics,
          },
        });
        await db.addUserActivity({
          userId: ctx.user.id,
          action: "department_dashboard_configured",
          detail: `${ctx.user.name ?? ctx.user.email ?? "A department lead"} updated the ${dashboard.name} dashboard widgets and metrics.`,
        });
        return updated;
      }),
    setProvisionedActive: adminProcedure
      .input(z.object({ code: z.string().trim().min(3).max(16), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const dashboard = await db.getProvisionedDepartmentDashboard(input.code);
        if (!dashboard) throw new TRPCError({ code: "NOT_FOUND", message: "This department dashboard was not found." });
        const updated = await db.setProvisionedDepartmentActive(input);
        await db.addUserActivity({
          userId: ctx.user.id,
          action: input.active ? "department_reactivated" : "department_archived",
          detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "reactivated" : "archived"} the ${dashboard.name} department without deleting its history.`,
        });
        return updated;
      }),
    listWorkflowTemplates: protectedProcedure
      .input(z.object({ departmentCode: z.string().trim().min(3).max(16) }))
      .query(async ({ ctx, input }) => {
        if (!canAccessProvisionedDepartmentDashboard(ctx.user, input.departmentCode)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your account cannot access this department workflow library." });
        }
        const dashboard = await db.getProvisionedDepartmentDashboard(input.departmentCode);
        if (!dashboard) throw new TRPCError({ code: "NOT_FOUND", message: "This department dashboard was not found." });
        if (dashboard.active !== 1 && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This department workspace is archived." });
        }
        return await db.listDepartmentWorkflowTemplates({
          departmentCode: input.departmentCode,
          includeArchived: ctx.user.role === "admin",
        });
      }),
    createWorkflowTemplate: protectedProcedure
      .input(z.object({
        departmentCode: z.string().trim().min(3).max(16),
        name: z.string().trim().min(3).max(160),
        description: z.string().trim().min(12).max(800),
        checklist: z.array(workflowChecklistInput).min(1).max(16),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!canManageProvisionedDepartmentDashboard(ctx.user, input.departmentCode)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only this department’s supervisor or an administrator can create workflow templates." });
        }
        await requireActiveProvisionedDepartment(input.departmentCode);
        const template = await db.createDepartmentWorkflowTemplate({ ...input, createdBy: ctx.user.id });
        await db.addUserActivity({ userId: ctx.user.id, action: "department_workflow_created", detail: `${ctx.user.name ?? ctx.user.email ?? "A department lead"} created the ${template.name} workflow template.` });
        return template;
      }),
    updateWorkflowTemplate: protectedProcedure
      .input(z.object({
        id: z.string().trim().min(4).max(64),
        departmentCode: z.string().trim().min(3).max(16),
        name: z.string().trim().min(3).max(160),
        description: z.string().trim().min(12).max(800),
        checklist: z.array(workflowChecklistInput).min(1).max(16),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!canManageProvisionedDepartmentDashboard(ctx.user, input.departmentCode)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only this department’s supervisor or an administrator can update workflow templates." });
        }
        await requireActiveProvisionedDepartment(input.departmentCode);
        const templates = await db.listDepartmentWorkflowTemplates({ departmentCode: input.departmentCode, includeArchived: true });
        if (!templates.some(template => template.id === input.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "This workflow template was not found in the selected department." });
        }
        return await db.updateDepartmentWorkflowTemplate(input);
      }),
    setWorkflowTemplateActive: adminProcedure
      .input(z.object({ id: z.string().trim().min(4).max(64), departmentCode: z.string().trim().min(3).max(16), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const templates = await db.listDepartmentWorkflowTemplates({ departmentCode: input.departmentCode, includeArchived: true });
        const template = templates.find(item => item.id === input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "This workflow template was not found." });
        const updated = await db.setDepartmentWorkflowTemplateActive({ id: input.id, active: input.active });
        await db.addUserActivity({ userId: ctx.user.id, action: input.active ? "department_workflow_reactivated" : "department_workflow_archived", detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "restored" : "archived"} the ${template.name} workflow template.` });
        return updated;
      }),
    defaultWorkflowChecklist: protectedProcedure
      .input(z.object({ workstream: z.enum(DEPARTMENT_WORKSTREAMS) }))
      .query(({ input }) => defaultWorkflowChecklist(input.workstream)),
  }),
  rental: router({
    submitEnquiry: publicProcedure
      .input(z.object({
        contactName: z.string().trim().min(2).max(160),
        companyName: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        phone: z.string().trim().min(7).max(48),
        projectLocation: z.string().trim().min(2).max(255),
        equipmentInterest: z.string().trim().min(2).max(120),
        liftDetails: z.string().trim().min(12).max(2000),
      }))
      .mutation(async ({ input }) => {
        const enquiry = await db.createRentalEnquiry({ ...input, email: normalizeEmail(input.email) });
        await db.addNotification({
          id: `rental-enquiry-follow-up-${enquiry.id}`,
          userId: null,
          departmentCode: "sales",
          title: "New rental quote follow-up",
          body: `${input.contactName} from ${input.companyName} requested ${input.equipmentInterest} for ${input.projectLocation}. Enquiry ${enquiry.id} is ready for Sales follow-up.`,
        });
        return enquiry;
      }),
  }),
  salesEnquiries: router({
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
  }),
  auth: router({
    setupStatus: publicProcedure.query(async () => ({
      needsAdminSetup: (await db.countLocalUsers()) === 0,
    })),
    me: publicProcedure.query(opts =>
      opts.ctx.user ? toSessionUser(opts.ctx.user) : null
    ),
    bootstrapAdmin: publicProcedure
      .input(accountInput)
      .mutation(async ({ ctx, input }) => {
        if ((await db.countLocalUsers()) > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "An administrator account is already configured.",
          });
        }
        const email = normalizeEmail(input.email);
        const passwordHash = await hashPassword(input.password);
        const user = await db.createLocalUser({
          name: input.name,
          email,
          passwordHash,
          departmentCode: "administrator",
          role: "admin",
        });
        writeLocalSession(ctx, await createLocalSession(user));
        return toSessionUser(user);
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(160),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByLocalEmail(normalizeEmail(input.email));
        const passwordMatches = user?.passwordHash
          ? await verifyPassword(input.password, user.passwordHash)
          : false;
        if (!user || user.isActive !== 1 || !passwordMatches) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }
        if (
          user.role !== "admin" &&
          user.departmentCode &&
          !isDepartmentCode(user.departmentCode)
        ) {
          const dashboard = await db.getProvisionedDepartmentDashboard(
            user.departmentCode
          );
          if (!dashboard || dashboard.active !== 1) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password.",
            });
          }
        }
        await db.updateUserLastSignedIn(user.id);
        await db.addUserActivity(signInActivity(user.id));
        writeLocalSession(ctx, await createLocalSession(user));
        return toSessionUser({ ...user, lastSignedIn: new Date() });
      }),
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin")
        return (await db.listLocalUsers()).map(toSessionUser);
      if (ctx.user.role === "supervisor" && ctx.user.departmentCode)
        return (await db.listLocalUsers())
          .filter(account => account.departmentCode === ctx.user.departmentCode)
          .map(toSessionUser);
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Only department supervisors can view their department accounts.",
      });
    }),
    listActivity: protectedProcedure
      .input(
        z
          .object({
            from: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            to: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            limit: z.number().int().min(1).max(250).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const from = input?.from
          ? new Date(`${input.from}T00:00:00.000Z`)
          : undefined;
        const to = input?.to
          ? new Date(`${input.to}T23:59:59.999Z`)
          : undefined;
        if (from && to && from > to)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The activity start date must be before the end date.",
          });
        if (ctx.user.role === "admin")
          return await db.listRecentUserActivity({
            from,
            to,
            limit: input?.limit ?? 100,
          });
        if (ctx.user.role === "supervisor" && ctx.user.departmentCode)
          return await db.listRecentUserActivity({
            from,
            to,
            limit: input?.limit ?? 100,
            departmentCode: ctx.user.departmentCode,
          });
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only department supervisors can view their department activity.",
        });
      }),
    getSupervisorPermissionAudit: adminProcedure.query(async () => {
      const accounts = await db.listLocalUsers();
      return accounts
        .filter(account => account.role === "supervisor")
        .map(supervisor => ({
          id: supervisor.id,
          name: supervisor.name,
          email: supervisor.localEmail ?? supervisor.email,
          departmentCode: supervisor.departmentCode,
          isActive: supervisor.isActive,
          createdAt: supervisor.createdAt,
          lastSignedIn: supervisor.lastSignedIn,
          managedUserCount: accounts.filter(
            account =>
              account.role === "user" &&
              account.departmentCode === supervisor.departmentCode &&
              account.isActive === 1
          ).length,
        }));
    }),
    getActivityRetention: adminProcedure.query(async () => ({
      retentionDays: await db.getActivityRetentionDays(),
    })),
    getDashboardGreeting: protectedProcedure.query(async () => ({
      template: await db.getDashboardGreetingTemplate(),
    })),
    updateDashboardGreeting: adminProcedure
      .input(
        z.object({
          template: z
            .string()
            .trim()
            .refine(isValidDashboardGreetingTemplate, {
              message: "Use 3–120 characters and include {name} to personalize the greeting.",
            }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const template = await db.setDashboardGreetingTemplate(
          input.template.trim(),
          ctx.user.id
        );
        await db.addUserActivity({
          userId: ctx.user.id,
          action: "dashboard_greeting_updated",
          detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} updated the dashboard greeting template.`,
        });
        return { template };
      }),
    updateActivityRetention: adminProcedure
      .input(
        z.object({
          retentionDays: z.union([
            z.literal(30),
            z.literal(90),
            z.literal(180),
            z.literal(365),
            z.literal(730),
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const retentionDays = await db.setActivityRetentionDays(
          input.retentionDays,
          ctx.user.id
        );
        await db.addUserActivity({
          userId: ctx.user.id,
          action: "retention_setting_updated",
          detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} set activity-log retention to ${retentionDays} days.`,
        });
        return { retentionDays };
      }),
    purgeExpiredActivity: adminProcedure
      .input(z.object({ confirm: z.literal(true) }))
      .mutation(async ({ ctx }) => {
        const retentionDays = await db.getActivityRetentionDays();
        const cutoff = new Date(
          Date.now() - retentionDays * 24 * 60 * 60 * 1000
        );
        const purgedCount = await db.purgeUserActivityBefore(cutoff);
        await db.addUserActivity({
          userId: ctx.user.id,
          action: "retention_purge",
          detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} purged ${purgedCount} activity event${purgedCount === 1 ? "" : "s"} older than ${retentionDays} days.`,
        });
        return { retentionDays, purgedCount, cutoff };
      }),
    registerUser: protectedProcedure
      .input(registrationInput)
      .mutation(async ({ ctx, input }) => {
        const targetRole = input.role;
        if (targetRole === "supervisor" && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only an administrator can add a department supervisor.",
          });
        }
        requireAccountManagementAccess(ctx.user, input.departmentCode);
        if (input.departmentCode === "administrator")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Use the administrator setup flow for the administrator department.",
          });
        if (!isDepartmentCode(input.departmentCode))
          await requireActiveProvisionedDepartment(input.departmentCode);
        const email = normalizeEmail(input.email);
        if (await db.getUserByLocalEmail(email)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account already exists for this email address.",
          });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await db.createLocalUser({
          name: input.name,
          email,
          passwordHash,
          departmentCode: input.departmentCode,
          role: targetRole,
          supervisorId: ctx.user.role === "supervisor" ? ctx.user.id : null,
        });
        return toSessionUser(user);
      }),
    updateUser: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().max(320),
          departmentCode: z.string().trim().min(3).max(16),
          role: z.enum(["user", "supervisor", "admin"]),
          password: z.string().min(10).max(160).optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.user.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot edit your own account here.",
          });
        if (input.role === "admin" && ctx.user.role !== "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only an administrator can assign administrator access.",
          });
        const existing = await db.getUserById(input.id);
        if (!existing?.localEmail)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That local account could not be found.",
          });
        requireAccountManagementAccess(ctx.user, existing.departmentCode);
        if (
          ctx.user.role === "supervisor" &&
          (existing.departmentCode !== input.departmentCode ||
            input.role !== "user")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Supervisors can only edit users in their own department.",
          });
        }
        if (existing.role === "admin" && ctx.user.role !== "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Administrator accounts are managed by administrators only.",
          });
        const email = normalizeEmail(input.email);
        const emailOwner = await db.getUserByLocalEmail(email);
        if (emailOwner && emailOwner.id !== input.id)
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account already exists for this email address.",
          });
        const departmentCode =
          input.role === "admin" ? "administrator" : input.departmentCode;
        if (input.role !== "admin" && !isDepartmentCode(departmentCode))
          await requireActiveProvisionedDepartment(departmentCode);
        const user = await db.updateLocalUser(input.id, {
          name: input.name,
          email,
          departmentCode,
          role: input.role,
          supervisorId:
            input.role === "user" && ctx.user.role === "supervisor"
              ? ctx.user.id
              : input.role === "admin" || input.role === "supervisor"
                ? null
                : existing.supervisorId,
          ...(input.password
            ? { passwordHash: await hashPassword(input.password) }
            : {}),
        });
        if (!user)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The account could not be updated.",
          });
        const actorLabel =
          ctx.user.name ?? ctx.user.email ?? "an administrator";
        const nextRoleLabel = roleLabel(input.role);
        const departmentLabel =
          input.role === "admin"
            ? "Administrator"
            : (DEPARTMENTS.find(
                department => department.code === input.departmentCode
              )?.label ?? input.departmentCode);
        await db.addUserActivity(
          profileUpdateActivity(
            input.id,
            actorLabel,
            nextRoleLabel,
            departmentLabel
          )
        );
        const accountNotification = accountUpdateNotification(
          nextRoleLabel,
          departmentLabel
        );
        await db.addNotification({
          id: `account-update-${user.id}-${Date.now()}`,
          userId: user.id,
          departmentCode: user.departmentCode ?? input.departmentCode,
          ...accountNotification,
        });
        return toSessionUser(user);
      }),
    setUserActive: protectedProcedure
      .input(
        z.object({ id: z.number().int().positive(), isActive: z.boolean() })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.user.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot deactivate your own account.",
          });
        const existing = await db.getUserById(input.id);
        if (!existing?.localEmail)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That local account could not be found.",
          });
        if (existing.role === "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Administrator accounts cannot be deactivated from this workspace.",
          });
        requireAccountManagementAccess(ctx.user, existing.departmentCode);
        if (ctx.user.role === "supervisor" && existing.role !== "user")
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Supervisors can only manage users in their own department.",
          });
        const user = await db.setLocalUserActive(
          input.id,
          input.isActive ? 1 : 0
        );
        if (!user)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The account status could not be updated.",
          });
        await db.addUserActivity(
          accountStatusActivity(
            input.id,
            input.isActive,
            ctx.user.name ?? ctx.user.email ?? "a department supervisor"
          )
        );
        return toSessionUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.clearCookie(LOCAL_AUTH_COOKIE_NAME, cookieOptions);
      return { success: true } as const;
    }),
  }),

  runtimeMonitoring: router({
    capture: publicProcedure
      .input(z.object({ source: z.enum(["window.error", "unhandledrejection", "react.boundary"]), message: z.string().min(1).max(2000), path: z.string().max(512) }))
      .mutation(async ({ input, ctx }) => {
        const message = sanitizeRuntimeMessage(input.message);
        const path = sanitizeRuntimeMessage(input.path, 512) || "/";
        return await db.createRuntimeErrorEvent({ source: input.source, message, path, fingerprint: runtimeErrorFingerprint(input.source, message, path), userId: ctx.user?.id ?? null });
      }),
    list: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(250).optional() }).optional()).query(async ({ input }) => await db.listRuntimeErrorEvents(input?.limit ?? 100)),
  }),

  clientFeedback: router({
    submit: publicProcedure
      .input(
        z.object({
          bookingId: z.string().trim().min(1).max(64),
          category: z.enum(["Bug report", "Improvement", "Other"]),
          message: z.string().trim().min(10).max(2000),
          contactEmail: z
            .string()
            .trim()
            .email()
            .max(320)
            .optional()
            .or(z.literal("")),
        })
      )
      .mutation(async ({ input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The associated booking could not be found.",
          });
        const feedback = await db.createClientFeedback({
          bookingId: input.bookingId,
          category: input.category,
          message: input.message,
          contactEmail: input.contactEmail || null,
        });
        return { success: true, feedbackId: feedback.id };
      }),
    list: adminProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(250).optional() })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.listClientFeedback(input?.limit ?? 100);
      }),
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.string().min(1).max(64),
          status: z.enum(["Open", "In review", "Resolved"]),
        })
      )
      .mutation(async ({ input }) => {
        const feedback = await db.updateClientFeedbackStatus(
          input.id,
          input.status
        );
        if (!feedback)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Feedback report not found.",
          });
        return feedback;
      }),
  }),

  operations: router({
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
              departmentCode:
                lifecycleNotificationDepartment[notification.departmentCode] ??
                department,
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
          workstream: z.enum(["MNT", "HSE", "ACC", "HR", "TRN"]),
          stage: z.enum(BOOKING_STAGES),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workstreamDepartment: Record<string, DepartmentCode> = {
          MNT: "maintenance",
          HSE: "hse",
          ACC: "accounts",
          HR: "hr",
          TRN: "transportation",
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
            .replace(/^-+|-+$/g, "") || "gear-document";
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
          DOC: "documentation",
          HSE: "hse",
          CRW: "crew",
          ACC: "accounts",
          LG: "lifting-gears",
          TRN: "transportation",
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
  }),
});

export type AppRouter = typeof appRouter;
