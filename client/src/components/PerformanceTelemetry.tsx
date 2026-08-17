import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export default function PerformanceTelemetry() {
  const capture = trpc.telemetry.capture.useMutation();
  const reportedRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    const sendMetric = (metricName: "LCP" | "FID" | "CLS", metricValue: string) => {
      const key = `${metricName}:${window.location.pathname}`;
      if (reportedRef.current.has(key)) return;
      reportedRef.current.add(key);
      try {
        capture.mutate({
          metricName,
          metricValue,
          path: window.location.pathname.slice(0, 512),
        });
      } catch {
        // Silently ignore network failures during background telemetry.
      }
    };

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          sendMetric("LCP", `${Math.round(lastEntry.startTime)}ms`);
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          sendMetric("FID", `${Math.round((entry as PerformanceEventTiming).processingStart - entry.startTime)}ms`);
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });

      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        sendMetric("CLS", clsValue.toFixed(3));
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
        clsObserver.disconnect();
      };
    } catch {
      // Fallback for restricted observer environments.
    }
  }, [capture]);

  return null;
}
