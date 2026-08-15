import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

type RuntimeErrorDetail = { source?: "window.error" | "unhandledrejection" | "react.boundary"; message?: string };

export default function RuntimeErrorReporter() {
  const capture = trpc.runtimeMonitoring.capture.useMutation();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    const report = (detail: RuntimeErrorDetail) => {
      const message = String(detail.message ?? "Unknown runtime error").slice(0, 2000);
      const source = detail.source ?? "window.error";
      const key = `${source}:${message}:${window.location.pathname}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);
      capture.mutate({ source, message, path: window.location.pathname.slice(0, 512) });
    };
    const onWindowError = (event: ErrorEvent) => report({ source: "window.error", message: event.error?.message ?? event.message });
    const onUnhandledRejection = (event: PromiseRejectionEvent) => report({ source: "unhandledrejection", message: event.reason instanceof Error ? event.reason.message : String(event.reason) });
    const onBoundaryError = (event: Event) => report((event as CustomEvent<RuntimeErrorDetail>).detail ?? {});
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("bob:runtime-error", onBoundaryError);
    return () => { window.removeEventListener("error", onWindowError); window.removeEventListener("unhandledrejection", onUnhandledRejection); window.removeEventListener("bob:runtime-error", onBoundaryError); };
  }, [capture]);
  return null;
}
