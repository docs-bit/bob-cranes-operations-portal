import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { ENV } from "../_core/env";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";

async function issueClientSession(bookingId: string, email: string, clientName: string) {
  return new SignJWT({ type: "client_portal", bookingId, email, clientName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bob-cranes-client-portal")
    .setAudience("bob-cranes-client-portal")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

async function validateClientSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), {
      issuer: "bob-cranes-client-portal",
      audience: "bob-cranes-client-portal",
    });
    if (payload.type !== "client_portal" || typeof payload.bookingId !== "string") return null;
    return payload as { bookingId: string; email: string; clientName: string };
  } catch {
    return null;
  }
}

async function validateAndScope(clientSession: string, bookingId: string) {
  const payload = await validateClientSession(clientSession);
  if (!payload || payload.bookingId !== bookingId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied for this booking." });
  }
  return payload;
}

function requireAdminOrSupervisor(ctx: { user: { role: string } | null }) {
  if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "supervisor")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only admins and supervisors can generate client portal links." });
  }
}

export const clientPortalRouter = router({
  generateMagicLink: protectedProcedure
    .input(z.object({
      bookingId: z.string(),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminOrSupervisor(ctx);
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.createClientPortalToken({
        bookingId: input.bookingId,
        token,
        channel: "magic_link",
        otp: null,
        email: input.email,
        expiresAt,
        createdBy: ctx.user.id,
      });

      return {
        token,
        url: `/client/verify/${token}`,
        expiresAt,
        bookingId: input.bookingId,
      };
    }),

  generateOtp: protectedProcedure
    .input(z.object({
      bookingId: z.string(),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminOrSupervisor(ctx);
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });

      const otp = String(crypto.randomInt(100000, 1000000));
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.createClientPortalToken({
        bookingId: input.bookingId,
        token,
        channel: "otp",
        otp,
        email: input.email,
        expiresAt,
        createdBy: ctx.user.id,
      });

      return { otp, bookingId: input.bookingId, expiresAt };
    }),

  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const record = await db.verifyClientPortalToken(input.token);
      if (!record) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired link." });

      const booking = await db.getBookingById(record.bookingId);
      const clientSession = await issueClientSession(
        record.bookingId,
        record.email,
        booking?.clientContactName ?? "Client",
      );

      return {
        clientSession,
        bookingId: record.bookingId,
        clientEmail: record.email,
        clientName: booking?.clientContactName ?? "Client",
      };
    }),

  verifyOtp: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      otp: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const record = await db.verifyClientPortalOtp(input.bookingId, input.otp);
      if (!record) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP." });

      const booking = await db.getBookingById(record.bookingId);
      const clientSession = await issueClientSession(
        record.bookingId,
        record.email,
        booking?.clientContactName ?? "Client",
      );

      return {
        clientSession,
        bookingId: record.bookingId,
        clientEmail: record.email,
        clientName: booking?.clientContactName ?? "Client",
      };
    }),

  getBookingSummary: publicProcedure
    .input(z.object({ bookingId: z.string(), clientSession: z.string() }))
    .query(async ({ input }) => {
      await validateAndScope(input.clientSession, input.bookingId);
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      return booking;
    }),

  getDocuments: publicProcedure
    .input(z.object({ bookingId: z.string(), clientSession: z.string() }))
    .query(async ({ input }) => {
      await validateAndScope(input.clientSession, input.bookingId);
      return db.getBookingDocuments(input.bookingId);
    }),

  getChatMessages: publicProcedure
    .input(z.object({ bookingId: z.string(), clientSession: z.string() }))
    .query(async ({ input }) => {
      await validateAndScope(input.clientSession, input.bookingId);
      return db.getBookingChatMessages(input.bookingId);
    }),

  sendChatMessage: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      clientSession: z.string(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input }) => {
      const payload = await validateAndScope(input.clientSession, input.bookingId);
      return db.addClientChatMessage({
        bookingId: input.bookingId,
        sender: payload.clientName,
        body: input.body,
      });
    }),
});
