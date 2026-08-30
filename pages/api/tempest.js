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
    const obs = data?.obs?.[0];

    if (!obs || typeof obs.timestamp !== "number") {
      return res.status(502).json({
        error: "No observation data returned for this station.",
        detail: JSON.stringify(data).slice(0, 500),
      });
    }

    const pressureMb = obs.barometric_pressure ?? obs.sea_level_pressure ?? obs.station_pressure;

    const payload = {
      stationName: data.station_name || null,
      publicName: data.public_name || null,
      obsTimeEpoch: obs.timestamp,
      temperature: {
        f: round1(cToF(obs.air_temperature)),
        c: round1(obs.air_temperature),
      },
      humidity: round1(obs.relative_humidity),
      wind: {
        avgMph: round1(msToMph(obs.wind_avg)),
        gustMph: round1(msToMph(obs.wind_gust)),
        lullMph: round1(msToMph(obs.wind_lull)),
        directionDeg: obs.wind_direction,
        directionCompass: degToCompass(obs.wind_direction || 0),
      },
      pressure:
        pressureMb != null
          ? { inHg: round2(mbToInHg(pressureMb)), mb: round1(pressureMb) }
          : null,
      rain: {
        recentIn: obs.precip != null ? round3(mmToIn(obs.precip)) : null,
        todayIn:
          obs.precip_accum_local_day != null
            ? round2(mmToIn(obs.precip_accum_local_day))
            : null,
      },
      uvIndex: obs.uv != null ? round1(obs.uv) : null,
      solarRadiationWm2: obs.solar_radiation ?? null,
      illuminanceLux: obs.brightness ?? null,
      lightning: {
        countLast1hr: obs.lightning_strike_count_last_1hr ?? null,
        countLast3hr: obs.lightning_strike_count_last_3hr ?? null,
        lastDistanceKm: obs.lightning_strike_last_distance ?? null,
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