
import { CircleDot } from "lucide-react";
import { statusTone } from "./shared";

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge ${statusTone(value)}`}>
      <CircleDot size={9} />
      {value}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  foot,
  icon,
  tone = "red",
}: {
  label: string;
  value: string;
  foot: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span className={tone === "green" ? "delta-up" : ""}>{icon}</span>
        {foot}
      </div>
    </div>
  );
}

