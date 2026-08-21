import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sales enquiry response controls", () => {
  it("renders rental-duration and owner-status filters", () => {
    const source = readFileSync(new URL("../client/src/components/SalesEnquiryInbox.tsx", import.meta.url), "utf8");

    expect(source).toContain('const [durationFilter, setDurationFilter] = useState<string>("all")');
    expect(source).toContain('const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")');
    expect(source).toContain('<span>Rental duration</span>');
    expect(source).toContain('<span>Owner status</span>');
    expect(source).toContain('<option value="unassigned">Unassigned only</option>');
    expect(source).toContain("RENTAL_DURATION_OPTIONS.map");
  });

  it("opens a client-specific pre-filled quick reply from the detail modal", () => {
    const source = readFileSync(new URL("../client/src/components/SalesEnquiryInbox.tsx", import.meta.url), "utf8");

    expect(source).toContain("const openQuickReply = () =>");
    expect(source).toContain("selected.email");
    expect(source).toContain("selected.contactName");
    expect(source).toContain("Equipment: ${selected.equipmentInterest}");
    expect(source).toContain("Rental duration: ${selected.rentalDuration");
    expect(source).toContain('Quick reply</button>');
  });

  it("uses a pulsing class for open unassigned enquiries and respects reduced motion", () => {
    const overviewSource = readFileSync(new URL("../client/src/pages/views/Overview.tsx", import.meta.url), "utf8");
    const styleSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

    expect(overviewSource).toContain('className={`unassigned-enquiry-status ${unassignedSeverity}`}');
    expect(styleSource).toContain(".unassigned-enquiry-status.needs-response");
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
