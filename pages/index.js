import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect } from "react";
import WeatherPanel from "../components/WeatherPanel";
import StatsPanel from "../components/StatsPanel";

// Leaflet touches `window`, so this must never render on the server.
const RadarMap = dynamic(() => import("../components/RadarMap"), {
  ssr: false,
  loading: () => <div className="map-container" />,
});

const LAT = Number(process.env.NEXT_PUBLIC_STATION_LAT || 39.8283);
const LON = Number(process.env.NEXT_PUBLIC_STATION_LON || -98.5795);
const LABEL = process.env.NEXT_PUBLIC_STATION_LABEL || "Weather station";

export default function Home() {
  useEffect(() => {
    let wakeLock = null;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        // Not fatal — just means this browser/device doesn't support it,
        // or the tab wasn't visible/focused when we asked.
        console.warn("Wake Lock not active:", err);
      }
    }

    requestWakeLock();

    // The lock is automatically released when the tab is hidden
    // (e.g. screen off, switched tabs) — re-request it once it's
    // visible again so the screen stays on continuously.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="page">
      <Head>
        <title>Tempest Weather &amp; Radar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="header">
        <h1>{LABEL}</h1>
        <span className="sub">Live conditions &amp; NEXRAD radar</span>
      </header>

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <span>Radar</span>
          </div>
          <RadarMap lat={LAT} lon={LON} label={LABEL} />
        </section>

        <div className="right-col">
          <section className="panel">
            <div className="panel-header">
              <span>Current Conditions</span>
            </div>
            <WeatherPanel />
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>High / Low / Rain</span>
            </div>
            <StatsPanel />
          </section>
        </div>
      </div>
    </div>
  );
}