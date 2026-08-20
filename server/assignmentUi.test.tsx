/** @vitest-environment jsdom */
import React, { useState } from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CrewView } from "../client/src/pages/Home";
import type { EmployeeAllocation } from "../shared/bookingConflictRules";
import { ATTENDANCE_CREW_ROSTER } from "../shared/attendanceCrewRoster";

const saveCrewAllocations = vi.hoisted(() => vi.fn(async ({ crewName, crewId, bookingIds }: { crewName: string; crewId: string; bookingIds: string[] }) => ({
  allocations: bookingIds.map((bookingId) => ({ crewName, crewId, bookingId })),
})));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      saveCrewAllocations: {
        useMutation: () => ({ mutateAsync: saveCrewAllocations, isPending: false }),
      },
    },
  },
}));

const booking = {
  id: "BOB Booking-31511",
  client: "Gulf Contracting LLC",
  project: "Downtown Tower Lift",
  crane: "200T Mobile Crane",
  site: "Dubai Downtown",
  stage: "Docs In Progress" as const,
  priority: "Critical" as const,
  progress: 72,
  mob: "11 Aug 2026",
  offHire: "18 Aug 2026",
  pm: "Rohan Mathew",
  crew: "4 assigned",
};

function AssignmentHarness() {
  const [allocations, setAllocations] = useState<EmployeeAllocation[]>([]);
  const [feedback, setFeedback] = useState("");
  return <>
    <CrewView
      bookings={[booking]}
      allocations={allocations}
      setAllocations={setAllocations}
      focusedBookingId={booking.id}
      onAddWorkman={() => undefined}
      onAllocationSaved={({ bookingId, employeeName, action }) => setFeedback(`${employeeName}|${action}|${bookingId}`)}
    />
    <output data-testid="assignment-feedback">{feedback}</output>
  </>;
}

describe("Assignment edit UI flow", () => {
  it("clicks Assign and Remove, persists the focused dossier, and reports the updated state", async () => {
    saveCrewAllocations.mockClear();
    const user = userEvent.setup();
    render(<AssignmentHarness />);

    const assign = (await screen.findAllByRole("button", { name: "Assign selected crew" })).find(
      button => !button.hasAttribute("disabled")
    );
    expect(assign).toBeDefined();
    await user.click(assign!);

    await waitFor(() => expect(screen.getByRole("button", { name: "Remove selected crew" })).toBeInTheDocument());
    expect(saveCrewAllocations).toHaveBeenCalledWith({
      crewId: "cr-1",
      crewName: "Vineeth Vijayan",
      bookingIds: ["BOB-59116"],
    });
    expect(screen.getByTestId("assignment-feedback")).toHaveTextContent("Vineeth Vijayan|saved|BOB Booking-31511");

    await user.click(screen.getByRole("button", { name: "Remove selected crew" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Assign selected crew" }).some(button => !button.hasAttribute("disabled"))).toBe(true));
    expect(saveCrewAllocations).toHaveBeenCalledTimes(2);
    expect(saveCrewAllocations).toHaveBeenLastCalledWith({
      crewId: "cr-1",
      crewName: "Vineeth Vijayan",
      bookingIds: [],
    });
    expect(screen.getByTestId("assignment-feedback")).toHaveTextContent("Vineeth Vijayan|removed|BOB Booking-31511");
  });

  it("surfaces the attendance-backed roster and hydrates a persisted attendance employee allocation", async () => {
    const attendanceEmployee = ATTENDANCE_CREW_ROSTER.find((employee) => employee.availability === "On Leave") ?? ATTENDANCE_CREW_ROSTER[0];
    const seededAllocation: EmployeeAllocation = { employeeName: attendanceEmployee.name, crewId: attendanceEmployee.id, bookingId: booking.id };
    const rosterView = render(<CrewView
      bookings={[booking]}
      allocations={[seededAllocation]}
      setAllocations={() => undefined}
      focusedBookingId={booking.id}
      onAddWorkman={() => undefined}
      onAllocationSaved={() => undefined}
    />);

    const rosterQueries = within(rosterView.container);
    const search = rosterQueries.getByRole("textbox", { name: "Search crew assignment roster" });
    await userEvent.setup().type(search, attendanceEmployee.sourceId);
    expect(rosterQueries.getByTestId("crew-roster-table")).toHaveTextContent(attendanceEmployee.name);
    expect(rosterQueries.getByTestId("crew-roster-table")).toHaveTextContent("Completed booking");
    expect(rosterQueries.getByRole("button", { name: "Remove selected crew" })).toBeInTheDocument();
  });
});
