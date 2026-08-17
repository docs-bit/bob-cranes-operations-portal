import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Activity, Calendar, Download, Gauge, RefreshCw, TrendingUp } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const vitalsChartConfig = {
  lcp: { label: "LCP (ms)", theme: { light: "#d65d24", dark: "#ff9a62" } },
  fid: { label: "FID (ms)", theme: { light: "#0a66c2", dark: "#7cb8ff" } },
  cls: { label: "CLS", theme: { light: "#187451", dark: "#58d68d" } },
} satisfies ChartConfig;

type DateRange = "all" | "today" | "7days" | "custom";
type TrendKey = "lcp" | "fid" | "cls";
type DatePreset = { id: string; name: string; startDate: string; endDate: string };

const DATE_PRESETS_STORAGE_KEY = "bob-web-vitals-date-presets";

const VITAL_THRESHOLDS: Record<TrendKey, { good: number; needsImprovement: number; unit: string }> = {
  lcp: { good: 2500, needsImprovement: 4000, unit: "ms" },
  fid: { good: 100, needsImprovement: 300, unit: "ms" },
  cls: { good: 0.1, needsImprovement: 0.25, unit: "" },
};

const metricNumber = (value: string) => Number.parseFloat(value.replace(/[^0-9.]/g, ""));
const formatDay = (value: Date | string) => new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(new Date(value));
const average = (values: number[], digits = 0) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits)) : null;

