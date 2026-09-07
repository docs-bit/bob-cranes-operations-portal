import { LOCAL_AUTH_COOKIE_NAME, COOKIE_NAME } from "@shared/const";
import {
  DEPARTMENTS,
  isDepartmentCode,
  roleLabel,
  type DepartmentCode,
} from "@shared/departmentAccess";
import {
  accountStatusActivity,
  profileUpdateActivity,
  signInActivity,
} from "@shared/activityRules";
import { accountUpdateNotification } from "@shared/accountNotifications";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import {
  createLocalSession,
  hashPassword,
  normalizeEmail,
  readLocalSession,
  toSessionUser,
  verifyPassword,
} from "../localAuth";
import { checkPublicMutationRateLimit } from "../_core/rateLimiter";
import { isValidDashboardGreetingTemplate } from "../../shared/dashboardGreeting";
import {
  accountInput,
  registrationInput,
  localSessionMaxAge,
  writeLocalSession,
  clearAuthCookies,
  requireAccountManagementAccess,
  requireActiveProvisionedDepartment,
} from "../_core/helpers";

export const authRouter = router({
  setupStatus: publicProcedure.query(async () => ({
    needsAdminSetup: (await db.countLocalUsers()) === 0,
  })),

  me: publicProcedure.query((opts) =>
    opts.ctx.user ? toSessionUser(opts.ctx.user) : null,
  ),

  updateMyContactDetails: protectedProcedure
    .input(
      z.object({
        companyName: z.string().trim().max(160).optional().or(z.literal("")),
        phone: z.string().trim().max(48).optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.updateUserProfileContactDetails(ctx.user.id, {
        companyName: input.companyName?.trim() || null,
        phone: input.phone?.trim() || null,
      });
      if (!user)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Your profile could not be updated.",
        });
      await db.addUserActivity(
        profileUpdateActivity(
          ctx.user.id,
          ctx.user.name ?? ctx.user.email ?? "Current user",
        ),
      );
      return toSessionUser(user);
    }),

  bootstrapAdmin: publicProcedure
    .input(accountInput)
    .mutation(async ({ ctx, input }) => {
      if (!checkPublicMutationRateLimit(ctx.req, "bootstrap")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many setup attempts. Please try again later.",
        });
      }
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
        mustChangePassword: 1,
      });
      writeLocalSession(ctx, await createLocalSession(user));
      return toSessionUser(user);
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(1).max(160),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!checkPublicMutationRateLimit(ctx.req, "login")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many sign-in attempts. Please try again later.",
        });
      }
      const user = await db.getUserByLocalEmail(
        normalizeEmail(input.email),
      );
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
          user.departmentCode,
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
        .filter(
          (account) => account.departmentCode === ctx.user.departmentCode,
        )
        .map(toSessionUser);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only department supervisors can view their department accounts.",
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
        .optional(),
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
        message: "Only department supervisors can view their department activity.",
      });
    }),

  getSupervisorPermissionAudit: adminProcedure.query(async () => {
    const accounts = await db.listLocalUsers();
    return accounts
      .filter((account) => account.role === "supervisor")
      .map((supervisor) => ({
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.localEmail ?? supervisor.email,
        departmentCode: supervisor.departmentCode,
        isActive: supervisor.isActive,
        createdAt: supervisor.createdAt,
        lastSignedIn: supervisor.lastSignedIn,
        managedUserCount: accounts.filter(
          (account) =>
            account.role === "user" &&
            account.departmentCode === supervisor.departmentCode &&
            account.isActive === 1,
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
            message:
              "Use 3–120 characters and include {name} to personalize the greeting.",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = await db.setDashboardGreetingTemplate(
        input.template.trim(),
        ctx.user.id,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const retentionDays = await db.setActivityRetentionDays(
        input.retentionDays,
        ctx.user.id,
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
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
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
        mustChangePassword: 1,
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
      }),
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
          message: "Administrator accounts are managed by administrators only.",
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
              (department) => department.code === input.departmentCode,
            )?.label ?? input.departmentCode);
      await db.addUserActivity(
        profileUpdateActivity(
          input.id,
          actorLabel,
          nextRoleLabel,
          departmentLabel,
        ),
      );
      const accountNotification = accountUpdateNotification(
        nextRoleLabel,
        departmentLabel,
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
      z.object({ id: z.number().int().positive(), isActive: z.boolean() }),
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
        input.isActive ? 1 : 0,
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
          ctx.user.name ?? ctx.user.email ?? "a department supervisor",
        ),
      );
      return toSessionUser(user);
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1).max(160),
        newPassword: z.string().min(10).max(160),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user || !user.passwordHash)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The account could not be found.",
        });
      const matches = await verifyPassword(
        input.currentPassword,
        user.passwordHash
      );
      if (!matches)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "The current password is incorrect.",
        });
      if (input.currentPassword === input.newPassword)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new password must differ from the current one.",
        });
      const updated = await db.setLocalUserPassword(
        user.id,
        await hashPassword(input.newPassword)
      );
      await db.addUserActivity({
        userId: user.id,
        action: "password_changed",
        detail: `${user.name ?? user.email ?? "Account"} changed their sign-in password.`,
      });
      return toSessionUser(updated!);
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    try {
      const session = await readLocalSession(ctx.req.headers.cookie);
      if (session) await db.revokeSession(session.jti, session.expiresAt);
    } catch {
      // Revocation is best-effort; the cookie is cleared regardless.
    }
    clearAuthCookies(ctx);
    return { success: true } as const;
  }),
});
