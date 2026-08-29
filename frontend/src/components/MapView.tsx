import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FloodZone, Station } from "../types";

interface Props {
  stations: Station[];
  zones: FloodZone[];
}

// Matches the hex values behind --nominal/--caution/--critical/--inactive in
// index.css. Leaflet sets these as raw SVG attributes, not through a
// stylesheet, so CSS custom properties (var(--x)) won't resolve here —
// these have to be kept in sync with index.css by hand.
const STATION_COLOR: Record<Station["status"], string> = {
  normal: "#4ade9a",
  watch: "#e0a740",
  warning: "#e0a740",
  danger: "#e5534b",
  no_feed: "#5b6577",
  unknown: "#5b6577",
};

const ZONE_COLOR: Record<FloodZone["risk_level"], string> = {
  low: "#4ade9a",
  medium: "#e0a740",
  high: "#e0a740",
  critical: "#e5534b",
  insufficient_data: "#5b6577",
};

// Tamil Nadu centroid — fixed rather than computed from live data, since it
// shouldn't jump around as stations/zones update.
const TN_CENTER: [number, number] = [10.9, 78.3];

export default function MapView({ stations, zones }: Props) {
  return (
    <div className="map-shell">
      <MapContainer center={TN_CENTER} zoom={7} scrollWheelZoom={false} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((z) => (
          <CircleMarker
            key={`zone-${z.id}`}
            center={[z.latitude, z.longitude]}
            radius={10}
            pathOptions={{ color: ZONE_COLOR[z.risk_level], fillColor: ZONE_COLOR[z.risk_level], fillOpacity: 0.22, weight: 2, dashArray: "3 3" }}
          >
            <Popup>
              <strong>{z.name}</strong>
              <br />
              {z.district} · {z.risk_level === "insufficient_data" ? "insufficient data" : `${z.risk_level} risk`}
              <br />
              Population at risk: {z.population_at_risk.toLocaleString()}
            </Popup>
          </CircleMarker>
        ))}
        {stations.map((s) => (
          <CircleMarker
            key={`station-${s.id}`}
            center={[s.latitude, s.longitude]}
            radius={7}
            pathOptions={{ color: STATION_COLOR[s.status], fillColor: STATION_COLOR[s.status], fillOpacity: 0.85, weight: 1.5 }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.river_name} · {s.district}
              <br />
              {s.status === "no_feed"
                ? "No live feed"
                : `${s.latest_reading ? Number(s.latest_reading.water_level).toFixed(2) : "—"} m · ${s.status}`}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-dot" style={{ background: "#4ade9a" }} /> Normal / low</span>
        <span><i className="legend-dot" style={{ background: "#e0a740" }} /> Watch / warning / high</span>
        <span><i className="legend-dot" style={{ background: "#e5534b" }} /> Danger / critical</span>
        <span><i className="legend-dot" style={{ background: "#5b6577" }} /> No feed / insufficient data</span>
        <span className="map-legend-note">Solid dots = river stations · dashed rings = flood-prone zones</span>
      </div>
    </div>
  );
}
