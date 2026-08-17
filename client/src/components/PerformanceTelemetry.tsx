import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function PerformanceTelemetry() {
  const capture = trpc.runtimeMonitoring.capture.useMutation();

  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    try {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const lcpValue = Math.round(lastEntry.startTime);
          capture.mutate({
            source: "window.error",
            message: `[Performance Metric] LCP: ${lcpValue}ms`,
            path: window.location.pathname.slice(0, 512),
          });
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidValue = Math.round((entry as PerformanceEventTiming).processingStart - entry.startTime);
          capture.mutate({
            source: "window.error",
            message: `[Performance Metric] FID: ${fidValue}ms`,
            path: window.location.pathname.slice(0, 512),
          });
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        capture.mutate({
          source: "window.error",
          message: `[Performance Metric] CLS: ${clsValue.toFixed(3)}`,
          path: window.location.pathname.slice(0, 512),
        });
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
        clsObserver.disconnect();
      };
    } catch {
      // Fallback for browsers with restricted PerformanceObserver types.
    }
  }, [capture]);

  return null;
}
