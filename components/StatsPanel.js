import { useEffect, useState } from "react";

const POLL_MS = 10 * 60 * 1000; // stats change slowly, poll every 10 min

export default function StatsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/tempest-stats");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load stats.");
          return;
        }
        setError(null);
        setData(json);
      } catch (e) {
        if (!cancelled) setError("Network error loading stats.");
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <div className="error-box">{error}</div>;
  }

  if (!data) {
    return <div className="weather-body">Loading stats&hellip;</div>;
  }

  const rows = [
    { label: "Today", stat: data.today },
    { label: "This Week", stat: data.thisWeek },
    { label: "This Month", stat: data.thisMonth },
  ];

  return (
    <div className="weather-body">
      <div className="stats-section">
        <div className="stats-section-title">Rain</div>
        <div className="stats-table">
          <div className="stats-row stats-header">
            <div></div>
            <div>Total</div>
          </div>
          {rows.map(({ label, stat }) => (
            <div className="stats-row stats-row-2col" key={label}>
              <div className="stats-label">{label}</div>
              <div>{stat?.rainIn != null ? `${stat.rainIn.toFixed(2)} in` : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Wind</div>
        <div className="stats-table">
          <div className="stats-row stats-header">
            <div></div>
            <div>High (gust)</div>
            <div>Low (lull)</div>
          </div>
          {rows.map(({ label, stat }) => (
            <div className="stats-row" key={label}>
              <div className="stats-label">{label}</div>
              <div>{stat?.windHighMph != null ? `${Math.round(stat.windHighMph)} mph` : "—"}</div>
              <div>{stat?.windLowMph != null ? `${Math.round(stat.windLowMph)} mph` : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Temperature</div>
        <div className="stats-table">
          <div className="stats-row stats-header">
            <div></div>
            <div>High</div>
            <div>Low</div>
          </div>
          {rows.map(({ label, stat }) => (
            <div className="stats-row" key={label}>
              <div className="stats-label">{label}</div>
              <div>{stat?.highF != null ? `${Math.round(stat.highF)}°F` : "—"}</div>
              <div>{stat?.lowF != null ? `${Math.round(stat.lowF)}°F` : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}