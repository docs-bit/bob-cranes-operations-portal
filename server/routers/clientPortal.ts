import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const clientPortalRouter = router({
  /** Sales generates a magic-link token for a booking's client contact */
  generateMagicLink: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      email: z.string().email(),
      createdBy: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const record = await db.createClientPortalToken({
        bookingId: input.bookingId,
        token,
        channel: "magic_link",
        otp: null,
        email: input.email,
        expiresAt,
        createdBy: input.createdBy ?? null,
      });

      return {
        token,
        url: `/client/verify/${token}`,
        expiresAt,
        bookingId: input.bookingId,
      };
    }),

  /** Sales generates an OTP fallback for the same booking */
  generateOtp: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      email: z.string().email(),
      createdBy: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });

      const otp = generateOtp();
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.createClientPortalToken({
        bookingId: input.bookingId,
        token,
        channel: "otp",
        otp,
        email: input.email,
        expiresAt,
        createdBy: input.createdBy ?? null,
      });

      return { otp, bookingId: input.bookingId, expiresAt };
    }),

  /** Client verifies a magic-link token — returns a session token */
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const record = await db.verifyClientPortalToken(input.token);
      if (!record) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired link." });

      const booking = await db.getBookingById(record.bookingId);
      return {
        bookingId: record.bookingId,
        clientEmail: record.email,
        clientName: booking?.clientContactName ?? "Client",
        booking,
      };
    }),

  /** Client verifies an OTP code — returns a session token */
  verifyOtp: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      otp: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const record = await db.verifyClientPortalOtp(input.bookingId, input.otp);
      if (!record) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP." });

      const booking = await db.getBookingById(record.bookingId);
      return {
        bookingId: record.bookingId,
        clientEmail: record.email,
        clientName: booking?.clientContactName ?? "Client",
        booking,
      };
    }),

  /** Client portal: get booking summary */
  getBookingSummary: publicProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      return booking;
    }),

  /** Client portal: get documents for a booking */
  getDocuments: publicProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      return db.getBookingDocuments(input.bookingId);
    }),

  /** Client portal: get chat messages */
  getChatMessages: publicProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      return db.getBookingChatMessages(input.bookingId);
    }),

  /** Client portal: send a chat message */
  sendChatMessage: publicProcedure
    .input(z.object({
      bookingId: z.string(),
      sender: z.string(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input }) => {
      return db.addClientChatMessage(input);
    }),
});
