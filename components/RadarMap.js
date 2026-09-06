import { useEffect, useRef, useState } from "react";

// RainViewer's free API: https://api.rainviewer.com/public/weather-maps.json
// Returns the host + a set of "past" frame paths (10-min intervals, ~2 hrs
// of history). As of their Jan 2026 free-tier changes: max zoom 7, single
// color scheme, PNG only, no forecast/nowcast on the free tier.
const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";
const TILE_SIZE = 256;
const COLOR_SCHEME = 2; // Universal Blue — RainViewer's documented default
const OPTIONS = "1_1"; // smooth: on, snow color differentiation: on
const RADAR_MAX_NATIVE_ZOOM = 7;

export default function RadarMap({ lat, lon, label }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const frameIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [frameLabel, setFrameLabel] = useState("Loading…");

  useEffect(() => {
    let L;
    let cancelled = false;

        async function init() {
      L = (await import("leaflet")).default;
      if (cancelled || !mapDivRef.current) return;

      // Leaflet's default marker icon paths break under Next.js/webpack
      // bundling — point them at a CDN instead so the pin actually renders.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapDivRef.current, {
        center: [lat, lon],
        zoom: 7,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: "abc",
        maxZoom: 19,
      }).addTo(map);

      L.marker([lat, lon]).addTo(map).bindPopup(label || "Weather station");

      await buildRadarLayers(L, map);
      startLoop();
    }

    async function buildRadarLayers(L, map) {
      try {
        const res = await fetch(RAINVIEWER_API);
        const data = await res.json();
        const frames = data?.radar?.past || [];

        // remove any previous layers (e.g. on a 5-min refresh)
        layersRef.current.forEach((l) => map.removeLayer(l));

        layersRef.current = frames.map((frame, i) =>
          L.tileLayer(
            `${data.host}${frame.path}/${TILE_SIZE}/{z}/{x}/{y}/${COLOR_SCHEME}/${OPTIONS}.png`,
            {
              opacity: 0,
              zIndex: 10,
              maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
              maxZoom: 19,
              attribution: "Radar: RainViewer",
            }
          ).addTo(map)
        );

        if (layersRef.current.length) {
          frameIndexRef.current = layersRef.current.length - 1;
          layersRef.current[frameIndexRef.current].setOpacity(0.65);
          setFrameLabel("Live");
        }
      } catch (err) {
        console.warn("RainViewer fetch failed:", err);
      }
    }

    function startLoop() {
      stopLoop();
      intervalRef.current = setInterval(() => {
        if (!playingRef.current) return;
        advanceFrame();
      }, 600);
    }

    function stopLoop() {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    function advanceFrame() {
      const layers = layersRef.current;
      if (!layers.length) return;
      const prev = frameIndexRef.current;
      let next = prev + 1;
      if (next >= layers.length) next = 0;
      layers[prev].setOpacity(0);
      layers[next].setOpacity(0.65);
      frameIndexRef.current = next;
      setFrameLabel(next === layers.length - 1 ? "Live" : `-${(layers.length - 1 - next) * 10} min`);
    }

    init();

    // RainViewer publishes a new frame roughly every 10 minutes.
    const refreshTimer = setInterval(() => {
      if (mapRef.current && L) buildRadarLayers(L, mapRef.current);
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      stopLoop();
      clearInterval(refreshTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  return (
    <>
      <div ref={mapDivRef} className="map-container" />
      <div style={{ padding: "8px 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <div className="radar-controls">
          <button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        </div>
        <span style={{ fontSize: 12, color: "#8b98a9" }}>{frameLabel}</span>
      </div>
    </>
  );
}