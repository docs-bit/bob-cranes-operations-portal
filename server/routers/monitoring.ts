import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { checkTelemetryRateLimit, getRequestRateLimitKey } from "../_core/rateLimiter";
import { runtimeErrorFingerprint, sanitizeRuntimeMessage } from "../../shared/runtimeMonitoring";

export const monitoringRouter = router({
  runtimeErrors: router({
    capture: publicProcedure
      .input(z.object({ source: z.enum(["window.error", "unhandledrejection", "react.boundary"]), message: z.string().min(1).max(2000), path: z.string().max(512) }))
      .mutation(async ({ input, ctx }) => {
        if (!checkTelemetryRateLimit(ctx.user ? `user-${ctx.user.id}` : getRequestRateLimitKey(ctx.req))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Telemetry rate limit exceeded. Please try again later." });
        }
        const message = sanitizeRuntimeMessage(input.message);
        const path = sanitizeRuntimeMessage(input.path, 512) || "/";
        return await db.createRuntimeErrorEvent({ source: input.source, message, path, fingerprint: runtimeErrorFingerprint(input.source, message, path), userId: ctx.user?.id ?? null });
      }),
    list: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(250).optional() }).optional()).query(async ({ input }) => await db.listRuntimeErrorEvents(input?.limit ?? 100)),
  }),

  telemetry: router({
    capture: publicProcedure
      .input(z.object({ metricName: z.enum(["LCP", "FID", "CLS", "INP", "TTFB"]), metricValue: z.string().min(1).max(64), path: z.string().max(512) }))
      .mutation(async ({ input, ctx }) => {
        if (!checkTelemetryRateLimit(ctx.user ? `user-${ctx.user.id}` : getRequestRateLimitKey(ctx.req))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Telemetry rate limit exceeded." });
        }
        const path = sanitizeRuntimeMessage(input.path, 512) || "/";
        return await db.createTelemetryEvent({ metricName: input.metricName, metricValue: input.metricValue, path, userId: ctx.user?.id ?? null });
      }),
    list: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ input }) => await db.listTelemetryEvents(input?.limit ?? 250)),
  }),
});
