import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("industrial equipment portal theme", () => {
  it("defines the high-contrast industrial palette and typography", () => {
    expect(css).toContain("--industrial-navy: #070b1d");
    expect(css).toContain("--industrial-yellow: #ffc400");
    expect(css).toContain("--industrial-orange: #f36b13");
    expect(html).toContain("Barlow+Condensed");
  });

  it("keeps the command surfaces, progress system, and sign-in flow within the shared restyle", () => {
    expect(css).toContain(".sidebar {");
    expect(css).toContain(".analytics-progress-board, .reference-progress-board, .client-reference-progress");
    expect(css).toContain(".auth-visual {");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
  });
});
