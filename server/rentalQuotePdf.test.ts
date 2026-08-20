/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOB_FULL_LOGO_DOCUMENT_ASSET } from "../client/src/lib/pdfBrand";
import { generateRentalQuotePdf } from "../client/src/lib/rentalQuotePdf";

const onePixelPng = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLBFwAAAABJRU5ErkJggg=="),
  character => character.charCodeAt(0)
);

describe("rental quote brief PDF download", () => {
  afterEach(() => vi.restoreAllMocks());

  it("embeds the approved full BOB logo and downloads a non-commercial quote brief", async () => {
    const createObjectUrl = vi.fn(() => "blob:rental-quote-brief");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectUrl, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchLogo = vi.fn(async () => new Response(onePixelPng, { status: 200 }));
    vi.stubGlobal("fetch", fetchLogo);

    await expect(generateRentalQuotePdf({
      enquiry: {
        id: "rental-enquiry-qa",
        contactName: "Amina Hassan",
        companyName: "Gulf Project Works",
        email: "amina@example.com",
        phone: "+971501234567",
        projectLocation: "Dubai Industrial City",
        equipmentInterest: "Managed lifting service",
        liftDetails: "Planned lifting support for controlled maintenance mobilisation.",
        createdAt: "2026-08-15T09:00:00.000Z",
      },
      generatedBy: "Sales workspace",
    })).resolves.toBe("rental-enquiry-qa-rental-quote-brief.pdf");

    expect(fetchLogo).toHaveBeenCalledWith(BOB_FULL_LOGO_DOCUMENT_ASSET);
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
});
