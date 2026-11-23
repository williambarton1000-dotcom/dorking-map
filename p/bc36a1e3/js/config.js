window.MAP_PROVIDER = { library: 'maplibre', mapboxToken: '' };
window.MAP_START = { center: [-0.333, 51.232], zoom: 12.4 };
window.BASEMAPS = {
  map: { label: 'Map', style: 'https://tiles.openfreemap.org/styles/liberty' },
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
};
window.ICONS = {
  office: '<path d="M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>',
  shop: '<path d="M4 10h16v10H4zM4 10l1.5-5h13L20 10M8 21v-6h8v6M8 10V8M16 10V8M12 10V8"/>',
  warehouse: '<path d="M3 20V10l9-6 9 6v10H3zM3 20h18M8 20v-6h8v6"/>',
  yard: '<path d="M4 20V9M20 20V9M4 9h16M7 9V6h3v3M14 9V6h3v3M4 20h16"/>',
  barn: '<path d="M3 20V11l9-7 9 7v9H3zM3 20h18M12 20v-7M8 13h8"/>',
  land: '<path d="M4 18l5-8 4 5 3-4 4 7H4zM5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
  leisure: '<path d="M4 18h16M7 18V9h10v9M9 9c0-3 6-3 6 0"/>',
  mixed: '<path d="M3 20V10l6-4 6 4v10H3zM15 20V12h6v8M7 20v-5h4v5"/>',
  small: '<path d="M7 7h10v10H7zM7 7l5-3 5 3M12 17v-6"/>'
};
window.LAYERS = [
  { id: 'offices', name: 'Offices', colour: '#5a6e9a', icon: 'office' },
  { id: 'retail', name: 'Retail', colour: '#c45c48', icon: 'shop' },
  { id: 'industrial', name: 'Industrial & warehouse', colour: '#2a7a74', icon: 'warehouse' },
  { id: 'yards', name: 'Yards & storage', colour: '#7a5a36', icon: 'yard' },
  { id: 'rural', name: 'Rural barns & workshops', colour: '#4f8f5b', icon: 'barn' },
  { id: 'land', name: 'Land & development', colour: '#8a7350', icon: 'land' },
  { id: 'leisure', name: 'Leisure', colour: '#b56b8a', icon: 'leisure' },
  { id: 'mixed', name: 'Mixed-use', colour: '#c48a2a', icon: 'mixed' },
  { id: 'small', name: 'Small spaces', colour: '#8a7a70', icon: 'small', comingSoon: true }
];
window.MAP_CONFIG = {
  dataUrl: 'data/listings.json',
  hideEmptyLayers: false,
  servicedFilter: true,
  mode: 'full'
};
