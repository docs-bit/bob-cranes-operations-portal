import { describe, expect, it } from "vitest";
import {
  generateResetToken,
  hashResetToken,
  isResetTokenLive,
  resetTokenExpiry,
} from "./passwordResetTokens";

describe("passwordResetTokens", () => {
  it("generates 32-byte URL-safe secrets", () => {
    const first = generateResetToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(generateResetToken());
  });

  it("hashes without exposing the raw token", () => {
    const token = generateResetToken();
    const hash = hashResetToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashResetToken(token)).toBe(hash);
  });

  it("expires after 30 minutes", () => {
    const now = Date.parse("2026-09-07T10:00:00Z");
    expect(resetTokenExpiry(now).getTime() - now).toBe(30 * 60 * 1000);
  });

  it("rejects used and expired tokens", () => {
    const now = Date.parse("2026-09-07T10:00:00Z");
    expect(
      isResetTokenLive(
        { expiresAt: new Date(now + 1000), usedAt: null },
        now
      )
    ).toBe(true);
    expect(
      isResetTokenLive(
        { expiresAt: new Date(now - 1000), usedAt: null },
        now
      )
    ).toBe(false);
    expect(
      isResetTokenLive(
        { expiresAt: new Date(now + 600_000), usedAt: new Date(now) },
        now
      )
    ).toBe(false);
  });
});
