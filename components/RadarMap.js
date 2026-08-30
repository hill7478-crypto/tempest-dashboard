import { useEffect, useRef, useState } from "react";

// IEM (Iowa Environmental Mesonet) serves free, cache-friendly NEXRAD
// composite tiles. "900913" = current, "900913-mNNm" = NN minutes ago.
// This is the same public tile service used by many US weather sites.
const FRAME_OFFSETS = [
  "900913-m50m",
  "900913-m45m",
  "900913-m40m",
  "900913-m35m",
  "900913-m30m",
  "900913-m25m",
  "900913-m20m",
  "900913-m15m",
  "900913-m10m",
  "900913-m05m",
  "900913", // current
];

const TILE_URL = (frame) =>
  `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-${frame}/{z}/{x}/{y}.png`;

export default function RadarMap({ lat, lon, label }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const frameIndexRef = useRef(FRAME_OFFSETS.length - 1);
  const intervalRef = useRef(null);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [frameLabel, setFrameLabel] = useState("Live");

  useEffect(() => {
    let L;
    let cancelled = false;

    async function init() {
      L = (await import("leaflet")).default;
      if (cancelled || !mapDivRef.current) return;

      const map = L.map(mapDivRef.current, {
        center: [lat, lon],
        zoom: 7,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      buildRadarLayers(L, map);

      L.marker([lat, lon]).addTo(map).bindPopup(label || "Weather station");

      startLoop();
    }

    function buildRadarLayers(L, map) {
      // remove old ones if rebuilding
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = FRAME_OFFSETS.map((frame, i) =>
        L.tileLayer(TILE_URL(frame), {
          opacity: i === frameIndexRef.current ? 0.65 : 0,
          zIndex: 10,
          attribution:
            "Radar: Iowa Environmental Mesonet (IEM) / NEXRAD composite",
        }).addTo(map)
      );
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
      // pause a little longer on the most recent frame
      if (next >= layers.length) next = 0;
      layers[prev].setOpacity(0);
      layers[next].setOpacity(0.65);
      frameIndexRef.current = next;
      setFrameLabel(next === layers.length - 1 ? "Live" : `-${(layers.length - 1 - next) * 5} min`);
    }

    init();

    // Refresh tile timestamps every 5 minutes so the loop stays current.
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

  // keep the running interval aware of play/pause without re-init
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
