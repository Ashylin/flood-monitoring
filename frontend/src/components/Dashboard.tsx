import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Waves, MapPinned, CloudRain, Map as MapIcon } from "lucide-react";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../auth/AuthContext";
import type { Alert, District, FloodZone, RiverReading, Station } from "../types";
import Header from "./Header";
import StatCard from "./StatCard";
import RiverLevelPanel from "./RiverLevelPanel";
import RainfallPanel from "./RainfallPanel";
import FloodZonePanel from "./FloodZonePanel";
import AlertsPanel from "./AlertsPanel";
import LoginForm from "./LoginForm";
import { SkeletonStatGrid, SkeletonCardGrid, SkeletonBlock } from "./Skeleton";
import MapView from "./MapView";
import HeroBanner from "./HeroBanner";

function computeStationStatus(reading: RiverReading | null, station: Station): Station["status"] {
  if (station.data_source === "unavailable" || !reading) return "no_feed";
  const level = Number(reading.water_level);
  if (level >= Number(station.danger_level)) return "danger";
  if (level >= Number(station.warning_level)) return "warning";
  if (level >= Number(station.watch_level)) return "watch";
  return "normal";
}

export default function Dashboard() {
  const { socket, connectionState } = useSocket();
  const { user, token, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [zones, setZones] = useState<FloodZone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function load(isFirstAttempt: boolean) {
      try {
        if (isFirstAttempt) setLoading(true);
        const [s, d, z, a] = await Promise.all([
          api.getStations(),
          api.getRainfall(),
          api.getZones(),
          api.getAlerts(),
        ]);
        if (cancelled) return;
        setStations(s);
        setDistricts(d);
        setZones(z);
        setAlerts(a);
        setError(null);
        api.getHealth().then((h) => !cancelled && setDemoMode(h.demo_mode)).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        // Genuinely retry on a fixed interval — the "retrying automatically"
        // message in the UI has to actually be true, not just reassuring.
        retryTimer = setTimeout(() => load(false), 8000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load(true);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onRiverUpdate = ({ station_id, reading }: { station_id: number; reading: RiverReading }) => {
      setStations((prev) =>
        prev.map((s) =>
          s.id === station_id ? { ...s, latest_reading: reading, status: computeStationStatus(reading, s) } : s
        )
      );
    };

    const onRainfallUpdate = ({ district_id, reading }: { district_id: number; reading: District["latest_reading"] }) => {
      setDistricts((prev) => prev.map((d) => (d.id === district_id ? { ...d, latest_reading: reading } : d)));
    };

    const onZoneUpdate = (zone: FloodZone) => {
      setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, ...zone } : z)));
    };

    const onAlertNew = (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 200));
    };

    const onAlertUpdated = (alert: Alert) => {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
    };

    socket.on("river:update", onRiverUpdate);
    socket.on("rainfall:update", onRainfallUpdate);
    socket.on("zone:update", onZoneUpdate);
    socket.on("alert:new", onAlertNew);
    socket.on("alert:updated", onAlertUpdated);

    return () => {
      socket.off("river:update", onRiverUpdate);
      socket.off("rainfall:update", onRainfallUpdate);
      socket.off("zone:update", onZoneUpdate);
      socket.off("alert:new", onAlertNew);
      socket.off("alert:updated", onAlertUpdated);
    };
  }, [socket]);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === "active"), [alerts]);
  const criticalZones = useMemo(() => zones.filter((z) => z.risk_level === "critical" || z.risk_level === "high"), [zones]);
  const populationAtRisk = useMemo(
    () => criticalZones.reduce((sum, z) => sum + (z.population_at_risk || 0), 0),
    [criticalZones]
  );
  const stationsInAlert = useMemo(
    () => stations.filter((s) => s.status === "warning" || s.status === "danger").length,
    [stations]
  );

  async function handleAck(id: number) {
    if (!token) return setShowLogin(true);
    try {
      await api.updateAlertStatus(id, "acknowledged", token);
    } catch (err) {
      alert(`Could not acknowledge alert: ${(err as Error).message}`);
    }
  }

  async function handleResolve(id: number) {
    if (!token) return setShowLogin(true);
    try {
      await api.updateAlertStatus(id, "resolved", token);
    } catch (err) {
      alert(`Could not resolve alert: ${(err as Error).message}`);
    }
  }

  return (
    <div className="app-shell">
      <Header
        connectionState={connectionState}
        activeAlerts={activeAlerts.length}
        userEmail={user?.email}
        userRole={user?.role}
        onLoginClick={() => setShowLogin(true)}
        onLogoutClick={logout}
      />
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}

      <HeroBanner />

      {demoMode && (
        <div
          style={{
            background: "var(--caution-dim)",
            border: "1px solid var(--caution)",
            color: "var(--caution)",
            borderRadius: 6,
            padding: "9px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Demo mode active — river readings on stations without a real feed are simulated for presentation purposes only
        </div>
      )}

      {error && (
        <div className="inline-error-banner">
          Could not reach the backend API ({error}) — retrying every few seconds. Data below reflects the last successful fetch.
        </div>
      )}

      {loading ? (
        <SkeletonStatGrid />
      ) : (
        <div className="stat-grid">
          <StatCard label="Monitoring Stations" value={String(stations.length)} sub={`${stationsInAlert} in warning/danger`} />
          <StatCard label="Districts Tracked" value={String(districts.length)} />
          <StatCard label="High / Critical Zones" value={String(criticalZones.length)} sub={`${populationAtRisk.toLocaleString()} people at risk`} />
          <StatCard label="Active Alerts" value={String(activeAlerts.length)} sub={`${alerts.length} total logged`} />
        </div>
      )}

      <div className="section">
        <div className="section-title"><MapIcon size={13} strokeWidth={2} />Station &amp; zone map</div>
        {loading ? (
          <div className="map-shell"><SkeletonBlock width="100%" height={420} /></div>
        ) : (
          <MapView stations={stations} zones={zones} />
        )}
      </div>

      <div className="section">
        <div className="section-title"><AlertTriangle size={13} strokeWidth={2} />Emergency alerts</div>
        {loading ? (
          <div className="panel"><SkeletonCardGrid count={2} /></div>
        ) : (
          <div className="panel">
            <AlertsPanel alerts={alerts.filter((a) => a.status !== "resolved")} token={token} onAck={handleAck} onResolve={handleResolve} />
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title"><Waves size={13} strokeWidth={2} />River water levels</div>
        {loading ? <SkeletonCardGrid count={6} /> : <RiverLevelPanel stations={stations} />}
      </div>

      <div className="section">
        <div className="section-title"><MapPinned size={13} strokeWidth={2} />Flood-prone zone risk</div>
        {loading ? <SkeletonCardGrid count={5} /> : <FloodZonePanel zones={zones} />}
      </div>

      <div className="section">
        <div className="section-title"><CloudRain size={13} strokeWidth={2} />Rainfall intensity</div>
        {loading ? <SkeletonCardGrid count={8} /> : <RainfallPanel districts={districts} />}
      </div>

      <div className="footer-note">
        River, rainfall, and zone data stream live over WebSocket. Backend simulator emits new readings every 8–10s.
      </div>
    </div>
  );
}
