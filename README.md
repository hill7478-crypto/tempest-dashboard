# Tempest + Radar Dashboard

A live, internet-accessible weather dashboard: your Tempest station's current
conditions next to a looping NEXRAD radar map (via the free IEM/NWS tile
service). Built with Next.js so it deploys to Vercel's free tier in about
10 minutes.

**Note on RadarScope:** RadarScope (Baron Services) is a paid native app with
no public web-embed API, so it can't be dropped into a browser dashboard.
This uses the same public NEXRAD composite data most weather websites use
instead — visually similar, fully free, no account needed.

---

## Step 1 — Get your Tempest credentials

1. Go to <https://tempestwx.com/> and sign in.
2. Click your station name (top left) → **Settings** → **Data Authorizations** → **Create Token**. Copy the token somewhere safe — you won't be able to see it again.
3. Find your station ID by visiting this URL in your browser (replace `YOUR_TOKEN`):
   `https://swd.weatherflow.com/swd/rest/stations?token=YOUR_TOKEN`
   In the JSON that loads, find `"station_id"` and note the number. While you're there, also note `"latitude"` and `"longitude"` — you'll want these to center the map.

## Step 2 — Get the code onto GitHub

1. Create a new, empty repository on GitHub (e.g. `tempest-dashboard`) — don't initialize it with a README.
2. On your own computer, in a terminal, `cd` into this project folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tempest-dashboard.git
   git push -u origin main
   ```
   (Replace the URL with the one GitHub shows you after creating the repo.)

## Step 3 — Deploy to Vercel

1. Go to <https://vercel.com/> and sign in (you can use your GitHub account to sign in directly).
2. Click **Add New → Project**.
3. Select the `tempest-dashboard` repo you just pushed and click **Import**.
4. Before clicking Deploy, open **Environment Variables** and add these four:

   | Name | Value |
   |---|---|
   | `TEMPEST_TOKEN` | the token from Step 1 |
   | `TEMPEST_STATION_ID` | the station ID from Step 1 |
   | `NEXT_PUBLIC_STATION_LAT` | your station's latitude |
   | `NEXT_PUBLIC_STATION_LON` | your station's longitude |
   | `NEXT_PUBLIC_STATION_LABEL` | whatever you want the dashboard header to say, e.g. `Homewood Weather` |

5. Click **Deploy**. In under a minute Vercel gives you a live URL like `tempest-dashboard-yourname.vercel.app` — that's it, live on the internet.

## Step 4 — (Optional) custom domain

In the Vercel project → **Settings → Domains**, you can attach a domain you own (e.g. `weather.yourdomain.com`) by adding a CNAME record at your DNS provider — Vercel walks you through the exact record to add.

## Updating later

Any time you want to change something, edit the code, then:
```bash
git add .
git commit -m "description of change"
git push
```
Vercel automatically redeploys within a minute or two of every push.

---

## Testing locally first (optional but recommended)

If you have Node.js 18+ installed:
```bash
cp .env.local.example .env.local
# edit .env.local and fill in your real token/station ID/lat/lon
npm install
npm run dev
```
Then open <http://localhost:3000>.

---

## How it's built (for reference)

- **`pages/api/tempest.js`** — a serverless function that calls the Tempest
  REST API server-side. This is the important part for security: your
  `TEMPEST_TOKEN` lives only in Vercel's environment variables and server
  memory — it's never sent to anyone's browser. The browser only ever talks
  to `/api/tempest`.
- **`components/WeatherPanel.js`** — polls `/api/tempest` once a minute and
  renders temperature, wind, pressure, rain, UV, lightning, and battery
  status, converted to °F/mph/inHg.
- **`components/RadarMap.js`** — a Leaflet map with a dark basemap and 11
  looping NEXRAD radar frames (current + the last 50 minutes in 5-minute
  steps) pulled from the Iowa Environmental Mesonet's free tile service.
  Frames refresh every 5 minutes so the loop stays current. Play/Pause
  control included.

## Extending it

Some natural next additions, if you want them later:
- A wind history chart (Tempest's `/observations` endpoint supports time ranges).
- NWS active alerts overlaid on the map (also free, from `api.weather.gov`).
- Multiple stations, if you add more Tempest devices.
- Swap the IEM radar tiles for AllisonHouse (RadarScope's own data provider) if you want their exact rendering — that requires a separate paid commercial data license from them, not something this free setup includes.
