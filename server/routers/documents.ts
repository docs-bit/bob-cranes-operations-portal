import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { requireDocumentTaxonomyManager } from "../_core/helpers";

export const documentsRouter = router({
  getTaxonomy: protectedProcedure.query(async () => {
    await db.seedDocumentTaxonomy();
    return await db.listDocumentTaxonomy();
  }),

  getMetadata: protectedProcedure
    .input(z.object({ bookingId: z.string().trim().min(1).max(64) }))
    .query(async ({ input }) => await db.listPersistedDocumentMetadata(input.bookingId)),

  saveMetadata: protectedProcedure
    .input(
      z.object({
        id: z.string().trim().min(1).max(64),
        bookingId: z.string().trim().min(1).max(64),
        name: z.string().trim().min(1).max(255),
        departmentCode: z.string().trim().min(1).max(32),
        state: z.string().trim().min(1).max(64),
        category: z.string().trim().max(128).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
        fileName: z.string().trim().max(255).nullable().optional(),
        fileType: z.string().trim().max(128).nullable().optional(),
        fileSize: z.number().int().nonnegative().max(25 * 1024 * 1024).nullable().optional(),
        storageKey: z.string().trim().min(1).max(128).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => await db.upsertPersistedDocumentMetadata({ ...input, uploadedBy: ctx.user.id })),

  deleteMetadata: protectedProcedure
    .input(z.object({ id: z.string().trim().min(1).max(64) }))
    .mutation(async ({ input }) => await db.deletePersistedDocumentMetadata(input.id)),

  createCategory: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(128), description: z.string().trim().max(600).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.createDocumentCategory({ ...input, createdBy: ctx.user.id });
    }),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(128), description: z.string().trim().max(600).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.updateDocumentCategory(input);
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.deleteDocumentCategory(input.id);
    }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(64), categoryId: z.number().int().positive().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.createDocumentTag({ ...input, createdBy: ctx.user.id });
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(64), categoryId: z.number().int().positive().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.updateDocumentTag(input);
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDocumentTaxonomyManager(ctx.user);
      return await db.deleteDocumentTag(input.id);
    }),
});
