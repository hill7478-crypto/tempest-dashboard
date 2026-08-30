import { useEffect, useState } from "react";

const POLL_MS = 60 * 1000;

export default function WeatherPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/tempest");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load weather data.");
          return;
        }
        setError(null);
        setData(json);
      } catch (e) {
        if (!cancelled) setError("Network error loading weather data.");
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
    return <div className="weather-body">Loading current conditions&hellip;</div>;
  }

  const obsAgeMin = Math.round((Date.now() / 1000 - data.obsTimeEpoch) / 60);

  return (
    <div className="weather-body">
      <div className="temp-hero">
        <span className="value">{Math.round(data.temperature.f)}</span>
        <span className="unit">&deg;F</span>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Humidity</div>
          <div className="value">{Math.round(data.humidity)}%</div>
        </div>
        <div className="stat">
          <div className="label">Wind</div>
          <div className="value">
            {Math.round(data.wind.avgMph)} mph {data.wind.directionCompass}
          </div>
        </div>
        <div className="stat">
          <div className="label">Gust</div>
          <div className="value">{Math.round(data.wind.gustMph)} mph</div>
        </div>
        {data.pressure && (
          <div className="stat">
            <div className="label">Pressure</div>
            <div className="value">{data.pressure.inHg.toFixed(2)} inHg</div>
          </div>
        )}
        {data.rain.todayIn != null && (
          <div className="stat">
            <div className="label">Rain Today</div>
            <div className="value">{data.rain.todayIn.toFixed(2)} in</div>
          </div>
        )}
        {data.uvIndex != null && (
          <div className="stat">
            <div className="label">UV Index</div>
            <div className={"value" + (data.uvIndex >= 8 ? " warn" : "")}>
              {data.uvIndex}
            </div>
          </div>
        )}
        {data.solarRadiationWm2 != null && (
          <div className="stat">
            <div className="label">Solar Radiation</div>
            <div className="value">{data.solarRadiationWm2} W/m&sup2;</div>
          </div>
        )}
        <div className="stat">
          <div className="label">Lightning (last hr)</div>
          <div className={"value" + ((data.lightning.countLast1hr || 0) > 0 ? " alert" : "")}>
            {data.lightning.countLast1hr
              ? `${data.lightning.countLast1hr} strikes${data.lightning.lastDistanceKm ? ` @ ~${data.lightning.lastDistanceKm} km` : ""}`
              : "None"}
          </div>
        </div>
        <div className="stat">
          <div className="label">Observation Age</div>
          <div className="value">{obsAgeMin <= 0 ? "just now" : `${obsAgeMin} min ago`}</div>
        </div>
      </div>

      <div className="footer-note">
        Station: {data.publicName || data.stationName || "—"} &middot; Last obs{" "}
        {new Date(data.obsTimeEpoch * 1000).toLocaleTimeString()}
      </div>
    </div>
  );
}