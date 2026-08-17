import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("booking render identity", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("does not use a booking ID alone as a React key", () => {
    expect(homeSource).not.toMatch(/key=\{booking\.id\}/);
    expect(homeSource).toContain("key={`booking-table-${booking.id}-${index}`}");
    expect(homeSource).toContain("key={`department-queue-${booking.id}-${index}`}");
    expect(homeSource).toContain("key={`handoff-${booking.id}-${index}`}");
  });

  it("replaces an existing dossier when booking state is updated or created", () => {
    expect(homeSource).toContain("current.filter(item => item.id !== nextBooking.id)");
    expect(homeSource).toContain("current.filter(item => item.id !== booking.id)");
    expect(homeSource).toContain("new Map(initialBookings.map(booking => [booking.id, booking]))");
  });
});
