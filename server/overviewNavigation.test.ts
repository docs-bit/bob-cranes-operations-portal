import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Operations Cockpit header navigation", () => {
  it("omits the Back control only on the overview while preserving it for other views", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('{view !== "overview" && (');
    expect(source).toContain('className="back-button"');
    expect(source).not.toContain('disabled={view === "overview"}');
  });

  it("uses the requested neutral Hello greeting on the Operations Cockpit", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('title="Hello, Admin"');
    expect(source).not.toContain('title="Good morning, Admin"');
  });
});
