import { describe, expect, it } from "vitest";
import {
  generatePortalToken,
  hashPortalToken,
  isPortalTokenLive,
  portalTokenExpiry,
} from "./portalTokens";

describe("portalTokens", () => {
  it("generates 32-byte URL-safe tokens", () => {
    const first = generatePortalToken();
    const second = generatePortalToken();
    expect(first).toMatch(/^bob_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes without exposing the raw token", () => {
    const token = generatePortalToken();
    const hash = hashPortalToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashPortalToken(token)).toBe(hash);
  });

  it("expires 24 hours after issuance", () => {
    const now = Date.parse("2026-09-05T10:00:00Z");
    expect(portalTokenExpiry(now).getTime() - now).toBe(24 * 60 * 60 * 1000);
  });

  it("rejects expired and revoked tokens", () => {
    const now = Date.parse("2026-09-05T10:00:00Z");
    expect(
      isPortalTokenLive(
        { expiresAt: new Date(now + 1000), revokedAt: null },
        now
      )
    ).toBe(true);
    expect(
      isPortalTokenLive(
        { expiresAt: new Date(now - 1000), revokedAt: null },
        now
      )
    ).toBe(false);
    expect(
      isPortalTokenLive(
        { expiresAt: new Date(now + 3_600_000), revokedAt: new Date(now) },
        now
      )
    ).toBe(false);
  });
});
