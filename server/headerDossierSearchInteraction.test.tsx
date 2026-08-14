/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    operations: {
      getNotifications: { useQuery: () => ({ data: [] }) },
      clearNotifications: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ operations: { getNotifications: { invalidate: vi.fn() } } }),
  },
}));

import { Shell } from "../client/src/pages/Home";

const bookings = [
  { id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", crane: "200T Mobile Crane", site: "Dubai Downtown", stage: "Docs In Progress", priority: "Critical", progress: 72, pm: "Admin", mob: "11 Aug 2026", offHire: "14 Aug 2026", crewIds: [], gearIds: [], trailerIds: [] },
  { id: "BOB Booking-31482", client: "Mak Force Electro Mechanical", project: "ETC Building Package", crane: "350T Mobile Crane", site: "Garhoud", stage: "Documentation Supervisor", priority: "High", progress: 18, pm: "Admin", mob: "12 Aug 2026", offHire: "15 Aug 2026", crewIds: [], gearIds: [], trailerIds: [] },
];

describe("header dossier search interaction", () => {
  it("filters matching dossiers and opens the selected result", async () => {
    const user = userEvent.setup();
    const onOpenDossier = vi.fn();
    render(
      <Shell
        view="overview"
        setView={vi.fn()}
        onBack={vi.fn()}
        onClient={vi.fn()}
        onDepartment={vi.fn()}
        departmentLabel={null}
        bookings={bookings as any}
        onOpenDossier={onOpenDossier}
        user={{ id: 1, name: "Admin", email: "admin@bobcranes.com", role: "admin", departmentCode: "administrator" }}
        onSignOut={async () => undefined}
      >
        <div>Portal content</div>
      </Shell>
    );

    await user.click(screen.getByRole("button", { name: /open booking dossier search/i }));
    const input = screen.getByRole("textbox", { name: /search booking dossiers/i });
    await user.type(input, "gulf");

    const result = screen.getByRole("button", { name: /bob booking-31511/i });
    expect(screen.queryByRole("button", { name: /bob booking-31482/i })).not.toBeInTheDocument();
    await user.click(result);

    expect(onOpenDossier).toHaveBeenCalledWith(expect.objectContaining({ id: "BOB Booking-31511" }));
    expect(screen.queryByRole("dialog", { name: /search booking dossiers/i })).not.toBeInTheDocument();
  });
});
