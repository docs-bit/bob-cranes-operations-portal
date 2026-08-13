import { LOCAL_AUTH_COOKIE_NAME, COOKIE_NAME } from "@shared/const";
import { canAccessDepartment, isDepartmentCode, type DepartmentCode } from "@shared/departmentAccess";
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

const localSessionMaxAge = 12 * 60 * 60 * 1000;

function writeLocalSession(ctx: { req: any; res: any }, token: string) {
  ctx.res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: localSessionMaxAge,
  });
}

function requireDepartmentAccess(user: { role: "admin" | "user"; departmentCode?: string | null }, code: DepartmentCode) {
  if (!canAccessDepartment(user, code)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your department account cannot access this workspace." });
  }
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
        writeLocalSession(ctx, await createLocalSession(user));
        return toSessionUser({ ...user, lastSignedIn: new Date() });
      }),
    listUsers: adminProcedure.query(async () => (await db.listLocalUsers()).map(toSessionUser)),
    registerUser: adminProcedure.input(accountInput).mutation(async ({ input }) => {
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
        role: "user",
      });
      return toSessionUser(user);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, expires: new Date(0) });
      ctx.res.clearCookie(LOCAL_AUTH_COOKIE_NAME, { ...cookieOptions, expires: new Date(0) });
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
        return await db.getNotifications(ctx.user.role === "admin" ? input?.departmentCode : ctx.user.departmentCode ?? undefined);
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
