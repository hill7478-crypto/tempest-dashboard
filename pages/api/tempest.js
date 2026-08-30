// Serverless function: runs on Vercel, never in the browser.
// This is what keeps your Tempest access token secret — the client
// only ever talks to /api/tempest, never to swd.weatherflow.com directly.

const OBS_ST_FIELDS = [
  "epoch",
  "wind_lull_ms",
  "wind_avg_ms",
  "wind_gust_ms",
  "wind_direction_deg",
  "wind_sample_interval_s",
  "station_pressure_mb",
  "air_temperature_c",
  "relative_humidity_pct",
  "illuminance_lux",
  "uv_index",
  "solar_radiation_wm2",
  "rain_accum_last_min_mm",
  "precipitation_type",
  "lightning_strike_avg_distance_km",
  "lightning_strike_count",
  "battery_volts",
  "report_interval_min",
];

function cToF(c) {
  return c * 9 / 5 + 32;
}
function msToMph(ms) {
  return ms * 2.23694;
}
function mbToInHg(mb) {
  return mb * 0.0295301;
}
function mmToIn(mm) {
  return mm * 0.0393701;
}
function degToCompass(deg) {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default async function handler(req, res) {
  const token = process.env.TEMPEST_TOKEN;
  const stationId = process.env.TEMPEST_STATION_ID;

  if (!token || !stationId) {
    return res.status(500).json({
      error:
        "Server is missing TEMPEST_TOKEN or TEMPEST_STATION_ID environment variables.",
    });
  }

  try {
    const url = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`;
    const upstream = await fetch(url);

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({
        error: `Tempest API returned ${upstream.status}`,
        detail: text,
      });
    }

    const data = await upstream.json();
    const rawObs = data?.obs?.[0];

    if (!rawObs) {
      return res.status(502).json({ error: "No observation data returned." });
    }

    const raw = {};
    OBS_ST_FIELDS.forEach((name, i) => {
      raw[name] = rawObs[i];
    });

    const payload = {
      stationName: data.station_name || null,
      publicName: data.public_name || null,
      obsTimeEpoch: raw.epoch,
      obsTimeIso: new Date(raw.epoch * 1000).toISOString(),
      temperature: {
        f: round1(cToF(raw.air_temperature_c)),
        c: round1(raw.air_temperature_c),
      },
      humidity: round1(raw.relative_humidity_pct),
      wind: {
        avgMph: round1(msToMph(raw.wind_avg_ms)),
        gustMph: round1(msToMph(raw.wind_gust_ms)),
        lullMph: round1(msToMph(raw.wind_lull_ms)),
        directionDeg: raw.wind_direction_deg,
        directionCompass: degToCompass(raw.wind_direction_deg || 0),
      },
      pressure: {
        inHg: round2(mbToInHg(raw.station_pressure_mb)),
        mb: round1(raw.station_pressure_mb),
      },
      rain: {
        lastMinuteIn: round3(mmToIn(raw.rain_accum_last_min_mm)),
        precipitationType: ["none", "rain", "hail", "rain+hail"][
          raw.precipitation_type
        ] || "unknown",
      },
      uvIndex: round1(raw.uv_index),
      solarRadiationWm2: raw.solar_radiation_wm2,
      illuminanceLux: raw.illuminance_lux,
      lightning: {
        strikeCount: raw.lightning_strike_count,
        avgDistanceKm: raw.lightning_strike_avg_distance_km,
      },
      battery: {
        volts: raw.battery_volts,
        // rough health flag — Tempest devices run fine down to ~2.0V but
        // WeatherFlow recommends checking things out below ~2.35V
        low: raw.battery_volts < 2.35,
      },
      fetchedAtIso: new Date().toISOString(),
    };

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}

function round1(n) {
  return typeof n === "number" ? Math.round(n * 10) / 10 : n;
}
function round2(n) {
  return typeof n === "number" ? Math.round(n * 100) / 100 : n;
}
function round3(n) {
  return typeof n === "number" ? Math.round(n * 1000) / 1000 : n;
}
