import { CheckCircle2 } from "lucide-react";
import type { Alert } from "../types";

interface Props {
  alerts: Alert[];
  token: string | null;
  onAck: (id: number) => void;
  onResolve: (id: number) => void;
}

function timeAgo(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function AlertsPanel({ alerts, token, onAck, onResolve }: Props) {
  if (!alerts.length)
    return (
      <div className="empty-state" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <CheckCircle2 size={14} strokeWidth={2} style={{ color: "var(--nominal)" }} />
        No active emergency alerts
      </div>
    );

  return (
    <div className="alert-list">
      {alerts.map((a) => (
        <div className={`alert-item severity-${a.severity}`} key={a.id}>
          <div>
            <div className="title">
              [{a.severity.toUpperCase()}] {a.title}
            </div>
            <div className="msg">{a.message}</div>
            <div className="time">
              {timeAgo(a.created_at)} {a.zone_name ? `· ${a.zone_name}` : ""} {a.station_name ? `· ${a.station_name}` : ""} · status: {a.status}
            </div>
          </div>
          {a.status !== "resolved" && (
            <div className="alert-actions">
              {a.status === "active" && <button onClick={() => onAck(a.id)}>Acknowledge</button>}
              <button onClick={() => onResolve(a.id)}>{token ? "Resolve" : "Log in to resolve"}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
