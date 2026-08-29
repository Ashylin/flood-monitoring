import { Activity, LogOut } from "lucide-react";
import type { ConnectionState } from "../hooks/useSocket";

interface Props {
  connectionState: ConnectionState;
  activeAlerts: number;
  userEmail?: string;
  userRole?: string;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export default function Header({ connectionState, activeAlerts, userEmail, userRole, onLoginClick, onLogoutClick }: Props) {
  return (
    <div className="header">
      <h1>
        <Activity size={18} strokeWidth={2} className="header-icon" />
        Flood Monitoring &amp; Early Warning System
        <span className={`badge conn-${connectionState}`}>
          <span className={`conn-dot conn-${connectionState}`} />
          {CONNECTION_LABEL[connectionState]}
        </span>
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {activeAlerts > 0 && <span className="badge offline">{activeAlerts} active alert{activeAlerts > 1 ? "s" : ""}</span>}
        {userEmail ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-dim)" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {userEmail} <span style={{ color: "var(--text-faint)" }}>· {userRole}</span>
            </span>
            <button onClick={onLogoutClick} style={actionButtonStyle}>
              <LogOut size={12} strokeWidth={2} />
              Log out
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick} style={actionButtonStyle}>
            Operator login
          </button>
        )}
      </div>
    </div>
  );
}

const actionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "1px solid var(--panel-border-strong)",
  color: "var(--text)",
  borderRadius: 5,
  padding: "6px 11px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  cursor: "pointer",
} as const;
