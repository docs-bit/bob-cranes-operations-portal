import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logoPath = "/manus-storage/bob-cranes-mark_c80bfee2.png";

describe("supplied BOB Cranes logo integration", () => {
  it("uses the hosted logo in authenticated, client, sign-in, and loading brand surfaces", () => {
    const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const login = readFileSync(new URL("../client/src/pages/Login.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

    expect(home.match(new RegExp(logoPath.replace(/[/.]/g, "\\$&"), "g"))?.length).toBe(2);
    expect(login).toContain(logoPath);
    expect(app).toContain(logoPath);
    expect(home).toContain('alt="BOB Cranes"');
  });

  it("defines responsive containment styles for the supplied logo mark", () => {
    const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

    expect(css).toContain(".brand-mark.brand-logo");
    expect(css).toContain(".auth-brand-mark.auth-brand-logo");
    expect(css).toContain("object-fit: contain");
  });
});
