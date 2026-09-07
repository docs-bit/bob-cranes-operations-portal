import { createHash, randomBytes } from "node:crypto";

/**
 * Password-reset tokens (PRD v2 §4.4: /forgot-password, /reset-password/:token).
 * 32-byte URL-safe secrets, SHA-256 hashed at rest, 30-minute TTL,
 * single-use. Server-only module: `node:crypto` does not run in browsers.
 */

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function resetTokenExpiry(nowMs: number = Date.now()): Date {
  return new Date(nowMs + RESET_TOKEN_TTL_MS);
}

export function isResetTokenLive(
  row: {
    expiresAt: Date | string;
    usedAt: Date | string | null;
  },
  nowMs: number = Date.now()
): boolean {
  if (row.usedAt) return false;
  return new Date(row.expiresAt).getTime() > nowMs;
}
