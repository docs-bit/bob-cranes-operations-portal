import { Activity, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const formatTime = (value: Date | string) => new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function RuntimeMonitoringPanel() {
  const eventsQuery = trpc.runtimeMonitoring.list.useQuery({ limit: 50 });
  const events = eventsQuery.data ?? [];
  const fingerprints = new Set(events.map(event => event.fingerprint)).size;
  return <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><div className="panel-title"><Activity size={16}/> Production runtime monitoring</div><div className="panel-meta">Sanitized client crashes and promise failures captured from the published portal. Error messages are redacted before storage.</div></div><span className={`status-badge ${events.length ? "amber" : "green"}`}>{events.length ? `${events.length} recent events` : "Clear"}</span></div><div className="panel-body">{eventsQuery.isLoading ? <div className="empty-state">Loading runtime incidents…</div> : eventsQuery.error ? <div className="account-error">Unable to load runtime monitoring events.</div> : events.length ? <div className="compliance-list">{events.map(event => <div className="compliance-row" key={event.id}><div style={{ minWidth: 0 }}><div className="compliance-name"><AlertTriangle size={14} color="#d65d24"/> {event.source} · {event.path}</div><div className="compliance-sub">{event.message}</div><div className="compliance-sub" style={{ marginTop: 5 }}>Fingerprint {event.fingerprint} · {formatTime(event.createdAt)}</div></div></div>)}</div> : <div className="empty-state">No runtime issues have been captured. Monitoring is active for client errors and unhandled promise rejections.</div>} {events.length > 0 && <div className="panel-meta" style={{ marginTop: 10 }}>{fingerprints} unique error fingerprint{fingerprints === 1 ? "" : "s"} in the recent event register.</div>}</div></section>;
}
