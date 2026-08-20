import {
  isDepartmentCode,
  type DepartmentCode,
} from "@shared/departmentAccess";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
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
} from "../../shared/departmentDashboardRules";
import {
  workflowChecklistInput,
  requireActiveProvisionedDepartment,
} from "../_core/helpers";

export const departmentsRouter = router({
  listProvisioned: protectedProcedure.query(async ({ ctx }) => {
    const dashboards = await db.listProvisionedDepartmentDashboards({
      includeArchived: ctx.user.role === "admin",
    });
    return ctx.user.role === "admin"
      ? dashboards
      : dashboards.filter(
          (dashboard) =>
            dashboard.active === 1 &&
            dashboard.code === ctx.user.departmentCode,
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
          message:
            "Your account cannot access this department dashboard.",
        });
      }
      const dashboard =
        await db.getProvisionedDepartmentDashboard(input.code);
      if (!dashboard)
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This provisioned department dashboard was not found.",
        });
      if (dashboard.active !== 1 && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "This department workspace is archived and unavailable.",
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const code = normalizeDepartmentCode(input.code);
      if (
        !isValidProvisionedDepartmentCode(code) ||
        isDepartmentCode(code)
      ) {
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
        widgets: z
          .array(z.enum(DEPARTMENT_DASHBOARD_WIDGETS))
          .min(1)
          .max(DEPARTMENT_DASHBOARD_WIDGETS.length),
        metrics: z.tuple([
          z.enum(DEPARTMENT_DASHBOARD_METRICS),
          z.enum(DEPARTMENT_DASHBOARD_METRICS),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !canManageProvisionedDepartmentDashboard(ctx.user, input.code)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only this department's supervisor or an administrator can configure its dashboard.",
        });
      }
      const dashboard =
        await requireActiveProvisionedDepartment(input.code);
      const current = normalizeDepartmentDashboardConfig(
        dashboard.dashboardConfig,
        { name: dashboard.name },
      );
      const updated =
        await db.updateProvisionedDepartmentDashboardConfig({
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
    .input(
      z.object({
        code: z.string().trim().min(3).max(16),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dashboard = await db.getProvisionedDepartmentDashboard(
        input.code,
      );
      if (!dashboard)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This department dashboard was not found.",
        });
      const updated = await db.setProvisionedDepartmentActive(input);
      await db.addUserActivity({
        userId: ctx.user.id,
        action: input.active
          ? "department_reactivated"
          : "department_archived",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "reactivated" : "archived"} the ${dashboard.name} department without deleting its history.`,
      });
      return updated;
    }),

  listWorkflowTemplates: protectedProcedure
    .input(
      z.object({
        departmentCode: z.string().trim().min(3).max(16),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (
        !canAccessProvisionedDepartmentDashboard(
          ctx.user,
          input.departmentCode,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Your account cannot access this department workflow library.",
        });
      }
      const dashboard = await db.getProvisionedDepartmentDashboard(
        input.departmentCode,
      );
      if (!dashboard)
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This department dashboard was not found.",
        });
      if (dashboard.active !== 1 && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This department workspace is archived.",
        });
      }
      return await db.listDepartmentWorkflowTemplates({
        departmentCode: input.departmentCode,
        includeArchived: ctx.user.role === "admin",
      });
    }),

  createWorkflowTemplate: protectedProcedure
    .input(
      z.object({
        departmentCode: z.string().trim().min(3).max(16),
        name: z.string().trim().min(3).max(160),
        description: z.string().trim().min(12).max(800),
        checklist: z.array(workflowChecklistInput).min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !canManageProvisionedDepartmentDashboard(
          ctx.user,
          input.departmentCode,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only this department's supervisor or an administrator can create workflow templates.",
        });
      }
      await requireActiveProvisionedDepartment(input.departmentCode);
      const template = await db.createDepartmentWorkflowTemplate({
        ...input,
        createdBy: ctx.user.id,
      });
      await db.addUserActivity({
        userId: ctx.user.id,
        action: "department_workflow_created",
        detail: `${ctx.user.name ?? ctx.user.email ?? "A department lead"} created the ${template.name} workflow template.`,
      });
      return template;
    }),

  updateWorkflowTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string().trim().min(4).max(64),
        departmentCode: z.string().trim().min(3).max(16),
        name: z.string().trim().min(3).max(160),
        description: z.string().trim().min(12).max(800),
        checklist: z.array(workflowChecklistInput).min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !canManageProvisionedDepartmentDashboard(
          ctx.user,
          input.departmentCode,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only this department's supervisor or an administrator can update workflow templates.",
        });
      }
      await requireActiveProvisionedDepartment(input.departmentCode);
      const templates =
        await db.listDepartmentWorkflowTemplates({
          departmentCode: input.departmentCode,
          includeArchived: true,
        });
      if (!templates.some((template) => template.id === input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "This workflow template was not found in the selected department.",
        });
      }
      return await db.updateDepartmentWorkflowTemplate(input);
    }),

  setWorkflowTemplateActive: adminProcedure
    .input(
      z.object({
        id: z.string().trim().min(4).max(64),
        departmentCode: z.string().trim().min(3).max(16),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const templates =
        await db.listDepartmentWorkflowTemplates({
          departmentCode: input.departmentCode,
          includeArchived: true,
        });
      const template = templates.find(
        (item) => item.id === input.id,
      );
      if (!template)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This workflow template was not found.",
        });
      const updated =
        await db.setDepartmentWorkflowTemplateActive({
          id: input.id,
          active: input.active,
        });
      await db.addUserActivity({
        userId: ctx.user.id,
        action: input.active
          ? "department_workflow_reactivated"
          : "department_workflow_archived",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "restored" : "archived"} the ${template.name} workflow template.`,
      });
      return updated;
    }),

  defaultWorkflowChecklist: protectedProcedure
    .input(
      z.object({
        workstream: z.enum(DEPARTMENT_WORKSTREAMS),
      }),
    )
    .query(({ input }) => defaultWorkflowChecklist(input.workstream)),
});
