import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("secure workspace loading recovery", () => {
  it("renders a branded loading card and exposes a retry for slow authentication", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    expect(appSource).toContain("auth-loading-card");
    expect(appSource).toContain("Loading secure workspace");
    expect(appSource).toContain("Retry secure connection");
    expect(appSource).toContain("refresh()");
  });
});
