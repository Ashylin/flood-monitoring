import { useState } from "react";
import Dashboard from "./components/Dashboard";
import BacktestView from "./components/BacktestView";

type View = "live" | "backtest";

export default function App() {
  const [view, setView] = useState<View>("live");

  return (
    <>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "10px 24px 0", display: "flex", justifyContent: "flex-end" }}>
        <div className="view-tabs">
          <button className={view === "live" ? "active" : ""} onClick={() => setView("live")}>
            Live dashboard
          </button>
          <button className={view === "backtest" ? "active" : ""} onClick={() => setView("backtest")}>
            Historical backtest
          </button>
        </div>
      </div>
      {view === "live" ? <Dashboard /> : <BacktestView />}
    </>
  );
}
