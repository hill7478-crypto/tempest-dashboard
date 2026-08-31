// Serverless function: fetches Tempest's pre-computed day/week/month
// stats buckets and returns just what the dashboard needs (high/low
// temp + rain total for today, this week, and this month).
//
// Tempest's stats/station endpoint returns stats_day / stats_week /
// stats_month arrays that all share the same column layout. The last
// row of each array is the current, in-progress bucket (today, this
// week, this month). Column positions below were confirmed directly
// against this station's real data (rain totals cross-checked against
// known heavy-rain days).
const COL = {
  TEMP_MAX_C: 5,
  TEMP_MIN_C: 6,
  WIND_GUST_MAX_MS: 14,
  WIND_LULL_MIN_MS: 15,
  RAIN_TOTAL_MM: 28,
};
function cToF(c) {
  return (c * 9) / 5 + 32;
}
function mmToIn(mm) {
  return mm * 0.0393701;
}
function msToMph(ms) {
  return ms * 2.23694;
}
function round1(n) {
  return typeof n === "number" ? Math.round(n * 10) / 10 : null;
}
function round2(n) {
  return typeof n === "number" ? Math.round(n * 100) / 100 : null;
}

function summarize(row) {
  if (!row) return null;
  const tempMaxC = row[COL.TEMP_MAX_C];
  const tempMinC = row[COL.TEMP_MIN_C];
  const windGustMs = row[COL.WIND_GUST_MAX_MS];
  const windLullMs = row[COL.WIND_LULL_MIN_MS];
  const rainMm = row[COL.RAIN_TOTAL_MM];
  return {
    date: row[0],
    highF: round1(cToF(tempMaxC)),
    lowF: round1(cToF(tempMinC)),
    windHighMph: round1(msToMph(windGustMs)),
    windLowMph: round1(msToMph(windLullMs)),
    rainIn: round2(mmToIn(rainMm)),
  };
}

export default async function handler(req, res) {
  const token = process.env.TEMPEST_TOKEN;
  const stationId = process.env.TEMPEST_STATION_ID;

  if (!token || !stationId) {
    return res.status(500).json({ error: "Missing TEMPEST_TOKEN or TEMPEST_STATION_ID" });
  }

  try {
    const url = `https://swd.weatherflow.com/swd/rest/stats/station/${stationId}?token=${token}`;
    const upstream = await fetch(url);

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `Stats API returned ${upstream.status}`, detail: text });
    }

    const data = await upstream.json();
    const lastOf = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

    const today = summarize(lastOf(data.stats_day));
    const thisWeek = summarize(lastOf(data.stats_week));
    const thisMonth = summarize(lastOf(data.stats_month));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ today, thisWeek, thisMonth });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}