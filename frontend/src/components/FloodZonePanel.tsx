import type { FloodZone } from "../types";
import RelativeTime from "./RelativeTime";
import { usePulseOnChange } from "../hooks/usePulseOnChange";
import { useUnsplashPhoto } from "../hooks/useUnsplashPhoto";
import UnsplashCredit from "./UnsplashCredit";
import { SkeletonBlock } from "./Skeleton";

interface Props {
  zones: FloodZone[];
}

function ZoneCard({ z }: { z: FloodZone }) {
  const pulsing = usePulseOnChange(`${z.risk_level}|${z.risk_score ?? ""}`);
  const { photo, loading: photoLoading } = useUnsplashPhoto(`${z.district} Tamil Nadu`);

  return (
    <div className="zone-card">
      <div className={`status-strip ${z.risk_level}`} />
      {photoLoading ? (
        <SkeletonBlock height={90} style={{ marginLeft: 10, marginBottom: 8, width: "calc(100% - 10px)" }} />
      ) : photo ? (
        <>
          <img src={photo.imageUrl} alt={photo.altDescription} className="zone-photo" />
          <UnsplashCredit photo={photo} className="zone-photo-credit" />
        </>
      ) : null}
      <h3>{z.name}</h3>
      <div className="meta">{z.district}{z.station_name ? ` · linked to ${z.station_name}` : ""}</div>
      <div className="meta">Population at risk: {z.population_at_risk.toLocaleString()}</div>
      {typeof z.risk_score === "number" && (
        <div className={`meta ${pulsing ? "pulse-highlight" : ""}`} style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
          Score: {z.risk_score}/100
        </div>
      )}
      <span className={`status-pill ${pulsing ? "pulse-highlight" : ""} ${z.risk_level}`}>
        {z.risk_level === "insufficient_data" ? "insufficient data" : `${z.risk_level} risk`}
      </span>
      {z.risk_reason && <div className="meta" style={{ marginTop: 8, lineHeight: 1.5 }}>{z.risk_reason}</div>}
      <div className="meta" style={{ marginTop: 8 }}>
        <RelativeTime timestamp={z.updated_at} />
      </div>
    </div>
  );
}

export default function FloodZonePanel({ zones }: Props) {
  if (!zones.length) return <div className="empty-state">No flood-prone zones configured.</div>;

  return (
    <div className="card-grid">
      {zones.map((z) => (
        <ZoneCard z={z} key={z.id} />
      ))}
    </div>
  );
}
