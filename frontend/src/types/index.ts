export type StationStatus = "normal" | "watch" | "warning" | "danger" | "no_feed" | "unknown";
export type RiskLevel = "low" | "medium" | "high" | "critical" | "insufficient_data";
export type AlertSeverity = "advisory" | "watch" | "warning" | "emergency";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface RiverReading {
  id: number;
  station_id: number;
  water_level: string;
  flow_rate: string;
  recorded_at: string;
}

export interface Station {
  id: number;
  name: string;
  river_name: string;
  district: string;
  latitude: number;
  longitude: number;
  danger_level: string;
  warning_level: string;
  watch_level: string;
  data_source: "live_feed" | "manual" | "iot_device" | "demo" | "unavailable";
  latest_reading: RiverReading | null;
  status: StationStatus;
}

export interface RainfallReading {
  id: number;
  district_id: number;
  intensity_mm_hr: string;
  accumulated_24h_mm: string;
  recorded_at: string;
}

export interface District {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  latest_reading: RainfallReading | null;
}

export interface FloodZone {
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  population_at_risk: number;
  station_id: number | null;
  station_name?: string;
  river_name?: string;
  risk_level: RiskLevel;
  risk_score?: number | null;
  risk_reason?: string | null;
  data_freshness?: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  zone_id: number | null;
  station_id: number | null;
  zone_name?: string;
  station_name?: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  created_by: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface BacktestEventSummary {
  slug: string;
  label: string;
  peakDate: string;
}

export interface BacktestTimelinePoint {
  time: string;
  precipitationMm: number;
  rain6h: number;
  rain24h: number;
  category24h: "negligible" | "light" | "moderate" | "heavy" | "very_heavy" | "extremely_heavy";
  riskScore: number;
  riskLevel: RiskLevel;
  reasonSummary: string;
}

export interface BacktestDetail {
  event: {
    slug: string;
    label: string;
    peakDate: string;
    documented: {
      peak24hRainfallMm: { cityAverage: number; stationRange: [number, number]; source: string; url: string };
      monthlyTotalRainfallMm: { value: number; station: string; source: string; url: string };
      deaths: number;
      economicLossUsd?: string;
      note?: string;
    };
  };
  dataSource: { hourlyReplay: string; groundTruthFigures: string };
  timeline: BacktestTimelinePoint[];
  summary: {
    peakScorePoint: BacktestTimelinePoint | null;
    firstHeavyOrAbovePoint: BacktestTimelinePoint | null;
    hoursFromFirstHeavyRainToDocumentedPeak: number | null;
    maxAttainableLevelNote: string;
    modeledVsDocumented: {
      modeledPeak24hMm: number | null;
      documentedPeak24hCityAvgMm: number;
      documentedPeak24hStationRangeMm: [number, number];
      note: string;
    };
  };
}
