import type { District } from "../types";

interface Props {
  districts: District[];
}

export default function RainfallPanel({ districts }: Props) {
  if (!districts.length) return <div className="empty-state">Waiting for rainfall data…</div>;

  return (
    <div className="rain-grid">
      {districts.map((d) => {
        const intensity = d.latest_reading ? Number(d.latest_reading.intensity_mm_hr) : 0;
        const level = intensity >= 50 ? "danger" : intensity >= 25 ? "warning" : intensity >= 10 ? "watch" : "normal";
        return (
          <div className="river-card" key={d.id}>
            <div className={`status-strip ${level}`} />
            <h3>{d.name}</h3>
            <div className="meta">District rainfall station</div>
            <div className="level">{intensity.toFixed(1)} mm/hr</div>
            <div className="meta">
              24h accumulated: {d.latest_reading ? Number(d.latest_reading.accumulated_24h_mm).toFixed(1) : "0.0"} mm
            </div>
            <span className={`status-pill ${level}`}>{level === "danger" ? "extreme" : level}</span>
          </div>
        );
      })}
    </div>
  );
}