export default function WebVitalsAnalyticsView() {
  const telemetryQuery = trpc.telemetry.list.useQuery({ limit: 250 });
  const metrics = telemetryQuery.data ?? [];
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [pdfReportLoading, setPdfReportLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [presetName, setPresetName] = useState("");
  const [savedDatePresets, setSavedDatePresets] = useState<DatePreset[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(DATE_PRESETS_STORAGE_KEY) ?? "[]");
      return Array.isArray(stored) ? stored.slice(0, 8) : [];
    } catch {
      return [];
    }
  });

  const filteredMetrics = useMemo(() => {
    const now = Date.now();
    const customStart = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : null;
    const customEnd = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : null;
    return metrics.filter(metric => {
      const capturedAt = new Date(metric.createdAt).getTime();
      if (dateRange === "all") return true;
      if (dateRange === "custom") {
        if (customStart === null || customEnd === null || customStart > customEnd) return false;
        return capturedAt >= customStart && capturedAt <= customEnd;
      }
      const ageDays = (now - capturedAt) / 86_400_000;
      return dateRange === "today" ? ageDays <= 1 : ageDays <= 7;
    });
  }, [customEndDate, customStartDate, dateRange, metrics]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, { day: string; sort: number; lcp: number[]; fid: number[]; cls: number[] }>();
    filteredMetrics.forEach(metric => {
      const date = new Date(metric.createdAt);
      const key = date.toISOString().slice(0, 10);
      const current = grouped.get(key) ?? { day: formatDay(date), sort: date.getTime(), lcp: [], fid: [], cls: [] };
      const value = metricNumber(metric.metricValue);
      if (!Number.isNaN(value) && metric.metricName === "LCP") current.lcp.push(value);
      if (!Number.isNaN(value) && metric.metricName === "FID") current.fid.push(value);
      if (!Number.isNaN(value) && metric.metricName === "CLS") current.cls.push(value);
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.sort - b.sort).map(item => ({
      day: item.day,
      lcp: average(item.lcp),
      fid: average(item.fid),
      cls: average(item.cls, 3),
    }));
  }, [filteredMetrics]);

  const valuesFor = (source: typeof filteredMetrics, name: "LCP" | "FID" | "CLS") => source.filter(metric => metric.metricName === name).map(metric => metricNumber(metric.metricValue)).filter(value => !Number.isNaN(value));
  const lcpValues = valuesFor(filteredMetrics, "LCP");
  const fidValues = valuesFor(filteredMetrics, "FID");
  const clsValues = valuesFor(filteredMetrics, "CLS");
  const previousPeriodBounds = useMemo(() => {
    const now = Date.now();
    if (dateRange === "all") return null;
    if (dateRange === "today") return { start: now - 2 * 86_400_000, end: now - 86_400_000 };
    if (dateRange === "7days") return { start: now - 14 * 86_400_000, end: now - 7 * 86_400_000 };
    const start = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : NaN;
    const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
    const span = end - start + 1;
    return { start: start - span, end: start - 1 };
  }, [customEndDate, customStartDate, dateRange]);
  const previousPeriodMetrics = useMemo(() => {
    if (!previousPeriodBounds) return [];
    return metrics.filter(metric => {
      const capturedAt = new Date(metric.createdAt).getTime();
      return capturedAt >= previousPeriodBounds.start && capturedAt <= previousPeriodBounds.end;
    });
  }, [metrics, previousPeriodBounds]);
  const previousLcpValues = valuesFor(previousPeriodMetrics, "LCP");
  const previousFidValues = valuesFor(previousPeriodMetrics, "FID");
  const previousClsValues = valuesFor(previousPeriodMetrics, "CLS");
  const thresholdCounts = (dataKey: TrendKey, values: number[]) => {
    const threshold = VITAL_THRESHOLDS[dataKey];
    return {
      good: values.filter(value => value <= threshold.good).length,
      needsImprovement: values.filter(value => value > threshold.good && value <= threshold.needsImprovement).length,
      poor: values.filter(value => value > threshold.needsImprovement).length,
    };
  };
  const percentageChange = (current: number, previous: number) => {
    if (previousPeriodBounds === null) return "N/A";
    if (previous === 0) return current === 0 ? "0%" : "New";
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  };
  const thresholdRows = [
    { name: "LCP", dataKey: "lcp" as TrendKey, suffix: "ms", counts: thresholdCounts("lcp", lcpValues), samples: lcpValues.length, previousSamples: previousLcpValues.length },
    { name: "FID", dataKey: "fid" as TrendKey, suffix: "ms", counts: thresholdCounts("fid", fidValues), samples: fidValues.length, previousSamples: previousFidValues.length },
    { name: "CLS", dataKey: "cls" as TrendKey, suffix: "", counts: thresholdCounts("cls", clsValues), samples: clsValues.length, previousSamples: previousClsValues.length },
  ];

  const formatTrendValue = (value: unknown, dataKey: TrendKey, suffix: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "—";
    const digits = dataKey === "cls" ? 3 : 0;
    return `${numericValue.toFixed(digits)}${suffix}`;
  };

  const saveDatePreset = () => {
    const name = presetName.trim();
    if (!name || !customStartDate || !customEndDate || customStartDate > customEndDate) {
      toast.error("Enter a name and a valid custom date range first");
      return;
    }
    const preset: DatePreset = { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name, startDate: customStartDate, endDate: customEndDate };
    setSavedDatePresets(previous => {
      const next = [preset, ...previous.filter(item => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 8);
      window.localStorage.setItem(DATE_PRESETS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setPresetName("");
    toast.success(`Saved date preset: ${name}`);
  };

  const applyDatePreset = (preset: DatePreset) => {
    setCustomStartDate(preset.startDate);
    setCustomEndDate(preset.endDate);
    setDateRange("custom");
    toast.success(`Applied date preset: ${preset.name}`);
  };

  const deleteDatePreset = (id: string) => {
    setSavedDatePresets(previous => {
      const next = previous.filter(item => item.id !== id);
      window.localStorage.setItem(DATE_PRESETS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const exportCsv = () => {
    const quote = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = filteredMetrics.map(metric => [metric.id, metric.metricName, metric.metricValue, metric.path, new Date(metric.createdAt).toISOString()]);
    const csv = [["ID", "Metric", "Value", "Path", "Captured at"], ...rows].map(row => row.map(quote).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bob-web-vitals-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Web Vitals telemetry exported to CSV");
  };

  const exportPdf = async () => {
    if (!filteredMetrics.length || pdfReportLoading) return;
    setPdfReportLoading(true);
    try {
      const pdfDocument = await PDFDocument.create();
      const regular = await pdfDocument.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
      const pageSize: [number, number] = [595, 842];
      const margin = 42;
      const accent = rgb(0.84, 0.36, 0.14);
      const navy = rgb(0.05, 0.13, 0.19);
      const muted = rgb(0.36, 0.41, 0.44);
      const rangeLabel = dateRange === "all" ? "All time" : dateRange === "today" ? "Past 24 hours" : dateRange === "7days" ? "Past 7 days" : `Custom: ${customStartDate || "start"} to ${customEndDate || "end"}`;
      const drawHeader = (page: ReturnType<typeof pdfDocument.addPage>, continuation = false) => {
        page.drawRectangle({ x: 0, y: 790, width: pageSize[0], height: 52, color: navy });
        page.drawText("BOB CRANES", { x: margin, y: 812, size: 18, font: bold, color: rgb(1, 1, 1) });
        page.drawText(continuation ? "Web Vitals Analytics - continued" : "Web Vitals Analytics Report", { x: margin, y: 797, size: 9, font: regular, color: rgb(0.82, 0.9, 0.94) });
      };
      let page = pdfDocument.addPage(pageSize);
      drawHeader(page);
      page.drawText("Performance Intelligence", { x: margin, y: 752, size: 10, font: bold, color: accent });
      page.drawText("Real-user Web Vitals report", { x: margin, y: 721, size: 24, font: bold, color: navy });
      page.drawText(`Reporting period: ${rangeLabel}`, { x: margin, y: 700, size: 10, font: regular, color: muted });
      page.drawText(`Generated: ${new Date().toLocaleString()}`, { x: margin, y: 685, size: 9, font: regular, color: muted });
      const cards: Array<[string, string]> = [["AVG LCP", average(lcpValues) === null ? "-" : `${average(lcpValues)}ms`], ["AVG FID", average(fidValues) === null ? "-" : `${average(fidValues)}ms`], ["AVG CLS", String(average(clsValues, 3) ?? "-")], ["EVENTS", String(filteredMetrics.length)]];
      cards.forEach(([label, value], index) => {
        const x = margin + index * 128;
        page.drawRectangle({ x, y: 625, width: 116, height: 48, color: rgb(0.95, 0.97, 0.98), borderColor: rgb(0.86, 0.89, 0.9), borderWidth: 1 });
        page.drawText(label, { x: x + 9, y: 655, size: 8, font: bold, color: muted });
        page.drawText(value, { x: x + 9, y: 636, size: 14, font: bold, color: navy });
      });
      page.drawText("Captured telemetry", { x: margin, y: 588, size: 13, font: bold, color: navy });
      page.drawText("Exact metric values captured from browser sessions; no synthetic samples are included.", { x: margin, y: 570, size: 9, font: regular, color: muted });
      const columns = ["Metric", "Value", "Path", "Captured at"];
      const xPositions = [margin, margin + 78, margin + 148, margin + 282];
      const drawTableHeader = (currentPage: ReturnType<typeof pdfDocument.addPage>) => {
        currentPage.drawRectangle({ x: margin, y: 535, width: 511, height: 22, color: rgb(0.9, 0.94, 0.95) });
        columns.forEach((column, index) => currentPage.drawText(column, { x: xPositions[index], y: 542, size: 8, font: bold, color: navy }));
      };
      drawTableHeader(page);
      let y = 518;
      filteredMetrics.forEach((metric, index) => {
        if (y < 56) {
          page = pdfDocument.addPage(pageSize);
          drawHeader(page, true);
          drawTableHeader(page);
          y = 518;
        }
        if (index % 2 === 0) page.drawRectangle({ x: margin, y: y - 4, width: 511, height: 20, color: rgb(0.98, 0.99, 0.99) });
        const values = [metric.metricName, metric.metricValue, metric.path, new Date(metric.createdAt).toLocaleString()];
        values.forEach((value, valueIndex) => {
          const clipped = String(value).length > 34 ? `${String(value).slice(0, 31)}…` : String(value);
          page.drawText(clipped, { x: xPositions[valueIndex], y, size: 8, font: regular, color: navy });
        });
        y -= 20;
      });
      const bytes = await pdfDocument.save();
      const pdfBuffer = bytes.slice().buffer as ArrayBuffer;
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `bob-web-vitals-${dateRange}-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Web Vitals PDF report downloaded");
    } catch (error) {
      console.error("Web Vitals PDF export failed", error);
      toast.error("Unable to generate the Web Vitals PDF report");
    } finally {
      setPdfReportLoading(false);
    }
  };

  const TrendChart = ({ dataKey, label, suffix = "" }: { dataKey: TrendKey; label: string; suffix?: string }) => {
    const threshold = VITAL_THRESHOLDS[dataKey];
    const observedMax = Math.max(...chartData.map(point => Number(point[dataKey]) || 0), threshold.needsImprovement);
    const chartMax = Math.max(observedMax * 1.12, threshold.needsImprovement * 1.15);
    return (
      <div className="web-vitals-chart-card">
        <div className="web-vitals-chart-heading"><span>{label}</span><small>{chartData.length ? "Daily average" : "Awaiting samples"}</small></div>
        <ChartContainer config={vitalsChartConfig} className="h-[190px] w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ left: -16, right: 8, top: 10, bottom: 0 }}>
            <ReferenceArea y1={0} y2={threshold.good} fill="#16a34a" fillOpacity={0.08} ifOverflow="extendDomain" />
            <ReferenceArea y1={threshold.good} y2={threshold.needsImprovement} fill="#d97706" fillOpacity={0.08} ifOverflow="extendDomain" />
            <ReferenceArea y1={threshold.needsImprovement} y2={chartMax} fill="#dc2626" fillOpacity={0.07} ifOverflow="extendDomain" />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis domain={[0, chartMax]} tickLine={false} axisLine={false} tickMargin={8} width={42} />
            <ReferenceLine y={threshold.good} stroke="#16a34a" strokeDasharray="4 4" label={{ value: `Good ≤ ${formatTrendValue(threshold.good, dataKey, suffix)}`, position: "insideTopRight", fill: "#15803d", fontSize: 9 }} />
            <ReferenceLine y={threshold.needsImprovement} stroke="#d97706" strokeDasharray="4 4" label={{ value: `Needs improvement ≤ ${formatTrendValue(threshold.needsImprovement, dataKey, suffix)}`, position: "insideTopRight", fill: "#b45309", fontSize: 9 }} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={value => `Day: ${value}`} formatter={value => formatTrendValue(value, dataKey, suffix)} />} />
            <Line dataKey={dataKey} type="monotone" stroke={`var(--color-${dataKey})`} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ChartContainer>
        <div className="web-vitals-threshold-legend" aria-label={`${label} performance thresholds`}>
          <span><i className="threshold-dot good" /> Good ≤ {formatTrendValue(threshold.good, dataKey, suffix)}</span>
          <span><i className="threshold-dot warning" /> Needs improvement ≤ {formatTrendValue(threshold.needsImprovement, dataKey, suffix)}</span>
          <span><i className="threshold-dot poor" /> Poor above threshold</span>
        </div>
      </div>
    );
  };

  return <div className="content">
    <div className="page-heading">
      <div><div className="eyebrow">Performance Intelligence</div><h1 className="page-title">Web Vitals Analytics</h1><p className="page-copy">Real-user LCP, FID, and CLS are grouped into daily trend lines for the selected reporting period.</p></div>
      <div className="web-vitals-actions">
        <label className="web-vitals-range"><Calendar size={14} aria-hidden="true" /><span className="sr-only">Select reporting date range</span><select value={dateRange} onChange={event => setDateRange(event.target.value as DateRange)}><option value="all">All time</option><option value="today">Past 24 hours</option><option value="7days">Past 7 days</option><option value="custom">Custom range</option></select></label>
        {dateRange === "custom" && <div className="web-vitals-custom-range" aria-label="Custom Web Vitals date range">
          <label><span>From</span><input type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} aria-label="Custom range start date" /></label>
          <label><span>To</span><input type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} aria-label="Custom range end date" /></label>
          <input className="web-vitals-preset-name" value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Preset name" aria-label="Saved date preset name" />
          <button type="button" className="secondary-button compact-button" onClick={saveDatePreset} disabled={!customStartDate || !customEndDate}>Save preset</button>
        </div>}
        {savedDatePresets.length > 0 && <div className="web-vitals-saved-presets" aria-label="Saved Web Vitals date presets">
          <span>Saved reports</span>
          {savedDatePresets.map(preset => <span className="web-vitals-preset-chip" key={preset.id}>
            <button type="button" onClick={() => applyDatePreset(preset)}>{preset.name}</button>
            <button type="button" aria-label={`Delete ${preset.name} preset`} onClick={() => deleteDatePreset(preset.id)}>×</button>
          </span>)}
        </div>}
        <button type="button" className="secondary-button compact-button" onClick={exportCsv} disabled={!filteredMetrics.length}><Download size={13} /> Export CSV</button>
        <button type="button" className="secondary-button compact-button" onClick={() => void exportPdf()} disabled={!filteredMetrics.length || pdfReportLoading}><Download size={13} /> {pdfReportLoading ? "Preparing PDF…" : "Export PDF"}</button>
        <button type="button" className="secondary-button compact-button" onClick={() => void telemetryQuery.refetch()} disabled={telemetryQuery.isFetching}><RefreshCw size={13} /> {telemetryQuery.isFetching ? "Refreshing…" : "Refresh"}</button>
      </div>
    </div>
    <div className="metric-grid">
      <div className="metric-card"><div className="metric-label">Avg LCP</div><div className="metric-value">{average(lcpValues) === null ? "-" : `${average(lcpValues)}ms`}</div><div className="metric-foot">{lcpValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Avg FID</div><div className="metric-value">{average(fidValues) === null ? "-" : `${average(fidValues)}ms`}</div><div className="metric-foot">{fidValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Avg CLS</div><div className="metric-value">{average(clsValues, 3) ?? "—"}</div><div className="metric-foot">{clsValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Telemetry events</div><div className="metric-value">{filteredMetrics.length}</div><div className="metric-foot">Dedicated persistence active</div></div>
    </div>
    <section className="panel web-vitals-trends-panel">
      <div className="panel-header"><div><div className="panel-title"><TrendingUp size={16} /> Web Vitals trends over time</div><div className="panel-meta">Daily averages for the selected reporting period.</div></div><span className="status-badge blue">{chartData.length} reporting day{chartData.length === 1 ? "" : "s"}</span></div>
      <div className="panel-body">{telemetryQuery.isLoading ? <div className="empty-state">Loading Web Vitals trends…</div> : telemetryQuery.error ? <div className="account-error">Unable to load telemetry analytics.</div> : filteredMetrics.length ? <>
        <div className="web-vitals-chart-grid"><TrendChart dataKey="lcp" label="Largest Contentful Paint" suffix="ms" /><TrendChart dataKey="fid" label="First Input Delay" suffix="ms" /><TrendChart dataKey="cls" label="Cumulative Layout Shift" /></div>
        <div className="web-vitals-threshold-summary" aria-labelledby="web-vitals-threshold-summary-title">
          <div className="web-vitals-summary-heading"><div><h2 id="web-vitals-threshold-summary-title">Threshold summary</h2><p>Sample counts for the selected reporting period.</p></div><span>{filteredMetrics.length} total samples</span></div>
          <div className="table-scroll"><table><thead><tr><th scope="col">Metric</th><th scope="col">Good</th><th scope="col">Needs improvement</th><th scope="col">Poor</th><th scope="col">Samples vs previous</th><th scope="col">Thresholds</th></tr></thead><tbody>{thresholdRows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td><span className="threshold-count good">{row.counts.good}</span></td><td><span className="threshold-count warning">{row.counts.needsImprovement}</span></td><td><span className="threshold-count poor">{row.counts.poor}</span></td><td><span className={`threshold-change${row.previousSamples === 0 && row.samples > 0 ? " new" : ""}`}>{percentageChange(row.samples, row.previousSamples)}</span><small className="threshold-previous-count">{row.samples} now · {row.previousSamples} previous</small></td><td>Good ≤ {formatTrendValue(VITAL_THRESHOLDS[row.dataKey].good, row.dataKey, row.suffix)} · Needs improvement ≤ {formatTrendValue(VITAL_THRESHOLDS[row.dataKey].needsImprovement, row.dataKey, row.suffix)}</td></tr>)}</tbody></table></div>
        </div>
      </> : <div className="empty-state"><TrendingUp size={28} /><strong>No Web Vitals telemetry matches the selected filter</strong><p>Choose another date range or wait for active sessions to emit performance metrics.</p></div>}</div>
    </section>
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-header"><div><div className="panel-title"><Activity size={16} /> Web Vitals telemetry stream</div><div className="panel-meta">Dedicated metric entries captured from real browser sessions.</div></div><span className="status-badge blue">{filteredMetrics.length} entries</span></div>
      <div className="panel-body">{telemetryQuery.isLoading ? <div className="empty-state">Loading Web Vitals telemetry…</div> : telemetryQuery.error ? <div className="account-error">Unable to load telemetry analytics.</div> : filteredMetrics.length ? <div className="compliance-list">{filteredMetrics.map(metric => <div className="compliance-row" key={metric.id}><div style={{ minWidth: 0 }}><div className="compliance-name"><Gauge size={14} color="#d65d24" /> {metric.path}</div><div className="compliance-sub"><strong>{metric.metricName}: {metric.metricValue}</strong></div><div className="compliance-sub" style={{ marginTop: 4 }}>Captured at {new Date(metric.createdAt).toLocaleString()}</div></div></div>)}</div> : <div className="empty-state"><TrendingUp size={28} /><strong>No Web Vitals telemetry matches the selected filter</strong><p>Choose another date range or wait for active sessions to emit performance metrics.</p></div>}</div>
    </section>
  </div>;
}
