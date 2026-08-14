/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClientPortal } from "../client/src/pages/Home";

describe("Client Response Portal navigation", () => {
  it("always exposes a header return control and invokes the internal navigation callback", async () => {
    const user = userEvent.setup();
    const onBackToInternal = vi.fn();
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[{ id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Required", required: true }] as any}
      onUpdate={vi.fn()}
      onUploadAll={vi.fn()}
      onBackToInternal={onBackToInternal}
    />);
    await user.click(screen.getByRole("button", { name: /return to operations cockpit/i }));
    expect(onBackToInternal).toHaveBeenCalledOnce();
  });
});
