import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Activity, Gauge, TrendingUp, RefreshCw, Download, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function WebVitalsAnalyticsView() {
  const telemetryQuery = trpc.telemetry.list.useQuery({ limit: 250 });
  const metrics = telemetryQuery.data ?? [];
  const [dateRange, setDateRange] = useState<"all" | "today" | "7days">("all");

  const now = Date.now();
  const filteredMetrics = metrics.filter(metric => {
    if (dateRange === "all") return true;
    const metricTime = new Date(metric.createdAt).getTime();
    const diffDays = (now - metricTime) / (1000 * 60 * 60 * 24);
    if (dateRange === "today") return diffDays <= 1;
    if (dateRange === "7days") return diffDays <= 7;
    return true;
  });

  const lcpValues = filteredMetrics.filter(e => e.metricName === "LCP").map(e => Number.parseFloat(e.metricValue)).filter(v => !Number.isNaN(v));
  const fidValues = filteredMetrics.filter(e => e.metricName === "FID").map(e => Number.parseFloat(e.metricValue)).filter(v => !Number.isNaN(v));
  const clsValues = filteredMetrics.filter(e => e.metricName === "CLS").map(e => Number.parseFloat(e.metricValue)).filter(v => !Number.isNaN(v));

  const avgLcp = lcpValues.length ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : 0;
  const avgFid = fidValues.length ? Math.round(fidValues.reduce((a, b) => a + b, 0) / fidValues.length) : 0;
  const avgCls = clsValues.length ? (clsValues.reduce((a, b) => a + b, 0) / clsValues.length).toFixed(3) : "0.000";

  const exportCsv = () => {
    const headers = ["ID", "MetricName", "MetricValue", "Path", "CreatedAt"];
    const rows = filteredMetrics.map(m => [m.id, m.metricName, m.metricValue, m.path, new Date(m.createdAt).toISOString()]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bob-web-vitals-${dateRange}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Web Vitals telemetry exported to CSV");
  };

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Performance Intelligence</div>
          <h1 className="page-title">Web Vitals Analytics</h1>
          <p className="page-copy">Aggregated real-user performance metrics collected from published pages across BOB Cranes portals.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card px-3 py-1.5 rounded-md border border-border">
            <Calendar size={14} />
            <select className="bg-transparent border-none text-xs outline-none cursor-pointer" value={dateRange} onChange={e => setDateRange(e.target.value as any)}>
              <option value="all">All time</option>
              <option value="today">Past 24 hours</option>
              <option value="7days">Past 7 days</option>
            </select>
          </div>
          <button type="button" className="secondary-button compact-button" onClick={exportCsv} disabled={filteredMetrics.length === 0}>
            <Download size={13} /> Export CSV
          </button>
          <button type="button" className="secondary-button compact-button" onClick={() => void telemetryQuery.refetch()} disabled={telemetryQuery.isFetching}>
            <RefreshCw size={13} /> {telemetryQuery.isFetching ? "Refreshing…" : "Refresh telemetry"}
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Avg LCP (Largest Contentful Paint)</div>
          <div className="metric-value">{avgLcp ? `${avgLcp}ms` : "No data"}</div>
          <div className="metric-foot">{lcpValues.length} samples recorded</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg FID (First Input Delay)</div>
          <div className="metric-value">{avgFid ? `${avgFid}ms` : "No data"}</div>
          <div className="metric-foot">{fidValues.length} samples recorded</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg CLS (Cumulative Layout Shift)</div>
          <div className="metric-value">{avgCls}</div>
          <div className="metric-foot">{clsValues.length} samples recorded</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Filtered telemetry events</div>
          <div className="metric-value">{filteredMetrics.length}</div>
          <div className="metric-foot">Dedicated persistence active</div>
        </div>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title"><Activity size={16} /> Web Vitals telemetry stream</div>
            <div className="panel-meta">Showing dedicated metric entries captured from real browser sessions matching filter ({dateRange}).</div>
          </div>
          <span className="status-badge blue">{filteredMetrics.length} metric entries</span>
        </div>
        <div className="panel-body">
          {telemetryQuery.isLoading ? (
            <div className="empty-state">Loading Web Vitals telemetry…</div>
          ) : telemetryQuery.error ? (
            <div className="account-error">Unable to load telemetry analytics.</div>
          ) : filteredMetrics.length ? (
            <div className="compliance-list">
              {filteredMetrics.map(metric => (
                <div className="compliance-row" key={metric.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="compliance-name"><Gauge size={14} color="#d65d24" /> {metric.path}</div>
                    <div className="compliance-sub"><strong>{metric.metricName}: {metric.metricValue}</strong></div>
                    <div className="compliance-sub" style={{ marginTop: 4 }}>Captured at {new Date(metric.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <TrendingUp size={28} />
              <strong>No Web Vitals telemetry matches the selected filter</strong>
              <p>Try switching the date range or waiting for active sessions to emit performance metrics.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
