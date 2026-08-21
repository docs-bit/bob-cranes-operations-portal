import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/views/Shell.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("header dossier search", () => {
  it("opens a real search dialog and filters across meaningful booking fields", () => {
    expect(source).toContain("const [dossierSearchOpen, setDossierSearchOpen] = useState(false)");
    expect(source).toContain("booking.client,");
    expect(source).toContain("booking.project,");
    expect(source).toContain("booking.crane,");
    expect(source).toContain('aria-label="Search booking dossiers"');
    expect(source).not.toContain('className="search-pill search-launcher"\n              onClick={() => setView("bookings")}');
  });

  it("opens a matching dossier from a result and provides responsive dialog styling", () => {
    expect(source).toContain("onOpenDossier(booking)");
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(css).toContain(".header-dossier-search {");
    expect(css).toContain(".header-dossier-search-result {");
  });
});
