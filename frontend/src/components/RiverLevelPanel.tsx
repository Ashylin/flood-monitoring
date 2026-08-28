import type { Station } from "../types";

interface Props {
  stations: Station[];
}

function formatTime(ts?: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RiverLevelPanel({ stations }: Props) {
  if (!stations.length) return <div className="empty-state">Waiting for river station data…</div>;

  return (
    <div className="card-grid">
      {stations.map((s) => (
        <div className="river-card" key={s.id}>
          <div className={`status-strip ${s.status}`} />
          <h3>{s.name}</h3>
          <div className="meta">{s.river_name} · {s.district}</div>
          <div className="level">
            {s.status === "no_feed" ? "No live feed" : `${s.latest_reading ? Number(s.latest_reading.water_level).toFixed(2) : "—"} m`}
          </div>
          <div className="meta">
            Danger ≥ {s.danger_level} m · Warning ≥ {s.warning_level} m · Watch ≥ {s.watch_level} m
          </div>
          <div className="meta">
            {s.status === "no_feed"
              ? "No sensor/operator has connected data yet — see README for POST /api/rivers/:id/readings"
              : `Updated ${formatTime(s.latest_reading?.recorded_at)} · source: ${
                  s.data_source === "iot_device" ? "IoT sensor" : s.data_source === "demo" ? "DEMO DATA" : s.data_source
                }`}
          </div>
          <span className={`status-pill ${s.status}`}>{s.status === "no_feed" ? "no live feed" : s.status}</span>
        </div>
      ))}
    </div>
  );
}
