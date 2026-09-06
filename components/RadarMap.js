import { useEffect, useRef, useState } from "react";

// Single-site NEXRAD Level 3 imagery from IEM — the same underlying
// product type Gibson Ridge / RadarScope display by default (N0Q =
// base reflectivity, lowest tilt). Site BMX = Birmingham, AL, which
// covers the Homewood area. To point this at a different radar site
// later, change RADAR_SITE below (find codes at weather.gov/radar).
const RADAR_SITE = "BMX";
const RADAR_PRODUCT = "N0Q";
const REFRESH_MS = 2 * 60 * 1000; // IEM ingests a new scan every ~2-5 min

function tileUrl(cacheBuster) {
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${RADAR_SITE}-${RADAR_PRODUCT}-0/{z}/{x}/{y}.png?t=${cacheBuster}`;
}

export default function RadarMap({ lat, lon, label }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

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
        zoom: 8,
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

      refreshRadarLayer(L, map);
    }

    function refreshRadarLayer(L, map) {
      const cacheBuster = Date.now();
      const newLayer = L.tileLayer(tileUrl(cacheBuster), {
        opacity: 0.7,
        zIndex: 10,
        attribution: `Radar: IEM (single-site ${RADAR_SITE} ${RADAR_PRODUCT})`,
      });

      newLayer.addTo(map);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      layerRef.current = newLayer;
      setLastRefreshed(new Date());
    }

    init();

    const refreshTimer = setInterval(() => {
      if (mapRef.current && L) refreshRadarLayer(L, mapRef.current);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return (
    <>
      <div ref={mapDivRef} className="map-container" />
      <div style={{ padding: "8px 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#8b98a9" }}>
          {RADAR_SITE} base reflectivity
          {lastRefreshed ? ` · updated ${lastRefreshed.toLocaleTimeString()}` : ""}
        </span>
      </div>
    </>
  );
}