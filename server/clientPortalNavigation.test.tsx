/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    clientFeedback: {
      submit: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
    },
  },
}));

import { ClientPortal } from "../client/src/pages/Home";

describe("Client Response Portal navigation", () => {
  it("opens the required-documents upload flow and forwards selected files", async () => {
    const user = userEvent.setup();
    const onUploadAll = vi.fn().mockResolvedValue(undefined);
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[{ id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Required", required: true }] as any}
      onUpdate={vi.fn()}
      onUploadAll={onUploadAll}
      onBackToInternal={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: /required documents/i }));
    const file = new File(["signed pass"], "signed-site-access-pass.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/choose client documents/i), file);
    await waitFor(() => expect(onUploadAll).toHaveBeenCalledWith([expect.objectContaining({ name: "signed-site-access-pass.pdf" })], "doc-1"));
  });

  it("exposes a drag-and-drop upload zone and document replace/delete action", async () => {
    const user = userEvent.setup();
    const onUploadAll = vi.fn();
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[{ id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Uploaded", required: true }] as any}
      onUpdate={vi.fn()}
      onUploadAll={onUploadAll}
      onBackToInternal={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: /required documents/i }));
    expect(screen.getByText(/drag and drop your files here/i)).toBeInTheDocument();
    const replaceButton = screen.getByRole("button", { name: /replace or delete document site access pass/i });
    expect(replaceButton).toBeInTheDocument();
    await user.click(replaceButton);
    expect(onUploadAll).toHaveBeenCalled();
  });

  it("allows previewing and downloading uploaded documents in a modal", async () => {
    const user = userEvent.setup();
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[{ id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Uploaded", required: true }] as any}
      onUpdate={vi.fn()}
      onUploadAll={vi.fn()}
      onBackToInternal={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: /required documents/i }));
    const previewButton = screen.getByRole("button", { name: /preview document site access pass/i });
    expect(previewButton).toBeInTheDocument();
    await user.click(previewButton);
    expect(screen.getByText(/document preview: site access pass/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download file/i })).toBeInTheDocument();
  });

  it("filters documents by category and tag and accepts a dropped file", async () => {
    const user = userEvent.setup();
    const onUploadAll = vi.fn().mockResolvedValue(undefined);
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[
        { id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Required", required: true, category: "Access & Permits", tags: ["permit"] },
        { id: "doc-2", departmentCode: "ACC", name: "Signed LPO", state: "Required", required: true, category: "Commercial", tags: ["lpo"] },
      ] as any}
      onUpdate={vi.fn()}
      onUploadAll={onUploadAll}
      onBackToInternal={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: /required documents/i }));
    expect(screen.getByText("Site access pass")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /filter documents by category/i }), "Access & Permits");
    expect(screen.getByText("Site access pass")).toBeInTheDocument();
    expect(screen.queryByText("Signed LPO")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /filter documents by category/i }), "All categories");
    await user.selectOptions(screen.getByRole("combobox", { name: /filter documents by tag/i }), "lpo");
    expect(screen.getByText("Signed LPO")).toBeInTheDocument();
    expect(screen.queryByText("Site access pass")).not.toBeInTheDocument();

    const droppedFile = new File(["delivery note"], "delivery-note.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByRole("button", { name: /drag and drop client documents/i }), { dataTransfer: { files: [droppedFile] } });
    await waitFor(() => expect(onUploadAll).toHaveBeenCalledWith([droppedFile], "doc-1"));
  });

  it("uploads multiple dropped files concurrently with one targeted callback per required document", async () => {
    const onUploadAll = vi.fn(() => new Promise<void>(resolve => window.setTimeout(resolve, 180)));
    render(<ClientPortal
      booking={{ id: "BOB Booking-31511", client: "Gulf Contracting LLC", project: "Downtown Tower Lift", pm: "Nishanth", mob: "11 Aug 2026", offHire: "14 Aug 2026", crane: "200T Mobile Crane", site: "Dubai Downtown", progress: 72, stage: "Docs In Progress", priority: "Critical", crewIds: [], gearIds: [], trailerIds: [] } as any}
      documents={[
        { id: "doc-1", departmentCode: "DOC", name: "Site access pass", state: "Required", required: true },
        { id: "doc-2", departmentCode: "ACC", name: "Signed LPO", state: "Required", required: true },
      ] as any}
      onUpdate={vi.fn()}
      onUploadAll={onUploadAll}
      onBackToInternal={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: /required documents/i }));
    fireEvent.drop(screen.getByRole("button", { name: /drag and drop client documents/i }), {
      dataTransfer: { files: [
        new File(["pass"], "site-access.pdf", { type: "application/pdf" }),
        new File(["lpo"], "signed-lpo.pdf", { type: "application/pdf" }),
      ] },
    });
    await waitFor(() => {
      expect(onUploadAll).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/uploading 2 documents concurrently/i)).toBeInTheDocument();
    }, { timeout: 1000 });
    expect(onUploadAll).toHaveBeenCalledWith([expect.objectContaining({ name: "site-access.pdf" })], "doc-1");
    expect(onUploadAll).toHaveBeenCalledWith([expect.objectContaining({ name: "signed-lpo.pdf" })], "doc-2");
  });

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
