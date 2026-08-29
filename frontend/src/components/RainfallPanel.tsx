import type { District } from "../types";
import RelativeTime from "./RelativeTime";
import { usePulseOnChange } from "../hooks/usePulseOnChange";

interface Props {
  districts: District[];
}

function DistrictCard({ d }: { d: District }) {
  const intensity = d.latest_reading ? Number(d.latest_reading.intensity_mm_hr) : 0;
  const level = intensity >= 50 ? "danger" : intensity >= 25 ? "warning" : intensity >= 10 ? "watch" : "normal";
  const pulsing = usePulseOnChange(intensity);

  return (
    <div className="river-card">
      <div className={`status-strip ${level}`} />
      <h3>{d.name}</h3>
      <div className="meta">District rainfall station</div>
      <div className={`level ${pulsing ? "pulse-highlight" : ""}`}>{intensity.toFixed(1)} mm/hr</div>
      <div className="meta">
        24h accumulated: {d.latest_reading ? Number(d.latest_reading.accumulated_24h_mm).toFixed(1) : "0.0"} mm
      </div>
      <div className="meta">
        <RelativeTime timestamp={d.latest_reading?.recorded_at} />
      </div>
      <span className={`status-pill ${level}`}>{level === "danger" ? "extreme" : level}</span>
    </div>
  );
}

export default function RainfallPanel({ districts }: Props) {
  if (!districts.length) return <div className="empty-state">Waiting for rainfall data…</div>;

  return (
    <div className="rain-grid">
      {districts.map((d) => (
        <DistrictCard d={d} key={d.id} />
      ))}
    </div>
  );
}
