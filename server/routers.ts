import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

db.seedInitialDataIfNeeded().catch(console.error);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  operations: router({
    seed: publicProcedure.mutation(async () => {
      await db.seedInitialDataIfNeeded();
      return { success: true };
    }),

    getBookings: publicProcedure.query(async () => {
      await db.seedInitialDataIfNeeded();
      return await db.getAllBookings();
    }),

    getBooking: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return await db.getBookingById(input.id);
      }),

    createBooking: publicProcedure
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
      .mutation(async ({ input }) => {
        return await db.createBooking(input);
      }),

    updateStage: publicProcedure
      .input(z.object({ id: z.string(), stage: z.string() }))
      .mutation(async ({ input }) => {
        return await db.updateBookingStage(input.id, input.stage);
      }),

    updateAssignment: publicProcedure
      .input(z.object({
        id: z.string(),
        craneId: z.string().optional(),
        crewIds: z.array(z.string()).optional(),
        gearIds: z.array(z.string()).optional(),
        trailerIds: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateBookingAssignment(input.id, input);
      }),

    getEquipment: publicProcedure.query(async () => {
      await db.seedInitialDataIfNeeded();
      return await db.getAllEquipment();
    }),

    getCrew: publicProcedure.query(async () => {
      await db.seedInitialDataIfNeeded();
      return await db.getAllCrew();
    }),

    getGears: publicProcedure.query(async () => {
      await db.seedInitialDataIfNeeded();
      return await db.getAllLiftingGears();
    }),

    getTrailers: publicProcedure.query(async () => {
      await db.seedInitialDataIfNeeded();
      return await db.getAllTrailers();
    }),

    getDocuments: publicProcedure
      .input(z.object({ bookingId: z.string() }))
      .query(async ({ input }) => {
        return await db.getDocumentsForBooking(input.bookingId);
      }),

    upsertDocument: publicProcedure
      .input(z.object({
        id: z.string(),
        bookingId: z.string(),
        departmentCode: z.string(),
        name: z.string(),
        state: z.string(),
        expiryDate: z.string().optional(),
        required: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.upsertDocument(input);
      }),

    getChat: publicProcedure
      .input(z.object({ bookingId: z.string() }))
      .query(async ({ input }) => {
        return await db.getChatForBooking(input.bookingId);
      }),

    addChat: publicProcedure
      .input(z.object({
        id: z.string(),
        bookingId: z.string(),
        team: z.string(),
        sender: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.addChatMessage(input);
      }),

    getNotifications: publicProcedure
      .input(z.object({ departmentCode: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getNotifications(input?.departmentCode);
      }),

    addNotification: publicProcedure
      .input(z.object({
        id: z.string(),
        departmentCode: z.string(),
        title: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.addNotification(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
