import type { Station } from "../types";
import RelativeTime from "./RelativeTime";
import { usePulseOnChange } from "../hooks/usePulseOnChange";

interface Props {
  stations: Station[];
}

function StationCard({ s }: { s: Station }) {
  const level = s.latest_reading ? Number(s.latest_reading.water_level).toFixed(2) : null;
  const pulsing = usePulseOnChange(level ? `${level}|${s.status}` : s.status);

  return (
    <div className="river-card">
      <div className={`status-strip ${s.status}`} />
      <h3>{s.name}</h3>
      <div className="meta">{s.river_name} · {s.district}</div>
      <div className={`level ${pulsing ? "pulse-highlight" : ""}`}>
        {s.status === "no_feed" ? "No live feed" : `${level ?? "—"} m`}
      </div>
      <div className="meta">
        Danger ≥ {s.danger_level} m · Warning ≥ {s.warning_level} m · Watch ≥ {s.watch_level} m
      </div>
      <div className="meta">
        {s.status === "no_feed"
          ? "No sensor/operator has connected data yet — see README for POST /api/rivers/:id/readings"
          : <>
              <RelativeTime timestamp={s.latest_reading?.recorded_at} /> · source:{" "}
              {s.data_source === "iot_device" ? "IoT sensor" : s.data_source === "demo" ? "DEMO DATA" : s.data_source}
            </>}
      </div>
      <span className={`status-pill ${pulsing ? "pulse-highlight" : ""} ${s.status}`}>
        {s.status === "no_feed" ? "no live feed" : s.status}
      </span>
    </div>
  );
}

export default function RiverLevelPanel({ stations }: Props) {
  if (!stations.length) return <div className="empty-state">Waiting for river station data…</div>;

  return (
    <div className="card-grid">
      {stations.map((s) => (
        <StationCard s={s} key={s.id} />
      ))}
    </div>
  );
}
