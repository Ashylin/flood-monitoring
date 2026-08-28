import { useState, FormEvent, CSSProperties } from "react";
import { useAuth } from "../auth/AuthContext";

export default function LoginForm({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"viewer" | "operator">("operator");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, role);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#121b2e",
          border: "1px solid #1f2c47",
          borderRadius: 14,
          padding: 24,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e7edf7" }}>
          {mode === "login" ? "Operator / Admin Login" : "Register"}
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />

        {mode === "register" && (
          <select value={role} onChange={(e) => setRole(e.target.value as "viewer" | "operator")} style={inputStyle}>
            <option value="operator">Operator (can submit readings, alerts)</option>
            <option value="viewer">Viewer (read-only)</option>
          </select>
        )}

        {error && <div style={{ color: "#e2483d", fontSize: 12 }}>{error}</div>}

        <button type="submit" disabled={busy} style={primaryButtonStyle}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Register"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={linkButtonStyle}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
        </button>

        <button type="button" onClick={onClose} style={linkButtonStyle}>
          Cancel
        </button>
      </form>
    </div>
  );
}

const inputStyle: CSSProperties = {
  background: "#0b1220",
  border: "1px solid #1f2c47",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#e7edf7",
  fontSize: 13,
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  background: "#3ea6ff",
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#0b1220",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const linkButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#93a3bd",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
};
