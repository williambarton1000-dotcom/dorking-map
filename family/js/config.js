/* Dorking for families — map configuration */

window.MAP_PROVIDER = {
  library: 'maplibre',
  mapboxToken: ''
};

window.MAP_START = {
  center: [-0.333, 51.232],
  zoom: 12,
  phoneBounds: [[-0.360, 51.210], [-0.300, 51.250]]
};

window.BASEMAPS = {
  map: { label: 'Map', style: 'https://tiles.openfreemap.org/styles/liberty' },
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
};

window.ICONS = {
  baby: 'M9 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8 10h8l-1 8H9zM7 14h10',
  sport: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M8 8l8 8M16 8l-8 8',
  school: 'M3 10l9-5 9 5v8H3zM12 10v8M7 13v5M17 13v5',
  nursery: 'M4 20V10l8-5 8 5v10M8 20v-6h8v6',
  park: 'M12 21V11M7 21h10M12 11c-3-4-6-5-8-5 2 3 4 5 8 5 4 0 6-2 8-5-2 0-5 1-8 5z',
  library: 'M5 4h5v16H5zM14 4h5v16h-5zM10 8h4',
  holiday: 'M5 18h14M7 18V8l5-3 5 3v10',
  daysout: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  feeding: 'M8 8a4 4 0 0 1 8 0v3H8zM7 11h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z',
  health: 'M12 4v16M4 12h16',
  home: 'M3 11l9-7 9 7v9H3zM10 20v-6h4v6'
};

window.AGE_FILTERS = [
  { id: 'bump', label: 'Bump & baby 0–1', min: 0, max: 1 },
  { id: 'toddler', label: 'Toddler 1–3', min: 1, max: 3 },
  { id: 'preschool', label: 'Preschool 3–5', min: 3, max: 5 },
  { id: 'primary', label: 'Primary 5–11', min: 5, max: 11 },
  { id: 'secondary', label: 'Secondary 11–16', min: 11, max: 16 }
];

window.DAY_FILTERS = [
  { id: 'Mon', label: 'Mon' },
  { id: 'Tue', label: 'Tue' },
  { id: 'Wed', label: 'Wed' },
  { id: 'Thu', label: 'Thu' },
  { id: 'Fri', label: 'Fri' },
  { id: 'Sat', label: 'Sat' },
  { id: 'Sun', label: 'Sun' },
  { id: 'today', label: 'Today' }
];

var PLACE_FIELDS = {
  name: 'Name',
  description: 'Short_Description',
  when: 'When',
  cost: 'Cost',
  booking: 'Booking_Note',
  website: 'Website',
  address: 'Address',
  venue: 'Venue',
  postcode: 'Postcode',
  precision: 'Coord_Precision',
  status: 'Status',
  ageMin: 'Age_Min',
  ageMax: 'Age_Max',
  days: 'Days',
  inclusive: 'Inclusive',
  photo: 'Photo',
  photoCredit: 'Photo_Credit',
  phase: 'Phase',
  type: 'Type',
  religious: 'Religious_Character',
  gender: 'Gender',
  ofstedRating: 'Ofsted_Rating',
  ofstedDate: 'Ofsted_Date',
  urn: 'URN',
  ofstedUrl: 'Ofsted_URL'
};

window.LAYERS = [
  {
    id: 'baby',
    name: 'Baby & toddler',
    file: 'data/baby_toddler.csv',
    colour: '#c45c48',
    icon: 'baby',
    categoryField: 'Subcategory',
    fields: PLACE_FIELDS
  },
  {
    id: 'sports',
    name: 'Sports & activities',
    file: 'data/sports.csv',
    colour: '#2a7a74',
    icon: 'sport',
    categoryField: 'Subcategory',
    fields: PLACE_FIELDS
  },
  {
    id: 'schools',
    name: 'Schools',
    file: 'data/schools.csv',
    colour: '#5a6e9a',
    icon: 'school',
    categoryField: 'Phase',
    subfilters: true,
    categoryOrder: ['Primary', 'Secondary', 'All-through', 'Special', 'Sixth form'],
    fields: PLACE_FIELDS
  },
  {
    id: 'nurseries',
    name: 'Nurseries & pre-schools',
    file: 'data/nurseries.csv',
    colour: '#d08a4c',
    icon: 'nursery',
    categoryField: 'Subcategory',
    subfilters: true,
    categoryOrder: ['Full day care', 'Sessional day care', 'Nursery school', 'School nursery class', 'Information'],
    fields: PLACE_FIELDS
  },
  {
    id: 'playgrounds',
    name: 'Playgrounds & parks',
    file: 'data/playgrounds.csv',
    colour: '#4f8f5b',
    icon: 'park',
    categoryField: 'Subcategory',
    subfilters: true,
    categoryOrder: ['Playground', 'Park or open space', 'Woodland'],
    fields: PLACE_FIELDS
  },
  {
    id: 'libraries',
    name: 'Libraries',
    file: 'data/libraries.csv',
    colour: '#6b5ea8',
    icon: 'library',
    categoryField: 'Subcategory',
    fields: PLACE_FIELDS
  },
  {
    id: 'holiday',
    name: 'Holiday clubs',
    file: 'data/holiday.csv',
    colour: '#c48a2a',
    icon: 'holiday',
    categoryField: 'Subcategory',
    fields: PLACE_FIELDS
  },
  {
    id: 'daysout',
    name: 'Family days out',
    file: 'data/daysout.csv',
    colour: '#3e7c8a',
    icon: 'daysout',
    categoryField: 'Subcategory',
    fields: PLACE_FIELDS
  },
  {
    id: 'feeding',
    name: 'Baby-changing & feeding',
    file: 'data/feeding.csv',
    colour: '#b56b8a',
    icon: 'feeding',
    categoryField: 'Subcategory',
    subfilters: true,
    categoryOrder: ['Baby changing', 'Changing Places'],
    fields: PLACE_FIELDS
  },
  { id: 'healthcare', name: 'Healthcare (GP, health visitors, family hubs)', file: 'data/healthcare.csv', colour: '#ad061a', icon: 'health', comingSoon: true, fields: { name: 'Name' } }
];


window.AREA_LAYER = {
  id: 'wheretolive',
  name: 'Where to live',
  file: 'data/housing_areas.geojson',
  colour: '#7a5a36',
  defaultOn: true,
  groups: ['Dorking town', 'Villages']
};

window.NEWSLETTER = { enabled: false, text: '', url: '#' };

window.TELL_US = {
  email: 'william@wbphotography.uk',
  subject: 'Family map: correction or idea',
  body: 'Place name:\nWhat should change / your idea:\n'
};

window.SUBMIT = { href: 'submit.html' };

/* Analytics stays off for this unpublished preview. Do not invent a code. */
window.ANALYTICS = { goatcounterCode: '' };
