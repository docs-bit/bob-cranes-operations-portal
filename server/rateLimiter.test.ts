import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  checkPublicMutationRateLimit,
  getRequestRateLimitKey,
  resetRateLimitsForTests,
} from "./_core/rateLimiter";

function requestFrom(address: string): Request {
  return {
    headers: { "x-forwarded-for": address },
    socket: { remoteAddress: address },
  } as unknown as Request;
}

afterEach(() => {
  resetRateLimitsForTests();
});

describe("public mutation rate limits", () => {
  it("uses the first forwarded client address as the anonymous rate-limit key", () => {
    expect(
      getRequestRateLimitKey(requestFrom("198.51.100.7, 10.0.0.1")),
    ).toBe("ip-198.51.100.7");
  });

  it("limits sign-in attempts independently for different client addresses", () => {
    const firstClient = requestFrom("198.51.100.7");
    const secondClient = requestFrom("198.51.100.8");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(checkPublicMutationRateLimit(firstClient, "login")).toBe(true);
    }
    expect(checkPublicMutationRateLimit(firstClient, "login")).toBe(false);
    expect(checkPublicMutationRateLimit(secondClient, "login")).toBe(true);
  });
});
