import { LOCAL_AUTH_COOKIE_NAME, COOKIE_NAME } from "@shared/const";
import { canAccessDepartment, canManageDepartmentUsers, DEPARTMENTS, isDepartmentCode, roleLabel, type DepartmentCode, type PortalRole } from "@shared/departmentAccess";
import { BOOKING_STAGES, STAGE_ROLES, transitionBooking, type BookingStage } from "@shared/bookingRules";
import { accountStatusActivity, profileUpdateActivity, signInActivity } from "@shared/activityRules";
import { accountUpdateNotification } from "@shared/accountNotifications";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { createLocalSession, hashPassword, normalizeEmail, toSessionUser, verifyPassword } from "./localAuth";

db.seedInitialDataIfNeeded().catch(console.error);

const accountInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(10).max(160),
  departmentCode: z.string().refine(isDepartmentCode, "Choose a valid department."),
});

const registrationInput = accountInput.extend({ role: z.enum(["user", "supervisor"]).default("user") });

const localSessionMaxAge = 12 * 60 * 60 * 1000;
const lifecycleStageDepartment: Partial<Record<BookingStage, DepartmentCode>> = {
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

function requireDepartmentAccess(user: { role: PortalRole; departmentCode?: string | null }, code: DepartmentCode) {
  if (!canAccessDepartment(user, code)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your department account cannot access this workspace." });
  }
}

function requireAccountManagementAccess(user: { role: PortalRole; departmentCode?: string | null }, targetDepartment?: string | null) {
  if (user.role === "admin") return;
  if (user.role === "supervisor" && user.departmentCode && targetDepartment === user.departmentCode) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator or the department supervisor can manage this account." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    setupStatus: publicProcedure.query(async () => ({ needsAdminSetup: (await db.countLocalUsers()) === 0 })),
    me: publicProcedure.query(opts => (opts.ctx.user ? toSessionUser(opts.ctx.user) : null)),
    bootstrapAdmin: publicProcedure.input(accountInput).mutation(async ({ ctx, input }) => {
      if ((await db.countLocalUsers()) > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An administrator account is already configured." });
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
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(160) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByLocalEmail(normalizeEmail(input.email));
        const passwordMatches = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
        if (!user || user.isActive !== 1 || !passwordMatches) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        await db.updateUserLastSignedIn(user.id);
        await db.addUserActivity(signInActivity(user.id));
        writeLocalSession(ctx, await createLocalSession(user));
        return toSessionUser({ ...user, lastSignedIn: new Date() });
      }),
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return (await db.listLocalUsers()).map(toSessionUser);
      if (ctx.user.role === "supervisor" && ctx.user.departmentCode) return (await db.listLocalUsers()).filter((account) => account.departmentCode === ctx.user.departmentCode).map(toSessionUser);
      throw new TRPCError({ code: "FORBIDDEN", message: "Only department supervisors can view their department accounts." });
    }),
    listActivity: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return await db.listRecentUserActivity();
      if (ctx.user.role === "supervisor" && ctx.user.departmentCode) return await db.listRecentUserActivity(40, ctx.user.departmentCode);
      throw new TRPCError({ code: "FORBIDDEN", message: "Only department supervisors can view their department activity." });
    }),
    registerUser: protectedProcedure.input(registrationInput).mutation(async ({ ctx, input }) => {
      const targetRole = input.role;
      if (targetRole === "supervisor" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can add a department supervisor." });
      }
      requireAccountManagementAccess(ctx.user, input.departmentCode);
      if (input.departmentCode === "administrator") throw new TRPCError({ code: "BAD_REQUEST", message: "Use the administrator setup flow for the administrator department." });
      const email = normalizeEmail(input.email);
      if (await db.getUserByLocalEmail(email)) {
        throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email address." });
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
    updateUser: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(320),
      departmentCode: z.string().refine(isDepartmentCode, "Choose a valid department."),
      role: z.enum(["user", "supervisor", "admin"]),
      password: z.string().min(10).max(160).optional().or(z.literal("")),
    })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot edit your own account here." });
      if (input.role === "admin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can assign administrator access." });
      const existing = await db.getUserById(input.id);
      if (!existing?.localEmail) throw new TRPCError({ code: "NOT_FOUND", message: "That local account could not be found." });
      requireAccountManagementAccess(ctx.user, existing.departmentCode);
      if (ctx.user.role === "supervisor" && (existing.departmentCode !== input.departmentCode || input.role !== "user")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Supervisors can only edit users in their own department." });
      }
      if (existing.role === "admin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator accounts are managed by administrators only." });
      const email = normalizeEmail(input.email);
      const emailOwner = await db.getUserByLocalEmail(email);
      if (emailOwner && emailOwner.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email address." });
      const departmentCode = input.role === "admin" ? "administrator" : input.departmentCode;
      const user = await db.updateLocalUser(input.id, {
        name: input.name,
        email,
        departmentCode,
        role: input.role,
        supervisorId: input.role === "user" && ctx.user.role === "supervisor" ? ctx.user.id : input.role === "admin" || input.role === "supervisor" ? null : existing.supervisorId,
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "The account could not be updated." });
      const actorLabel = ctx.user.name ?? ctx.user.email ?? "an administrator";
      const nextRoleLabel = roleLabel(input.role);
      const departmentLabel = input.role === "admin" ? "Administrator" : DEPARTMENTS.find((department) => department.code === input.departmentCode)?.label ?? input.departmentCode;
      await db.addUserActivity(profileUpdateActivity(input.id, actorLabel, nextRoleLabel, departmentLabel));
      const accountNotification = accountUpdateNotification(nextRoleLabel, departmentLabel);
      await db.addNotification({
        id: `account-update-${user.id}-${Date.now()}`,
        userId: user.id,
        departmentCode: user.departmentCode ?? input.departmentCode,
        ...accountNotification,
      });
      return toSessionUser(user);
    }),
    setUserActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot deactivate your own account." });
      const existing = await db.getUserById(input.id);
      if (!existing?.localEmail) throw new TRPCError({ code: "NOT_FOUND", message: "That local account could not be found." });
      if (existing.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator accounts cannot be deactivated from this workspace." });
      requireAccountManagementAccess(ctx.user, existing.departmentCode);
      if (ctx.user.role === "supervisor" && existing.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "Supervisors can only manage users in their own department." });
      const user = await db.setLocalUserActive(input.id, input.isActive ? 1 : 0);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "The account status could not be updated." });
      await db.addUserActivity(accountStatusActivity(input.id, input.isActive, ctx.user.name ?? ctx.user.email ?? "a department supervisor"));
      return toSessionUser(user);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.clearCookie(LOCAL_AUTH_COOKIE_NAME, cookieOptions);
      return { success: true } as const;
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
      .input(z.object({
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
      }))
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
      .input(z.object({ id: z.string(), currentStage: z.enum(BOOKING_STAGES), nextStage: z.enum(BOOKING_STAGES) }))
      .mutation(async ({ ctx, input }) => {
        const currentStage = input.currentStage as BookingStage;
        const nextStage = input.nextStage as BookingStage;
        const department = lifecycleStageDepartment[nextStage];
        if (!department) throw new TRPCError({ code: "BAD_REQUEST", message: "That lifecycle stage has no owning department." });
        requireDepartmentAccess(ctx.user, department);
        const booking = await db.getBookingById(input.id);
        let transition;
        try {
          transition = transitionBooking(currentStage, nextStage, STAGE_ROLES[nextStage]);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The lifecycle transition is not valid." });
        }
        const updated = booking ? await db.updateBookingStage(input.id, transition.stage) : { id: input.id, stage: transition.stage };
        const timestamp = Date.now();
        await Promise.all(transition.notifications.map((notification, index) => db.addNotification({
          id: `lifecycle-${input.id}-${timestamp}-${index}`,
          userId: null,
          departmentCode: lifecycleNotificationDepartment[notification.departmentCode] ?? department,
          title: notification.title,
          body: `${notification.body} · ${input.id}`,
        })));
        return { booking: updated, stage: transition.stage, notifications: transition.notifications };
      }),

    completeBookingWorkstream: protectedProcedure
      .input(z.object({ id: z.string(), workstream: z.enum(["MNT", "HSE", "ACC", "HR", "TRN"]), stage: z.enum(BOOKING_STAGES) }))
      .mutation(async ({ ctx, input }) => {
        const workstreamDepartment: Record<string, DepartmentCode> = { MNT: "maintenance", HSE: "hse", ACC: "accounts", HR: "hr", TRN: "transportation" };
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
        return { id: input.id, workstream: input.workstream, stage: input.stage, departmentCode: department };
      }),

    updateAssignment: protectedProcedure
      .input(z.object({
        id: z.string(),
        craneId: z.string().optional(),
        crewIds: z.array(z.string()).optional(),
        gearIds: z.array(z.string()).optional(),
        trailerIds: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        requireDepartmentAccess(ctx.user, "documentation");
        return await db.updateBookingAssignment(input.id, input);
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
      .input(z.object({
        id: z.string(),
        bookingId: z.string(),
        departmentCode: z.string(),
        name: z.string(),
        state: z.string(),
        expiryDate: z.string().optional(),
        required: z.number(),
      }))
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
      .input(z.object({
        id: z.string(),
        bookingId: z.string(),
        team: z.string(),
        sender: z.string(),
        body: z.string(),
      }))
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
        const expectedTeam = ctx.user.role === "admin" ? input.team : teamByDepartment[ctx.user.departmentCode as DepartmentCode];
        if (ctx.user.role !== "admin" && (!expectedTeam || input.team !== expectedTeam)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your department account cannot post as another team." });
        }
        return await db.addChatMessage({
          ...input,
          team: expectedTeam ?? input.team,
          sender: ctx.user.role === "admin" ? input.sender : ctx.user.name ?? ctx.user.email ?? "Department user",
        });
      }),

    getNotifications: protectedProcedure
      .input(z.object({ departmentCode: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && input?.departmentCode && input.departmentCode !== ctx.user.departmentCode) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your department account cannot access these notifications." });
        }
        return await db.getNotifications({
          departmentCode: ctx.user.role === "admin" ? input?.departmentCode : ctx.user.departmentCode ?? undefined,
          userId: ctx.user.id,
        });
      }),

    addNotification: protectedProcedure
      .input(z.object({
        id: z.string(),
        departmentCode: z.string().refine(isDepartmentCode, "Choose a valid department."),
        title: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") requireDepartmentAccess(ctx.user, input.departmentCode as DepartmentCode);
        return await db.addNotification(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
