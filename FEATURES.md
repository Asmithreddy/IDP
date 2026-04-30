# Natural Disaster Tracker — Feature Summary

A browser-based tool for exploring historical cyclone and tsunami records worldwide. Click any point on the map and the system queries a local PostgreSQL/PostGIS database to surface all relevant events, visualizations, and risk statistics for that location.

---

## Map

**Click-to-search**
Click anywhere on the world map to trigger a spatial search. A red marker is placed at the clicked point and a circle is drawn showing the exact search radius.

**Two hazard modes**
Toggle between Cyclones and Tsunamis using the tabs at the top. The map, results panel, radius options, and all behavior adjust automatically for the selected mode.

**Configurable search radius**
- Cyclones: 50 km / 100 km / 200 km / 500 km
- Tsunamis: 200 km / 500 km / 1000 km / 2000 km

**Wind speed intensity legend**
A color key sits in the bottom-left corner of the map at all times, showing the standard meteorological categories used to color cyclone tracks based on windspeeds.

---

## Cyclone Features

**Color-coded tracks**
Every cyclone track is drawn as a series of line segments, each colored by the wind speed at the start of that segment using standard Saffir–Simpson / WMO categories.

| Color | Category |
|---|---|
| Dark gray | No data |
| Blue | Tropical Depression < 34 kts |
| Green | Tropical Storm 34–63 kts |
| Yellow | Hurricane Cat 1 64–82 kts |
| Amber | Hurricane Cat 2 83–95 kts |
| Red-orange | Hurricane Cat 3 96–112 kts |
| Crimson | Hurricane Cat 4 113–136 kts |
| Purple | Hurricane Cat 5 ≥ 137 kts |

**Observation dots**
Each recorded observation along a track is marked with a colored dot. The first and last observations use a slightly larger dot. Clicking a dot opens a popup showing:
- Date and time (UTC)
- Latitude / Longitude
- Wind speed and Saffir–Simpson category
- Central pressure (mb)
- Distance to nearest land (km)
- Storm nature (Tropical Storm, Hurricane, Extratropical, etc.)
- Observation number out of total

**Track highlight on row click**
Clicking any row in the results table dims all other tracks and fully highlights the selected one. The map automatically fits to show the full extent of that track.

**Nearest cyclone hint**
If no cyclones are found within the chosen radius, the panel shows the name, year, and distance of the nearest cyclone on record anywhere in the database, with a suggestion to increase the radius.

**Wind Speed Distribution chart**
A bar chart groups all found cyclones into four intensity buckets (Weak / Moderate / Strong / Very Strong) so you can see the overall intensity profile at a glance. Summary stats below the chart show the maximum wind speed, average wind speed, total cyclone count, and how many had usable wind data.

**Wind Risk Analysis — GEV Fit**
A dedicated analysis section appears alongside the results showing:
- Mean and median wind speed across all storms
- 50-year and 100-year return level wind speeds (estimated peak wind speed expected once every 50 or 100 years)
- GEV distribution parameters (shape, location, scale)
- A combined histogram + fitted PDF curve chart with the two return level lines overlaid
- The model falls back to a Gumbel distribution (shape fixed at 0) if the GEV fit produces unreliable parameters, and labels itself accordingly

---

## Tsunami Features

**Tsunami markers**
Each tsunami event is displayed as a circle on the map. Marker size and color indicate severity:

| Color | Water Height |
|---|---|
| Green | < 2 m (minor) |
| Yellow | 2–4.9 m (moderate) |
| Orange | 5–9.9 m (major) |
| Red | ≥ 10 m (catastrophic) |

Clicking a marker opens a popup with location, date, earthquake magnitude, max water height, deaths, and distance from the clicked point.

**Tsunami results table**
Lists all events within the radius with columns for location, year, distance, max water height, earthquake magnitude, deaths, and damage in USD millions.

---

## Results Panel — Common Features

**Sorting**
Results can be sorted by:
- Distance (nearest first)
- Intensity (wind speed or water height, highest first)
- Year (most recent first)

**Year range filter**
Enter a start and end year and click Apply to narrow results to a specific time period. The map updates to show only the filtered set of tracks or markers.

**CSV export**
Clicking Download CSV exports the currently visible (filtered and sorted) results. For cyclones, the CSV includes storm name, year, basin, distance, max wind, min pressure, start/end date, duration, and the full track geometry as a WKT LineString.

---

## Data Sources

| Dataset | Source | Coverage |
|---|---|---|
| Cyclone tracks | IBTrACS v04r01 — NOAA/NCEI | 1842 to present, ~14,000 storms, ~700,000 observations |
| Tsunami events | NGDC/WDS Global Historical Tsunami Database — NOAA | 2000 BC to present, ~2,200 events |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Map | Leaflet.js |
| Charts | Chart.js |
| Backend | Python, FastAPI |
| Database | PostgreSQL with PostGIS |
| Spatial queries | PostGIS geography type with GIST index |
| Statistics | NumPy, SciPy (GEV distribution fitting) |
