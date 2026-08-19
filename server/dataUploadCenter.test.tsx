// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";

import DataUploadCenter from "../client/src/components/DataUploadCenter";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DataUploadCenter workbook preview", () => {
  it("previews parsed workbook headers and rows before mapping confirmation", async () => {
    const user = userEvent.setup();
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Client Name", "Project", "Priority"],
      ["Gulf Contracting LLC", "Downtown Tower Lift", "Critical"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Register");
    const workbookBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const workbookArrayBuffer = workbookBytes instanceof ArrayBuffer ? workbookBytes : (workbookBytes as Uint8Array).buffer;
    const file = new File([workbookArrayBuffer as ArrayBuffer], "sales-register.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    class MockFileReader {
      onload: ((event: { target: { result: ArrayBuffer } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer() {
        this.onload?.({ target: { result: workbookArrayBuffer as ArrayBuffer } });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    render(<DataUploadCenter uploads={{}} setUploads={vi.fn()} />);
    const input = screen.getByLabelText(/upload workbook for sales & client relations/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    expect(input.files?.[0]?.name).toBe("sales-register.xlsx");
    await waitFor(() => expect(screen.getByText(/map sales-register\.xlsx to sales & client relations/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /preview workbook/i }));

    const dialog = screen.getByRole("dialog", { name: /sales-register\.xlsx/i });
    expect(dialog).toHaveTextContent("Sales Register");
    expect(dialog).toHaveTextContent("Client Name");
    expect(screen.getByDisplayValue("Gulf Contracting LLC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Downtown Tower Lift")).toBeInTheDocument();
  });
});

void React;
void userEvent;
