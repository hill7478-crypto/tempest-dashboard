import dynamic from "next/dynamic";
import Head from "next/head";
import WeatherPanel from "../components/WeatherPanel";

// Leaflet touches `window`, so this must never render on the server.
const RadarMap = dynamic(() => import("../components/RadarMap"), {
  ssr: false,
  loading: () => <div className="map-container" />,
});

const LAT = Number(process.env.NEXT_PUBLIC_STATION_LAT || 39.8283);
const LON = Number(process.env.NEXT_PUBLIC_STATION_LON || -98.5795);
const LABEL = process.env.NEXT_PUBLIC_STATION_LABEL || "Weather station";

export default function Home() {
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

        <section className="panel">
          <div className="panel-header">
            <span>Current Conditions</span>
          </div>
          <WeatherPanel />
        </section>
      </div>
    </div>
  );
}
