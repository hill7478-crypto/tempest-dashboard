// Serverless function: runs on Vercel, never in the browser.
// This is what keeps your Tempest access token secret — the client
// only ever talks to /api/tempest, never to swd.weatherflow.com directly.

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
    const url = `https://swd.weatherflow.com/swd/rest/observations/stn/${stationId}?token=${token}`;
    const upstream = await fetch(url);

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({
        error: `Tempest API returned ${upstream.status}`,
        detail: text,
      });
    }

    const data = await upstream.json();
    const fieldNames = data?.ob_fields;
    const rawObs = data?.obs?.[0];

    if (!fieldNames || !rawObs) {
      return res.status(502).json({
        error: "No observation data returned for this station.",
        detail: JSON.stringify(data).slice(0, 500),
      });
    }

    const idx = {};
    fieldNames.forEach((name, i) => {
      idx[name] = i;
    });
    const get = (name) => (name in idx ? rawObs[idx[name]] : null);

    const timestamp = get("timestamp");
    if (typeof timestamp !== "number") {
      return res.status(502).json({
        error: "No observation timestamp returned for this station.",
        detail: JSON.stringify(data).slice(0, 500),
      });
    }

    const pressureMb = get("station_pressure") ?? get("sea_level_pressure");
    const airTempC = get("air_temp");
    const precipMm = get("precip_accumulation");
    const precipTodayMm = get("local_day_precip_accumulation");

    const payload = {
      stationName: data.station_name || null,
      publicName: data.public_name || null,
      obsTimeEpoch: timestamp,
      temperature: {
        f: round1(cToF(airTempC)),
        c: round1(airTempC),
      },
      humidity: round1(get("rh")),
      wind: {
        avgMph: round1(msToMph(get("wind_avg"))),
        gustMph: round1(msToMph(get("wind_gust"))),
        lullMph: round1(msToMph(get("wind_lull"))),
        directionDeg: get("wind_dir"),
        directionCompass: degToCompass(get("wind_dir") || 0),
      },
      pressure:
        pressureMb != null
          ? { inHg: round2(mbToInHg(pressureMb)), mb: round1(pressureMb) }
          : null,
      rain: {
        recentIn: precipMm != null ? round3(mmToIn(precipMm)) : null,
        todayIn: precipTodayMm != null ? round2(mmToIn(precipTodayMm)) : null,
      },
      uvIndex: get("uv") != null ? round1(get("uv")) : null,
      solarRadiationWm2: get("solar_radiation"),
      illuminanceLux: get("illuminance"),
      lightning: {
        countRecent: get("strike_count") ?? null,
        lastDistanceKm: get("strike_distance") ?? null,
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