export default async function handler(req, res) {
  const token = process.env.TEMPEST_TOKEN;
  const stationId = process.env.TEMPEST_STATION_ID;

  if (!token || !stationId) {
    return res.status(500).json({ error: "Missing TEMPEST_TOKEN or TEMPEST_STATION_ID" });
  }

  try {
    const url = `https://swd.weatherflow.com/swd/rest/stats/station/${stationId}?token=${token}`;
    const upstream = await fetch(url);
    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Stats API returned ${upstream.status}`, detail: text });
    }

    // Temporary: return the raw response as-is so we can inspect its real shape.
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}