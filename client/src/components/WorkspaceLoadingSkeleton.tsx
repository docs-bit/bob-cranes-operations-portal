import { Loader2 } from "lucide-react";

export default function WorkspaceLoadingSkeleton({ title = "Loading departmental workspace…" }: { title?: string }) {
  return (
    <div className="content" style={{ minHeight: 450, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div className="panel" style={{ width: "100%", maxWidth: 600, padding: 40, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Loader2 className="animate-spin" size={36} color="#d65d24" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--foreground)" }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Synchronizing workspace modules, active dossiers, and live telemetry.
        </p>
        <div style={{ marginTop: 24, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: "60%", height: "100%", background: "#d65d24", borderRadius: 3, animation: "pulse 1.5s infinite" }} />
        </div>
      </div>
    </div>
  );
}
