import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const miscRouter = router({
  filterPresets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const presets = await db.listClientFilterPresets(ctx.user.id);
      return presets.map(p => ({
        ...p,
        tags: JSON.parse(p.tagsJson || "[]") as string[],
      }));
    }),
    save: protectedProcedure
      .input(
        z.object({
          id: z.string().trim().max(64).optional(),
          name: z.string().trim().min(1).max(128),
          category: z.string().trim().max(128),
          tags: z.array(z.string().trim().max(128)),
          search: z.string().trim().max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const saved = await db.saveClientFilterPreset({
          userId: ctx.user.id,
          id: input.id,
          name: input.name,
          category: input.category,
          tags: input.tags,
          search: input.search,
        });
        return {
          ...saved,
          tags: JSON.parse(saved?.tagsJson || "[]") as string[],
        };
      }),
    delete: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteClientFilterPreset(ctx.user.id, input.name);
        return { success: true };
      }),
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
});
