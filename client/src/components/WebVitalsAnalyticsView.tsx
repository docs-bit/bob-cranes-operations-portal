import { trpc } from "@/lib/trpc";
import { Activity, Gauge, TrendingUp, RefreshCw } from "lucide-react";

export default function WebVitalsAnalyticsView() {
  const eventsQuery = trpc.runtimeMonitoring.list.useQuery({ limit: 250 });
  const events = eventsQuery.data ?? [];
  const metrics = events.filter(e => e.message.startsWith("[Performance Metric]"));

  const lcpValues = metrics.filter(e => e.message.includes("LCP:")).map(e => {
    const match = e.message.match(/LCP:\s*([0-9]+)ms/);
    return match ? Number(match[1]) : null;
  }).filter((v): v is number => v !== null);

  const fidValues = metrics.filter(e => e.message.includes("FID:")).map(e => {
    const match = e.message.match(/FID:\s*([0-9]+)ms/);
    return match ? Number(match[1]) : null;
  }).filter((v): v is number => v !== null);

  const clsValues = metrics.filter(e => e.message.includes("CLS:")).map(e => {
    const match = e.message.match(/CLS:\s*([0-9.]+)/);
    return match ? Number(match[1]) : null;
  }).filter((v): v is number => v !== null);

  const avgLcp = lcpValues.length ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : 0;
  const avgFid = fidValues.length ? Math.round(fidValues.reduce((a, b) => a + b, 0) / fidValues.length) : 0;
  const avgCls = clsValues.length ? (clsValues.reduce((a, b) => a + b, 0) / clsValues.length).toFixed(3) : "0.000";

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Performance Intelligence</div>
          <h1 className="page-title">Web Vitals Analytics</h1>
          <p className="page-copy">Aggregated real-user performance metrics collected from published pages across BOB Cranes portals.</p>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={() => void eventsQuery.refetch()} disabled={eventsQuery.isFetching}>
          <RefreshCw size={13} /> {eventsQuery.isFetching ? "Refreshing…" : "Refresh telemetry"}
        </button>
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
          <div className="metric-label">Total telemetry events</div>
          <div className="metric-value">{metrics.length}</div>
          <div className="metric-foot">Rate-limited token bucket active</div>
        </div>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title"><Activity size={16} /> Recent Web Vitals telemetry stream</div>
            <div className="panel-meta">Showing raw performance entries captured from real browser sessions.</div>
          </div>
          <span className="status-badge blue">{metrics.length} metric entries</span>
        </div>
        <div className="panel-body">
          {eventsQuery.isLoading ? (
            <div className="empty-state">Loading Web Vitals telemetry…</div>
          ) : eventsQuery.error ? (
            <div className="account-error">Unable to load telemetry analytics.</div>
          ) : metrics.length ? (
            <div className="compliance-list">
              {metrics.map(metric => (
                <div className="compliance-row" key={metric.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="compliance-name"><Gauge size={14} color="#d65d24" /> {metric.path}</div>
                    <div className="compliance-sub"><strong>{metric.message}</strong></div>
                    <div className="compliance-sub" style={{ marginTop: 4 }}>Captured at {new Date(metric.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <TrendingUp size={28} />
              <strong>No Web Vitals telemetry captured yet</strong>
              <p>Performance telemetry is actively observing LCP, FID, and CLS across active client sessions.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
