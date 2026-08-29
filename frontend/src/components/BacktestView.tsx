import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { History } from "lucide-react";
import { api } from "../api/client";
import type { BacktestDetail, BacktestTimelinePoint } from "../types";
import { SkeletonBlock } from "./Skeleton";

function formatTick(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit" });
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: BacktestTimelinePoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--panel-border-strong)",
        borderRadius: 6,
        padding: "10px 12px",
        fontSize: 11.5,
        maxWidth: 280,
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: 4 }}>{new Date(p.time).toLocaleString()}</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Score {p.riskScore}/100 · {p.riskLevel === "insufficient_data" ? "insufficient data" : p.riskLevel}
      </div>
      <div style={{ color: "var(--text-dim)" }}>
        24h rainfall: {p.rain24h}mm ({p.category24h.replace("_", " ")})
      </div>
      <div style={{ color: "var(--text-faint)", marginTop: 4, lineHeight: 1.4 }}>{p.reasonSummary}</div>
    </div>
  );
}

export default function BacktestView() {
  const [data, setData] = useState<BacktestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const events = await api.getBacktestEvents();
        if (cancelled) return;
        if (!events.length) {
          setError(
            "No historical events seeded yet. The seed step fetches real hourly rainfall from Open-Meteo's archive on server " +
              "boot and requires outbound internet access — check backend logs for [seed-historical] if this persists."
          );
          return;
        }
        const detail = await api.getBacktest(events[0].slug);
        if (!cancelled) setData(detail);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="app-shell">
        <SkeletonBlock height={40} style={{ marginBottom: 20 }} />
        <SkeletonBlock height={300} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-shell empty-state">
        {error || "No historical backtest data available."}
      </div>
    );
  }

  const { event, dataSource, timeline, summary } = data;
  const chartData = timeline.map((p) => ({ ...p, ts: new Date(p.time).getTime() }));
  const documentedPeakTs = new Date(`${event.peakDate}T12:00:00Z`).getTime();

  return (
    <div className="app-shell">
      <div className="historical-banner">
        <History size={14} strokeWidth={2} />
        HISTORICAL BACKTEST — real recorded data, replayed after the fact. Not live. Not simulated.
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{event.label}</h2>
        <div className="meta" style={{ marginBottom: 12 }}>Documented flood peak: {event.peakDate}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
          <div>
            <div className="label" style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Peak 24h rainfall
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>
              {event.documented.peak24hRainfallMm.cityAverage}mm city avg ({event.documented.peak24hRainfallMm.stationRange[0]}–
              {event.documented.peak24hRainfallMm.stationRange[1]}mm range)
            </div>
            <a href={event.documented.peak24hRainfallMm.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5 }}>
              {event.documented.peak24hRainfallMm.source}
            </a>
          </div>
          <div>
            <div className="label" style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Monthly total ({event.documented.monthlyTotalRainfallMm.station})
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{event.documented.monthlyTotalRainfallMm.value}mm</div>
            <a href={event.documented.monthlyTotalRainfallMm.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5 }}>
              {event.documented.monthlyTotalRainfallMm.source}
            </a>
          </div>
          <div>
            <div className="label" style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Human impact
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{event.documented.deaths} deaths</div>
            {event.documented.economicLossUsd && (
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>${event.documented.economicLossUsd}</div>
            )}
          </div>
        </div>
        {event.documented.note && <div className="meta" style={{ fontStyle: "italic" }}>{event.documented.note}</div>}
      </div>

      <div className="panel" style={{ marginBottom: 20, borderLeft: "3px solid var(--accent)" }}>
        {summary.firstHeavyOrAbovePoint && summary.hoursFromFirstHeavyRainToDocumentedPeak !== null ? (
          <strong>
            This replay's rainfall first reached IMD "heavy" 24h intensity or above at{" "}
            {new Date(summary.firstHeavyOrAbovePoint.time).toLocaleString()} (score {summary.firstHeavyOrAbovePoint.riskScore}/100,{" "}
            "{summary.firstHeavyOrAbovePoint.riskLevel}") —{" "}
            {summary.hoursFromFirstHeavyRainToDocumentedPeak > 0
              ? `${summary.hoursFromFirstHeavyRainToDocumentedPeak} hours before`
              : `${Math.abs(summary.hoursFromFirstHeavyRainToDocumentedPeak)} hours after`}{" "}
            the documented flood peak.
          </strong>
        ) : (
          <strong>
            This replay's rainfall never reached IMD "heavy" 24h intensity (peak was {summary.peakScorePoint?.category24h.replace("_", " ")},{" "}
            {summary.modeledVsDocumented.modeledPeak24hMm}mm/24h) — the engine correctly stayed at low risk throughout this dataset. No
            meaningful lead-time claim can honestly be made from this specific reanalysis replay for this event; see the note below.
          </strong>
        )}
        <div className="meta" style={{ marginTop: 8 }}>{summary.maxAttainableLevelNote}</div>
      </div>

      <div className="panel" style={{ marginBottom: 20, borderLeft: "3px solid var(--caution)" }}>
        <strong>Modeled vs. documented rainfall intensity</strong>
        <div className="meta" style={{ marginTop: 8 }}>
          This replay's peak 24h rainfall (from Open-Meteo/ERA5): <strong style={{ color: "var(--text)" }}>{summary.modeledVsDocumented.modeledPeak24hMm}mm</strong>.
          Documented real-gauge peak 24h rainfall: <strong style={{ color: "var(--text)" }}>{summary.modeledVsDocumented.documentedPeak24hCityAvgMm}mm city average</strong>{" "}
          (station range {summary.modeledVsDocumented.documentedPeak24hStationRangeMm[0]}–{summary.modeledVsDocumented.documentedPeak24hStationRangeMm[1]}mm).
        </div>
        <div className="meta" style={{ marginTop: 8 }}>{summary.modeledVsDocumented.note}</div>
      </div>

      <div className="section">
        <div className="section-title">Risk score timeline (replayed through the live risk engine)</div>
        <div className="panel">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(ts: number) => formatTick(new Date(ts).toISOString())}
                stroke="var(--text-faint)"
                tick={{ fontSize: 10.5, fill: "var(--text-dim)" }}
                minTickGap={40}
              />
              <YAxis domain={[0, 100]} stroke="var(--text-faint)" tick={{ fontSize: 10.5, fill: "var(--text-dim)" }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={20} stroke="var(--caution)" strokeDasharray="4 4" label={{ value: "medium threshold", position: "insideTopLeft", fill: "var(--caution)", fontSize: 10 }} />
              <ReferenceLine y={45} stroke="var(--critical)" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "high threshold (unreachable — no river data)", position: "insideTopLeft", fill: "var(--critical)", fontSize: 10 }} />
              <ReferenceLine y={70} stroke="var(--critical)" strokeDasharray="2 2" strokeOpacity={0.3} label={{ value: "critical threshold (unreachable — no river data)", position: "insideBottomLeft", fill: "var(--critical)", fontSize: 10 }} />
              <ReferenceLine
                x={documentedPeakTs}
                stroke="var(--accent)"
                strokeWidth={2}
                label={{ value: "documented flood peak", position: "top", fill: "var(--accent)", fontSize: 10.5, fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="riskScore" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="footer-note">
        Hourly rainfall replay: {dataSource.hourlyReplay}. Ground-truth peak/impact figures: {dataSource.groundTruthFigures}
      </div>
    </div>
  );
}
