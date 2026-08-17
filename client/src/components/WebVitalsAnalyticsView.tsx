import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Activity, Calendar, Download, Gauge, RefreshCw, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const vitalsChartConfig = {
  lcp: { label: "LCP (ms)", theme: { light: "#d65d24", dark: "#ff9a62" } },
  fid: { label: "FID (ms)", theme: { light: "#0a66c2", dark: "#7cb8ff" } },
  cls: { label: "CLS", theme: { light: "#187451", dark: "#58d68d" } },
} satisfies ChartConfig;

type DateRange = "all" | "today" | "7days";
type TrendKey = "lcp" | "fid" | "cls";

const metricNumber = (value: string) => Number.parseFloat(value.replace(/[^0-9.]/g, ""));
const formatDay = (value: Date | string) => new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(new Date(value));
const average = (values: number[], digits = 0) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits)) : null;

export default function WebVitalsAnalyticsView() {
  const telemetryQuery = trpc.telemetry.list.useQuery({ limit: 250 });
  const metrics = telemetryQuery.data ?? [];
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const filteredMetrics = useMemo(() => {
    const now = Date.now();
    return metrics.filter(metric => {
      if (dateRange === "all") return true;
      const ageDays = (now - new Date(metric.createdAt).getTime()) / 86_400_000;
      return dateRange === "today" ? ageDays <= 1 : ageDays <= 7;
    });
  }, [dateRange, metrics]);

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

  const valuesFor = (name: "LCP" | "FID" | "CLS") => filteredMetrics.filter(metric => metric.metricName === name).map(metric => metricNumber(metric.metricValue)).filter(value => !Number.isNaN(value));
  const lcpValues = valuesFor("LCP");
  const fidValues = valuesFor("FID");
  const clsValues = valuesFor("CLS");

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

  const TrendChart = ({ dataKey, label, suffix = "" }: { dataKey: TrendKey; label: string; suffix?: string }) => (
    <div className="web-vitals-chart-card">
      <div className="web-vitals-chart-heading"><span>{label}</span><small>{chartData.length ? "Daily average" : "Awaiting samples"}</small></div>
      <ChartContainer config={vitalsChartConfig} className="h-[190px] w-full">
        <LineChart accessibilityLayer data={chartData} margin={{ left: -16, right: 8, top: 10, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={value => `Day: ${value}`} formatter={value => `${value}${suffix}`} />} />
          <Line dataKey={dataKey} type="monotone" stroke={`var(--color-${dataKey})`} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ChartContainer>
    </div>
  );

  return <div className="content">
    <div className="page-heading">
      <div><div className="eyebrow">Performance Intelligence</div><h1 className="page-title">Web Vitals Analytics</h1><p className="page-copy">Real-user LCP, FID, and CLS are grouped into daily trend lines for the selected reporting period.</p></div>
      <div className="web-vitals-actions">
        <label className="web-vitals-range"><Calendar size={14} aria-hidden="true" /><span className="sr-only">Select reporting date range</span><select value={dateRange} onChange={event => setDateRange(event.target.value as DateRange)}><option value="all">All time</option><option value="today">Past 24 hours</option><option value="7days">Past 7 days</option></select></label>
        <button type="button" className="secondary-button compact-button" onClick={exportCsv} disabled={!filteredMetrics.length}><Download size={13} /> Export CSV</button>
        <button type="button" className="secondary-button compact-button" onClick={() => void telemetryQuery.refetch()} disabled={telemetryQuery.isFetching}><RefreshCw size={13} /> {telemetryQuery.isFetching ? "Refreshing…" : "Refresh"}</button>
      </div>
    </div>
    <div className="metric-grid">
      <div className="metric-card"><div className="metric-label">Avg LCP</div><div className="metric-value">{average(lcpValues) === null ? "—" : `${average(lcpValues)}ms`}</div><div className="metric-foot">{lcpValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Avg FID</div><div className="metric-value">{average(fidValues) === null ? "—" : `${average(fidValues)}ms`}</div><div className="metric-foot">{fidValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Avg CLS</div><div className="metric-value">{average(clsValues, 3) ?? "—"}</div><div className="metric-foot">{clsValues.length} samples in range</div></div>
      <div className="metric-card"><div className="metric-label">Telemetry events</div><div className="metric-value">{filteredMetrics.length}</div><div className="metric-foot">Dedicated persistence active</div></div>
    </div>
    <section className="panel web-vitals-trends-panel">
      <div className="panel-header"><div><div className="panel-title"><TrendingUp size={16} /> Web Vitals trends over time</div><div className="panel-meta">Daily averages for the selected reporting period.</div></div><span className="status-badge blue">{chartData.length} reporting day{chartData.length === 1 ? "" : "s"}</span></div>
      <div className="panel-body">{telemetryQuery.isLoading ? <div className="empty-state">Loading Web Vitals trends…</div> : telemetryQuery.error ? <div className="account-error">Unable to load telemetry analytics.</div> : filteredMetrics.length ? <div className="web-vitals-chart-grid"><TrendChart dataKey="lcp" label="Largest Contentful Paint" suffix="ms" /><TrendChart dataKey="fid" label="First Input Delay" suffix="ms" /><TrendChart dataKey="cls" label="Cumulative Layout Shift" /></div> : <div className="empty-state"><TrendingUp size={28} /><strong>No Web Vitals telemetry matches the selected filter</strong><p>Choose another date range or wait for active sessions to emit performance metrics.</p></div>}</div>
    </section>
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-header"><div><div className="panel-title"><Activity size={16} /> Web Vitals telemetry stream</div><div className="panel-meta">Dedicated metric entries captured from real browser sessions.</div></div><span className="status-badge blue">{filteredMetrics.length} entries</span></div>
      <div className="panel-body">{telemetryQuery.isLoading ? <div className="empty-state">Loading Web Vitals telemetry…</div> : telemetryQuery.error ? <div className="account-error">Unable to load telemetry analytics.</div> : filteredMetrics.length ? <div className="compliance-list">{filteredMetrics.map(metric => <div className="compliance-row" key={metric.id}><div style={{ minWidth: 0 }}><div className="compliance-name"><Gauge size={14} color="#d65d24" /> {metric.path}</div><div className="compliance-sub"><strong>{metric.metricName}: {metric.metricValue}</strong></div><div className="compliance-sub" style={{ marginTop: 4 }}>Captured at {new Date(metric.createdAt).toLocaleString()}</div></div></div>)}</div> : <div className="empty-state"><TrendingUp size={28} /><strong>No Web Vitals telemetry matches the selected filter</strong><p>Choose another date range or wait for active sessions to emit performance metrics.</p></div>}</div>
    </section>
  </div>;
}
