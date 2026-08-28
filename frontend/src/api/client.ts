import type { Alert, ApiEnvelope, District, FloodZone, Station } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const json: ApiEnvelope<T> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json.data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: { id: number; email: string; role: string }; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, role: "viewer" | "operator") =>
    request<{ user: { id: number; email: string; role: string }; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  getStations: () => request<Station[]>("/rivers"),
  getStationHistory: (id: number, limit = 60) =>
    request<{ water_level: string; flow_rate: string; recorded_at: string }[]>(
      `/rivers/${id}/history?limit=${limit}`
    ),
  getRainfall: () => request<District[]>("/rainfall"),
  getZones: () => request<FloodZone[]>("/zones"),
  getAlerts: (status?: string) => request<Alert[]>(`/alerts${status ? `?status=${status}` : ""}`),
  getHealth: () => request<{ status: string; db: boolean; redis: boolean; demo_mode: boolean; uptime_s: number }>("/health"),
  updateAlertStatus: (id: number, status: string, token: string) =>
    request<Alert>(`/alerts/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    }),
  createAlert: (
    payload: { title: string; message: string; severity: string; zone_id?: number; station_id?: number },
    token: string
  ) =>
    request<Alert>("/alerts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
};
