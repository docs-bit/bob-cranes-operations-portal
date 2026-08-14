/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wizard, gears } from "../client/src/pages/Home";

describe("booking wizard gear-document compliance gate", () => {
  it("shows a newly added expired gear record but refuses to select it for the booking", () => {
    const expiredGear = {
      name: "Uploaded expired sling · QA",
      type: "Slings · 40T SWL",
      cert: "INS-QA-EXPIRED",
      expires: "04 Aug 2026",
      validFrom: "2025-08-05",
      validUntil: "2026-08-04",
      status: "Expired" as const,
      selected: false,
      documents: [{ name: "expired-inspection.pdf", url: "/qa/expired-inspection.pdf" }],
    };
    const originalLength = gears.length;
    gears.push(expiredGear);

    try {
      render(<Wizard onCreated={() => undefined} onCancel={() => undefined} />);
      for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      const expiredCard = screen.getByText(expiredGear.name).closest(".resource-card");
      expect(expiredCard).toHaveTextContent("Selection blocked");
      expect(expiredCard).toHaveClass("blocked");
      fireEvent.click(expiredCard!);
      expect(expiredCard).not.toHaveClass("selected");

      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByText("2 compliant items")).toBeInTheDocument();
    } finally {
      gears.splice(originalLength);
    }
  });
});
