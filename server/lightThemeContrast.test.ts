import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("light theme foreground contrast", () => {
  it("defines black primary text and a readable dark-secondary hierarchy", () => {
    const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

    expect(css).toContain("--equipment-ink: #000000");
    expect(css).toContain("--equipment-muted: #2f3742");
    expect(css).toContain("/* High-contrast foreground pass for the light workspace. */");
  });

  it("uses dark lifecycle labels on the light booking dossier instead of legacy light-on-dark colors", () => {
    const source = readFileSync(new URL("../client/src/pages/views/BookingDetail.tsx", import.meta.url), "utf8");

    expect(source).toContain('color: active ? "#000000" : "#27313d"');
    expect(source).toContain('background: active ? "var(--equipment-orange)" : "#edf0f4"');
    expect(source).not.toContain('color: active ? "#f1f1f1" : "#777"');
  });
});
