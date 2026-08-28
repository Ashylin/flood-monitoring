import type { FloodZone } from "../types";

interface Props {
  zones: FloodZone[];
}

export default function FloodZonePanel({ zones }: Props) {
  if (!zones.length) return <div className="empty-state">No flood-prone zones configured.</div>;

  return (
    <div className="card-grid">
      {zones.map((z) => (
        <div className="zone-card" key={z.id}>
          <div className={`status-strip ${z.risk_level}`} />
          <h3>{z.name}</h3>
          <div className="meta">{z.district}{z.station_name ? ` · linked to ${z.station_name}` : ""}</div>
          <div className="meta">Population at risk: {z.population_at_risk.toLocaleString()}</div>
          {typeof z.risk_score === "number" && (
            <div className="meta" style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
              Score: {z.risk_score}/100
            </div>
          )}
          <span className={`status-pill ${z.risk_level}`}>
            {z.risk_level === "insufficient_data" ? "insufficient data" : `${z.risk_level} risk`}
          </span>
          {z.risk_reason && <div className="meta" style={{ marginTop: 8, lineHeight: 1.5 }}>{z.risk_reason}</div>}
        </div>
      ))}
    </div>
  );
}
