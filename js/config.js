/* =====================================================================
   Surrey Hills, from Dorking — map configuration
   ---------------------------------------------------------------------
   To ADD A LAYER: drop a CSV in /data and add an entry to LAYERS below.
   The CSV only needs Name, Latitude, Longitude; everything else is
   optional and mapped through `fields`.

   To SWITCH TO MAPBOX later (see README.md):
     1. In index.html swap the maplibre-gl .js/.css for mapbox-gl.
     2. Set MAP_PROVIDER.library = 'mapbox' and paste your public token.
     3. Set BASEMAPS.map.style to e.g. 'mapbox://styles/mapbox/outdoors-v12'.
   ===================================================================== */

window.MAP_PROVIDER = {
  library: 'maplibre',          // 'maplibre' | 'mapbox'
  mapboxToken: ''               // e.g. 'pk.eyJ1Ijo...' (public token only)
};

window.MAP_START = {
  center: [-0.345, 51.225],     // Dorking
  zoom: 11.2
};

window.BASEMAPS = {
  // Keyless vector tiles from OpenFreeMap (OpenStreetMap data)
  map: { label: 'Map', style: 'https://tiles.openfreemap.org/styles/liberty' },
  // Keyless Esri World Imagery, drawn as a raster layer over the map style
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
};

/* Icons are simple inline SVG paths (24×24 viewBox), so they render everywhere. */
window.ICONS = {
  basket: 'M5 9h14l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5 9zm3-1 4-5 4 5',
  church: 'M12 2v3M10.5 3.5h3M12 5l-6 5v11h12V10l-6-5zm-2 16v-4a2 2 0 0 1 4 0v4',
  landmark: 'M12 2l2.6 6.3 6.4.5-4.9 4.2 1.5 6.5L12 16l-5.6 3.5 1.5-6.5L3 8.8l6.4-.5L12 2z',
  pint: 'M7 3h10l-1.5 17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1L7 3zm.5 5h9',
  boot: 'M4 18h16v3H4zM6 18V5h6v7l6 2.5V18'
};

window.LAYERS = [
  {
    id: 'food',
    name: 'Food & drink',
    file: 'data/food_drink.csv',
    colour: '#c2603a',
    icon: 'basket',
    // Optional sub-colours by a category column
    categoryField: 'Category',
    categories: {
      'Farm shop':            '#c2603a',
      'Vineyard':             '#8e3b5d',
      'Brewery & distillery': '#c99a2e',
      'Market':               '#4f7c8a'
    },
    fields: { name: 'Name', description: 'Description', practical: 'Practical',
              nearby: 'Nearby', website: 'Website', address: 'Address' }
  },
  {
    id: 'landmarks',
    name: 'Landmarks & lore',
    file: 'data/landmarks.csv',
    colour: '#3f6b46',
    icon: 'landmark',
    fields: { name: 'Name', description: 'Short_Description', lore: 'History_or_Lore',
              website: 'Source_or_Website', address: 'Address', precision: 'Coord_Precision' }
  },
  {
    id: 'churches',
    name: 'Churches',
    file: 'data/churches.csv',
    colour: '#5a5fa0',
    icon: 'church',
    fields: { name: 'Name', description: 'Short_Description', lore: 'History_or_Lore',
              website: 'Website', address: 'Address' }
  },
  {
    id: 'pubs',
    name: 'Pubs',
    file: 'data/pubs.csv',
    colour: '#9a6a3a',
    icon: 'pint',
    comingSoon: false,
    // 'Good to know' joins two columns; 'Read more' expands the History column
    fields: { name: 'Name', description: 'Description', practical: ['Food_and_Drink', 'Atmosphere'],
              lore: 'History', website: 'Website', address: 'Address' }
  },
  // ---- Placeholder: set comingSoon:false once the CSV exists ----
  { id: 'walks', name: 'Walk start points', file: 'data/car_parks.csv',  colour: '#2f7f8f', icon: 'boot', comingSoon: true,
    fields: { name: 'Name', description: 'Description', practical: 'Notes', website: 'Website', address: 'Address' } }
];

window.NEWSLETTER = { text: "Get the weekly Dorking what's on", url: '#' };
