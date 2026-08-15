import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runtimeErrorFingerprint, sanitizeRuntimeMessage } from "../shared/runtimeMonitoring";
import { appRouter } from "./routers";
import * as db from "./db";

const crewWorkspace = readFileSync(new URL("../client/src/components/CrewAssignmentWorkspace.tsx", import.meta.url), "utf8");
const reporter = readFileSync(new URL("../client/src/components/RuntimeErrorReporter.tsx", import.meta.url), "utf8");
const monitoringPanel = readFileSync(new URL("../client/src/components/RuntimeMonitoringPanel.tsx", import.meta.url), "utf8");

describe("production runtime monitoring and Crew Assignment exports", () => {
  it("redacts sensitive fragments and produces stable error fingerprints", () => {
    const message = sanitizeRuntimeMessage("Failure for user@bobcranes.ae token=abc123 password=secret");
    expect(message).toContain("[redacted-email]");
    expect(message).toContain("token=[redacted]");
    expect(message).toContain("password=[redacted]");
    expect(runtimeErrorFingerprint("window.error", message, "/crew")).toBe(runtimeErrorFingerprint("window.error", message, "/crew"));
  });

  it("provides a bounded public capture procedure and administrator-only event listing", async () => {
    const createSpy = vi.spyOn(db, "createRuntimeErrorEvent").mockResolvedValue({ id: "runtime-test" });
    const publicCaller = appRouter.createCaller({ user: null } as any);
    await expect(publicCaller.runtimeMonitoring.capture({ source: "window.error", message: "Bad token=topsecret", path: "/crew" })).resolves.toEqual({ id: "runtime-test" });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "Bad token=[redacted]", path: "/crew" }));
    await expect(publicCaller.runtimeMonitoring.list({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    createSpy.mockRestore();
  });

  it("wires current-filter CSV export, booking tooltips, and runtime client reporting", () => {
    expect(crewWorkspace).toContain("exportCurrentScheduleCsv");
    expect(crewWorkspace).toContain("Export CSV");
    expect(crewWorkspace).toContain("text/csv;charset=utf-8");
    expect(crewWorkspace).toContain("CsvColumnDialog");
    expect(crewWorkspace).toContain("Choose CSV columns");
    expect(crewWorkspace).toContain("Generating CSV…");
    expect(crewWorkspace).toContain("csvColumns");
    expect(crewWorkspace).toContain("BookingIdChip");
    expect(crewWorkspace).toContain("booking-chip-tooltip");
    expect(reporter).toContain('window.addEventListener("error"');
    expect(reporter).toContain('window.addEventListener("unhandledrejection"');
    expect(monitoringPanel).toContain("Production runtime monitoring");
  });
});
