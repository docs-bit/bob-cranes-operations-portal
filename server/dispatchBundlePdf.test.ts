/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDispatchBundlePdf } from "../client/src/lib/dispatchBundlePdf";

describe("dispatch bundle PDF download", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a branded PDF bundle and triggers a semantic dossier filename download", async () => {
    const createObjectUrl = vi.fn(() => "blob:dispatch-bundle");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectUrl,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectUrl,
      configurable: true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const progress = vi.fn();
    await expect(
      generateDispatchBundlePdf({
        booking: {
          id: "BOB Booking-31511",
          client: "Gulf Contracting",
          project: "Downtown lift",
          crane: "200T Mobile Crane",
          site: "Dubai Downtown",
          mob: "11 Aug 2026",
          offHire: "14 Aug 2026",
          pm: "Nishanth",
          priority: "Critical",
        },
        documents: [
          {
            id: "doc-1",
            departmentCode: "DOC",
            name: "Signed method statement",
            state: "Approved",
            required: true,
          },
        ],
        crew: [
          {
            name: "Vineeth Vijayan",
            role: "Crane Operator",
            cert: "Compliant",
          },
        ],
        generatedBy: "Administrator",
        onProgress: progress,
      })
    ).resolves.toBe("BOB-Booking-31511-dispatch-bundle.pdf");

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:dispatch-bundle");
    expect(progress).toHaveBeenCalledWith(100, "Dispatch bundle ready");
  });
});
