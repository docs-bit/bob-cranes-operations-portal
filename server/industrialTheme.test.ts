import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("light equipment-operations portal theme", () => {
  it("defines the light equipment palette and clean display typography", () => {
    expect(css).toContain("--equipment-orange: #ff9b3d");
    expect(css).toContain("--equipment-canvas: #f5f6f8");
    expect(css).toContain("--equipment-surface: #ffffff");
    expect(html).toContain("Manrope");
  });

  it("keeps navigation, progress, and sign-in surfaces within the shared light restyle", () => {
    expect(css).toContain(".sidebar {");
    expect(css).toContain(".analytics-progress-board, .reference-progress-board, .client-reference-progress");
    expect(css).toContain(".auth-visual {");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
  });
});
