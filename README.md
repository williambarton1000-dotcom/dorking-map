# Surrey Hills, from Dorking — map prototype

Static site: open `index.html` via any web server (GitHub Pages, Netlify, or `python3 -m http.server`).

## Files
- `index.html` – page shell (header, legend, map). Analytics tag goes where marked in `<head>`.
- `css/style.css` – all styling.
- `js/config.js` – **the only file you normally edit**: layers, colours, icons, basemaps, newsletter link.
- `js/app.js` – map logic (loads each CSV, draws pins, pop-ups, legend, satellite toggle).
- `data/*.csv` – one CSV per layer. Required columns: `Name`, `Latitude`, `Longitude`.
- `vendor/` – MapLibre GL JS 4.7.1 and PapaParse, bundled so the site has no runtime library CDN dependency.

## Adding a layer (e.g. pubs)
1. Save the CSV as `data/pubs.csv` (with Latitude/Longitude columns).
2. In `js/config.js`, on the `pubs` entry, set `comingSoon: false` and check the `fields` mapping matches the CSV's column names.

## Switching to Mapbox
1. In `index.html` replace `vendor/maplibre-gl.css/.js` with Mapbox GL JS (`https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css` / `.js`).
2. In `js/config.js`: `library: 'mapbox'`, `mapboxToken: 'pk....'`, and `BASEMAPS.map.style: 'mapbox://styles/mapbox/outdoors-v12'` (or your own Studio style).
3. Optionally use Mapbox satellite (`mapbox://mapbox.satellite`) instead of Esri.

## Basemaps
- Map: OpenFreeMap "liberty" (OpenStreetMap data, no key, free).
- Satellite: Esri World Imagery (no key; attribution shown). For heavy public traffic check Esri's terms, or switch to Mapbox satellite.
