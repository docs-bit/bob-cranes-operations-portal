import { createHash, randomBytes } from "node:crypto";

/**
 * Client-portal magic-link tokens (PRD v3.0 §10, v2 §8).
 * Tokens are 32-byte URL-safe secrets shown to the client exactly once.
 * Only the SHA-256 hash is persisted; raw tokens never touch the database.
 * Server-only module: `node:crypto` does not run in browsers.
 */

export const PORTAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function generatePortalToken(): string {
  return `bob_${randomBytes(32).toString("base64url")}`;
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function portalTokenExpiry(nowMs: number = Date.now()): Date {
  return new Date(nowMs + PORTAL_TOKEN_TTL_MS);
}

export function isPortalTokenLive(
  row: { expiresAt: Date | string; revokedAt: Date | string | null },
  nowMs: number = Date.now()
): boolean {
  if (row.revokedAt) return false;
  return new Date(row.expiresAt).getTime() > nowMs;
}
