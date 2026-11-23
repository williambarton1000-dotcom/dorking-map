/* Dorking for families — map app (MapLibre GL) */
(function () {
  'use strict';

  var gl = window.MAP_PROVIDER.library === 'mapbox' ? window.mapboxgl : window.maplibregl;
  if (window.MAP_PROVIDER.library === 'mapbox') gl.accessToken = window.MAP_PROVIDER.mapboxToken;

  var LAYERS = window.LAYERS, ICONS = window.ICONS;
  var AGE_FILTERS = window.AGE_FILTERS || [];
  var state = {};
  var openPopup = null;
  var activeAges = {}; // filter id -> true when selected; none selected = show all
  var DAY_FILTERS = window.DAY_FILTERS || [];
  function todayDayId() {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  }
  var activeDay = null; // 'Mon'..'Sun', or null to show every day
  var inclusiveOnly = false;

  var map = new gl.Map({
    container: 'map',
    style: window.BASEMAPS.map.style,
    center: window.MAP_START.center,
    zoom: window.MAP_START.zoom,
    attributionControl: false
  });
  map.addControl(new gl.NavigationControl({ visualizePitch: false }), 'top-right');
  map.addControl(new gl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
  map.addControl(new gl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
  map.addControl(new gl.AttributionControl({ compact: true, customAttribution: 'Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.' }), 'bottom-right');

  var tellUsLink = document.getElementById('tell-us');
  var tellUs = window.TELL_US || {
    email: 'william@wbphotography.uk',
    subject: 'Family map: correction or idea',
    body: 'Place name:\nWhat should change / your idea:\n'
  };
  function tellUsHref(placeName) {
    var subject = tellUs.subject || 'Family map: correction or idea';
    var body = tellUs.body || 'Place name:\nWhat should change / your idea:\n';
    if (placeName) {
      subject += ' — ' + placeName;
      body = 'Place name: ' + placeName + '\nWhat should change / your idea:\n';
    }
    return 'mailto:' + tellUs.email +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  };
  function setTellUsLink(placeName) {
    if (tellUsLink) tellUsLink.href = tellUsHref(placeName);
  }
  setTellUsLink(null);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svgIcon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || ICONS.sport) + '"/></svg>';
  }
  function colourFor(layer, row) {
    if (layer.categoryField && layer.categories) {
      return layer.categories[row[layer.categoryField]] || layer.colour;
    }
    return layer.colour;
  }
  function catLabel(layer, cat) { return (layer.categoryLabels && layer.categoryLabels[cat]) || cat; }
  function isUrl(s) { return /^https?:\/\//i.test(String(s || '').trim()); }

  function parseAge(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function formatAge(n) {
    if (n == null) return '';
    var months = Math.round(n * 12);
    if (n === 0) return 'newborn';
    if (n < 1) {
      if (months <= 2) return '8 weeks';
      return months + ' months';
    }
    if (n === 1.08 || months === 13) return '13 months';
    if (n === 1.5) return '18 months';
    if (n % 1 !== 0 && n < 3) return months + ' months';
    if (n % 1 === 0) return n + (n === 1 ? ' year' : ' years');
    return n + ' years';
  }
  function ageLabel(min, max) {
    if (min == null && max == null) return '';
    if (min != null && max != null) {
      if (min === 0 && max === 0) return 'Pregnancy';
      return 'Ages ' + formatAge(min) + ' to ' + formatAge(max);
    }
    if (min != null) return 'From ' + formatAge(min);
    return 'Up to ' + formatAge(max);
  }
  function matchesAge(min, max) {
    var selected = AGE_FILTERS.filter(function (f) { return activeAges[f.id]; });
    if (!selected.length) return true;
    if (min == null && max == null) return true; // unknown ages always show
    var a = min == null ? 0 : min;
    var b = max == null ? 99 : max;
    return selected.some(function (f) { return a <= f.max && b >= f.min; });
  }
  function matchesDay(daysStr) {
    if (!activeDay) return true;
    var days = String(daysStr || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!days.length) return true; // unknown days always show
    return days.indexOf(activeDay) !== -1;
  }
  function matchesInclusive(val) {
    if (!inclusiveOnly) return true;
    return String(val || '').toUpperCase() === 'Y';
  }

  function popupHtml(layer, row, colour) {
    var f = layer.fields, v = function (k) {
      var cols = f[k] ? [].concat(f[k]) : [];
      return cols.map(function (c) { return (row[c] || '').trim(); }).filter(Boolean).join(' ');
    };
    var lat = row.Latitude, lng = row.Longitude;
    var cat = layer.categoryField ? catLabel(layer, row[layer.categoryField]) : layer.name;
    var status = v('status');
    var min = parseAge(v('ageMin')), max = parseAge(v('ageMax'));
    var ages = ageLabel(min, max);
    var addr = [v('venue'), v('address'), row.Postcode].filter(Boolean);
    // de-duplicate obvious repeats
    var seen = {};
    addr = addr.filter(function (p) {
      var k = p.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).join(', ');
    var h = '<div class="pop">';
    h += '<div class="pop-cat" style="color:' + colour + '"><span class="pop-dot" style="background:' + colour + '"></span>' + esc(cat) + '</div>';
    h += '<h3>' + esc(v('name')) + '</h3>';
    if (status === 'Borderline') h += '<div class="pop-flag">Edge of the area — please check</div>';
    if (status === 'Uncertain') h += '<div class="pop-flag uncertain">Some details unconfirmed</div>';
    if (String(v('inclusive') || row.Inclusive || '').toUpperCase() === 'Y') {
      h += '<div class="pop-badge send">Inclusive / SEND</div>';
    }
    var photo = (v('photo') || row.Photo || '').trim();
    if (photo) {
      var src = photo;
      if (!/^https?:\/\//i.test(src) && src.charAt(0) !== '/') {
        src = 'photos/web/' + src.replace(/^photos\/web\//, '');
      }
      var base = src.replace(/\.(jpe?g|png|webp)$/i, '');
      var credit = v('photoCredit') || row.Photo_Credit || '';
      h += '<div class="pop-photo-wrap"><picture>' +
        '<source type="image/webp" srcset="' + esc(base + '.webp') + '">' +
        '<img class="pop-photo" src="' + esc(src) + '" alt="">' +
        '</picture>';
      if (credit) h += '<p class="pop-credit">' + esc(credit) + '</p>';
      h += '</div>';
    }
    if (ages) h += '<p class="pop-ages">' + esc(ages) + '</p>';
    if (v('description')) h += '<p class="pop-desc">' + esc(v('description')) + '</p>';
    if (v('phase')) h += '<p class="pop-meta"><strong>Phase</strong> ' + esc(v('phase')) + '</p>';
    if (v('type')) h += '<p class="pop-meta"><strong>Type</strong> ' + esc(v('type')) + '</p>';
    if (v('religious')) h += '<p class="pop-meta"><strong>Character</strong> ' + esc(v('religious')) + '</p>';
    if (v('gender') && v('gender') !== 'Mixed') h += '<p class="pop-meta"><strong>Gender</strong> ' + esc(v('gender')) + '</p>';
    if (v('ofstedRating')) {
      h += '<p class="pop-meta"><strong>Ofsted</strong> ' + esc(v('ofstedRating')) +
        (v('ofstedDate') ? ' (' + esc(v('ofstedDate')) + ')' : '') + '</p>';
    }
    if (v('urn')) h += '<p class="pop-meta"><strong>URN</strong> ' + esc(v('urn')) + '</p>';
    if (v('when')) h += '<p class="pop-meta"><strong>When</strong> ' + esc(v('when')) + '</p>';
    if (v('cost')) h += '<p class="pop-meta"><strong>Cost</strong> ' + esc(v('cost')) + '</p>';
    if (v('booking')) h += '<p class="pop-meta"><strong>Good to know</strong> ' + esc(v('booking')) + '</p>';
    if (addr) h += '<p class="pop-addr">' + esc(addr) + '</p>';
    if (/approx|postcode|street/i.test(v('precision'))) {
      var label = /approx/i.test(v('precision')) ? 'Approximate location' :
        /postcode/i.test(v('precision')) ? 'Pin is the postcode, not the door' :
        'Pin is the street, not the exact door';
      h += '<p class="pop-approx">' + label + '</p>';
    }
    h += '<div class="pop-actions">';
    h += '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' +
         encodeURIComponent(lat + ',' + lng) + '">Directions</a>';
    if (isUrl(v('website'))) h += '<a class="btn" target="_blank" rel="noopener" href="' + esc(v('website')) + '">Website ↗</a>';
    if (isUrl(v('ofstedUrl'))) h += '<a class="btn" target="_blank" rel="noopener" href="' + esc(v('ofstedUrl')) + '">Ofsted report ↗</a>';
    h += '</div></div>';
    return h;
  }

  function fitPopup(popup, lnglat) {
    var pe = popup.getElement(); if (!pe) return;
    var c = map.getContainer(), W = c.clientWidth, H = c.clientHeight;
    var ph = pe.getBoundingClientRect().height, pw = pe.getBoundingClientRect().width;
    var lg = document.getElementById('legend');
    var leftPad = (window.innerWidth >= 760 && lg.classList.contains('open')) ? lg.offsetWidth + 32 : 0;
    var p = map.project(lnglat);
    var targetX = leftPad + (W - leftPad) / 2;
    var targetY = Math.min(H - 30, Math.max(ph + 60, H * 0.55));
    var dx = p.x - targetX, dy = p.y - targetY;
    var clipped = (p.y - ph - 50 < 0) || (p.x - pw / 2 < leftPad + 10) || (p.x + pw / 2 > W - 60) || (p.y > H - 20);
    if (clipped) map.panBy([dx, dy], { duration: 350 });
  }

  function addMarkers(layer, rows) {
    var st = state[layer.id];
    rows.forEach(function (row) {
      var lat = parseFloat(row.Latitude), lng = parseFloat(row.Longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      var colour = colourFor(layer, row);
      var el = document.createElement('button');
      var cat = layer.categoryField ? row[layer.categoryField] : null;
      el.className = 'pin' + (cat && layer.categoryPinClass && layer.categoryPinClass[cat] ? ' ' + layer.categoryPinClass[cat] : '');
      var small = /\bpin-sm\b/.test(el.className);
      el.type = 'button';
      var placeName = row[layer.fields.name] || layer.name;
      el.setAttribute('aria-label', placeName);
      el.title = placeName;
      el.style.setProperty('--c', colour);
      el.innerHTML = '<span class="pin-body">' + svgIcon(layer.icon, small ? 12 : 15) + '</span>';
      var popup = new gl.Popup({ offset: [0, small ? -28 : -36], anchor: 'bottom', maxWidth: '320px', closeButton: true, focusAfterOpen: false })
        .setHTML(popupHtml(layer, row, colour));
      popup.on('open', function () {
        openPopup = popup; el.classList.add('active');
        setTellUsLink(placeName);
        requestAnimationFrame(function () { fitPopup(popup, [lng, lat]); });
      });
      popup.on('close', function () {
        el.classList.remove('active');
        if (openPopup === popup) { openPopup = null; setTellUsLink(null); }
      });
      var marker = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).setPopup(popup).addTo(map);
      marker._dkName = placeName;
      marker._dkPopOffset = small ? [0, -28] : [0, -36];
      var search = [placeName, row.Venue, row.Address, row.Subcategory, row.Phase, row.Type, row.URN, row.Short_Description].join(' ').toLowerCase();
      st.markers.push({
        marker: marker,
        category: cat,
        lnglat: [lng, lat],
        colour: colour,
        name: placeName,
        search: search,
        ageMin: parseAge(row.Age_Min),
        ageMax: parseAge(row.Age_Max),
        days: row.Days || '',
        inclusive: row.Inclusive || ''
      });
    });
  }
  function isShown(st, m) {
    return st.visible && !(m.category && st.hiddenCats[m.category]) &&
      matchesAge(m.ageMin, m.ageMax) && matchesDay(m.days) && matchesInclusive(m.inclusive);
  }
  function refreshVisibility(layerId) {
    var st = state[layerId];
    st.markers.forEach(function (m) {
      if (!isShown(st, m) && m.marker.getPopup().isOpen()) m.marker.togglePopup();
    });
    recluster();
    updateLegendCounts();
  }
  function refreshAll() {
    Object.keys(state).forEach(refreshVisibility);
  }

  var CLUSTER_PX = 22, BUBBLE_PX = 36, FAN_ZOOM = 15, POP_OFFSET = [0, -36];
  var groupEls = [];
  function clearGroups() { groupEls.forEach(function (g) { g.remove(); }); groupEls = []; }
  function setPinOffset(m, dx, dy) {
    m.marker.setOffset([dx, dy]);
    var po = m.marker._dkPopOffset || POP_OFFSET;
    m.marker.getPopup().setOffset([po[0] + dx, po[1] + dy]);
  }
  function fanOut(members, centre) {
    var n = members.length, r = Math.max(30, Math.round(42 * n / (2 * Math.PI)));
    var size = 2 * r + 12, legs = '';
    members.forEach(function (m, i) {
      var a = n === 2 ? (i ? 0 : Math.PI) : (-Math.PI / 2 + i * 2 * Math.PI / n);
      var dx = Math.round(r * Math.cos(a)), dy = Math.round(r * Math.sin(a));
      setPinOffset(m, dx, dy);
      m.marker.getElement().style.display = '';
      legs += '<line x1="' + size / 2 + '" y1="' + size / 2 + '" x2="' + (size / 2 + dx) + '" y2="' + (size / 2 + dy) + '"/>';
    });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'spider');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.transform = 'translate(-50%, -50%)';
    svg.innerHTML = legs + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="3"/>';
    var wrap = document.createElement('div');
    wrap.style.position = 'absolute';
    wrap.style.pointerEvents = 'none';
    wrap.appendChild(svg);
    var marker = new gl.Marker({ element: wrap, anchor: 'center' }).setLngLat(centre).addTo(map);
    groupEls.push(marker);
  }
  function addClusterBubble(members, centre) {
    members.forEach(function (m) { m.marker.getElement().style.display = 'none'; m.clustered = true; });
    var colours = [];
    members.forEach(function (m) { if (colours.indexOf(m.colour) === -1) colours.push(m.colour); });
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'cluster';
    el.setAttribute('aria-label', members.length + ' places');
    var ring = colours.length === 1 ? colours[0] :
      'conic-gradient(' + colours.map(function (c, i) {
        var a = (i / colours.length) * 360, b = ((i + 1) / colours.length) * 360;
        return c + ' ' + a + 'deg ' + b + 'deg';
      }).join(',') + ')';
    el.style.setProperty('--ring', ring);
    el.innerHTML = '<span>' + members.length + '</span>';
    el.addEventListener('click', function () {
      map.easeTo({ center: centre, zoom: Math.max(map.getZoom() + 1.5, FAN_ZOOM), duration: 400 });
    });
    var marker = new gl.Marker({ element: el, anchor: 'center' }).setLngLat(centre).addTo(map);
    groupEls.push(marker);
  }
  function recluster() {
    clearGroups();
    var items = [];
    Object.keys(state).forEach(function (id) {
      state[id].markers.forEach(function (m) {
        m.clustered = false;
        setPinOffset(m, 0, 0);
        var show = isShown(state[id], m);
        m.marker.getElement().style.display = show ? '' : 'none';
        if (show) items.push(m);
      });
    });
    var pts = items.map(function (m) { return { m: m, p: map.project(m.lnglat) }; });
    var used = {};
    for (var i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      var group = [pts[i]];
      for (var j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        var dx = pts[i].p.x - pts[j].p.x, dy = pts[i].p.y - pts[j].p.y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) { group.push(pts[j]); used[j] = true; }
      }
      if (group.length === 1) continue;
      used[i] = true;
      var members = group.map(function (g) { return g.m; });
      var cx = 0, cy = 0;
      members.forEach(function (m) { cx += m.lnglat[0]; cy += m.lnglat[1]; });
      var centre = [cx / members.length, cy / members.length];
      if (map.getZoom() >= FAN_ZOOM) fanOut(members, centre);
      else addClusterBubble(members, centre);
    }
    var open = openPopup;
    if (open) for (var k = 0; k < items.length; k++) if (items[k].clustered && items[k].marker.getPopup() === open) open.remove();
  }

  function visibleCount(st) {
    return st.markers.filter(function (m) { return isShown(st, m); }).length;
  }
  function updateLegendCounts() {
    var list = document.getElementById('legend-list');
    if (!list) return;
    LAYERS.forEach(function (layer) {
      if (layer.comingSoon) return;
      var st = state[layer.id];
      var row = list.querySelector('input[data-layer="' + layer.id + '"]:not([data-cat])');
      if (row) {
        var countEl = row.parentElement.querySelector('.lg-count');
        if (countEl) countEl.textContent = visibleCount(st);
      }
      if (layer.categories || layer.categoryField) {
        var cats = {};
        st.markers.forEach(function (m) { if (m.category) cats[m.category] = true; });
        Object.keys(cats).forEach(function (cat) {
          var input = list.querySelector('input[data-layer="' + layer.id + '"][data-cat="' + CSS.escape(cat) + '"]');
          if (!input) return;
          var n = st.markers.filter(function (m) { return m.category === cat && isShown({ visible: st.visible, hiddenCats: st.hiddenCats }, m) || false; }).length;
          // recount properly
          n = st.markers.filter(function (m) {
            return m.category === cat && isShown(st, m);
          }).length;
          var c = input.parentElement.querySelector('.lg-count');
          if (c) c.textContent = n;
        });
      }
    });
    var total = LAYERS.reduce(function (a, l) { return a + (state[l.id] && !l.comingSoon ? visibleCount(state[l.id]) : 0); }, 0);
    var all = LAYERS.reduce(function (a, l) { return a + (state[l.id] && !l.comingSoon ? state[l.id].markers.length : 0); }, 0);
    var filtered = AGE_FILTERS.some(function (f) { return activeAges[f.id]; }) || !!activeDay || inclusiveOnly;
    document.getElementById('legend-total').textContent = filtered ? (total + ' of ' + all + ' places') : (all + ' places');
  }

  function buildAgeChips() {
    var wrap = document.getElementById('age-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    AGE_FILTERS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'age-chip';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.age = f.id;
      b.textContent = f.label;
      b.addEventListener('click', function () {
        activeAges[f.id] = !activeAges[f.id];
        b.classList.toggle('on', !!activeAges[f.id]);
        b.setAttribute('aria-pressed', activeAges[f.id] ? 'true' : 'false');
        refreshAll();
      });
      wrap.appendChild(b);
    });
  }

  function syncDayChips() {
    document.querySelectorAll('#day-chips .age-chip').forEach(function (b) {
      var on = false;
      if (b.dataset.day === 'today') on = activeDay && activeDay === todayDayId();
      else on = !!activeDay && b.dataset.day === activeDay;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function buildDayChips() {
    var wrap = document.getElementById('day-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    DAY_FILTERS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'age-chip';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.day = f.id;
      b.textContent = f.label;
      b.addEventListener('click', function () { setDayFilter(f.id); });
      wrap.appendChild(b);
    });
  }
  function setDayFilter(id) {
    if (!id) {
      activeDay = null;
    } else if (id === 'today') {
      var today = todayDayId();
      activeDay = (activeDay === today) ? null : today;
    } else {
      activeDay = (activeDay === id) ? null : id;
    }
    syncDayChips();
    refreshAll();
  }
  function buildSendChip() {
    var wrap = document.getElementById('send-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'age-chip send-chip';
    b.setAttribute('aria-pressed', 'false');
    b.id = 'send-chip';
    b.textContent = 'SEND / inclusive';
    b.addEventListener('click', function () { setInclusiveFilter(!inclusiveOnly); });
    wrap.appendChild(b);
  }
  function setInclusiveFilter(on) {
    inclusiveOnly = !!on;
    var b = document.getElementById('send-chip');
    if (b) {
      b.classList.toggle('on', inclusiveOnly);
      b.setAttribute('aria-pressed', inclusiveOnly ? 'true' : 'false');
    }
    refreshAll();
  }
  function setLayerVisible(id, on) {
    if (!state[id]) return;
    state[id].visible = !!on;
    var input = document.querySelector('#legend-list input[data-layer="' + id + '"]:not([data-cat])');
    if (input) input.checked = !!on;
    refreshVisibility(id);
  }


  var AREA = window.AREA_LAYER || null;
  var areaState = {
    on: !!(AREA && AREA.defaultOn !== false),
    groups: {}
  };
  if (AREA && AREA.groups) {
    AREA.groups.forEach(function (g) { areaState.groups[g] = true; });
  }

  function areaFilterExpr() {
    var groups = Object.keys(areaState.groups).filter(function (g) { return areaState.groups[g]; });
    if (!areaState.on || !groups.length) return ['==', ['get', 'id'], '__none__'];
    return ['in', ['get', 'group'], ['literal', groups]];
  }

  function applyAreaFilter() {
    if (!map.getLayer('housing-fill')) return;
    var f = areaFilterExpr();
    map.setFilter('housing-fill', f);
    map.setFilter('housing-line', f);
  }

  function areaPopupHtml(p) {
    var approx = (p.boundary || '').indexOf('approximate') !== -1;
    var badge = approx
      ? '<p class="ap-badge">Boundary is approximate — official character-area maps were not available</p>'
      : '<p class="ap-badge official">Conservation-area boundary</p>';
    var src = String(p.sources || '').replace(/ \| /g, '; ');
    var note = p.boundary_note ? '<p class="ap-note">' + esc(p.boundary_note) + '</p>' : '';
    return '<article class="apop">' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="ap-group">' + esc(p.group) + '</p>' +
      badge +
      '<p class="ap-desc">' + esc(p.description) + '</p>' +
      '<p class="ap-style"><strong>Typical homes.</strong> ' + esc(p.style) + '</p>' +
      '<p class="ap-price">' + esc(p.price_text) + '</p>' +
      '<p class="ap-src">' + esc(src) + '</p>' +
      note +
      '<p class="ap-ogl">Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.</p>' +
      '</article>';
  }

  function addAreaLayer() {
    if (!AREA) return Promise.resolve();
    return fetch(AREA.file).then(function (r) {
      if (!r.ok) throw new Error(AREA.file + ' ' + r.status);
      return r.json();
    }).then(function (data) {
      if (map.getSource('housing-areas')) return;
      map.addSource('housing-areas', { type: 'geojson', data: data });
      map.addLayer({
        id: 'housing-fill',
        type: 'fill',
        source: 'housing-areas',
        filter: areaFilterExpr(),
        paint: {
          'fill-color': [
            'match', ['get', 'group'],
            'Dorking town', '#c45c48',
            'Villages', '#2a7a74',
            '#7a5a36'
          ],
          'fill-opacity': 0.28
        }
      });
      map.addLayer({
        id: 'housing-line',
        type: 'line',
        source: 'housing-areas',
        filter: areaFilterExpr(),
        paint: {
          'line-color': [
            'match', ['get', 'group'],
            'Dorking town', '#8b3d4a',
            'Villages', '#1f5e59',
            '#5a4228'
          ],
          'line-width': 1.6,
          'line-opacity': 0.9
        }
      });
      var areaPopup = new gl.Popup({ maxWidth: '320px', closeButton: true, offset: 10 });
      function openArea(e) {
        var f = e.features && e.features[0];
        if (!f) return;
        if (openPopup) { openPopup.remove(); openPopup = null; }
        areaPopup.setLngLat(e.lngLat).setHTML(areaPopupHtml(f.properties)).addTo(map);
        openPopup = areaPopup;
      }
      ['housing-fill', 'housing-line'].forEach(function (id) {
        map.on('click', id, openArea);
        map.on('mouseenter', id, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, function () { map.getCanvas().style.cursor = ''; });
      });
    }).catch(function (err) { console.warn('Where to live layer failed:', err); });
  }

  function appendAreaLegend() {
    if (!AREA) return;
    var list = document.getElementById('legend-list');
    var li = document.createElement('li');
    li.className = 'lg-row lg-area';
    li.innerHTML =
      '<label><input type="checkbox" ' + (areaState.on ? 'checked' : '') + ' data-area-master="1">' +
      '<span class="lg-icon" style="--c:' + AREA.colour + '">' + svgIcon('home', 14) + '</span>' +
      '<span class="lg-name">' + esc(AREA.name) + '</span></label>';
    var ul = document.createElement('ul');
    ul.className = 'lg-sub';
    (AREA.groups || []).forEach(function (g) {
      var sli = document.createElement('li');
      var col = g === 'Villages' ? '#2a7a74' : '#c45c48';
      sli.innerHTML = '<label><input type="checkbox" ' + (areaState.groups[g] ? 'checked' : '') +
        ' data-area-group="' + esc(g) + '">' +
        '<span class="lg-dot" style="background:' + col + '"></span>' +
        '<span class="lg-name">' + esc(g) + '</span></label>';
      ul.appendChild(sli);
    });
    li.appendChild(ul);
    list.appendChild(li);
  }

  function buildLegend() {
    var list = document.getElementById('legend-list');
    list.innerHTML = '';
    LAYERS.forEach(function (layer) {
      var st = state[layer.id];
      var li = document.createElement('li');
      li.className = 'lg-row' + (layer.comingSoon ? ' soon' : '');
      var count = layer.comingSoon ? '<span class="lg-soon">coming soon</span>' : '<span class="lg-count">' + st.markers.length + '</span>';
      li.innerHTML =
        '<label><input type="checkbox" ' + (layer.comingSoon ? 'disabled' : 'checked') + ' data-layer="' + layer.id + '">' +
        '<span class="lg-icon" style="--c:' + layer.colour + '">' + svgIcon(layer.icon, 14) + '</span>' +
        '<span class="lg-name">' + esc(layer.name) + '</span>' + count + '</label>';
      if (!layer.comingSoon && layer.subfilters && layer.categoryField && st) {
        var cats = [];
        st.markers.forEach(function (m) {
          if (m.category && cats.indexOf(m.category) === -1) cats.push(m.category);
        });
        var order = layer.categoryOrder || [];
        cats.sort(function (a, b) {
          var ia = order.indexOf(a), ib = order.indexOf(b);
          if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        if (cats.length) {
          var ul = document.createElement('ul');
          ul.className = 'lg-sub';
          cats.forEach(function (cat) {
            var sli = document.createElement('li');
            sli.innerHTML = '<label><input type="checkbox" checked data-layer="' + esc(layer.id) + '" data-cat="' + esc(cat) + '">' +
              '<span class="lg-dot" style="background:' + layer.colour + '"></span>' +
              '<span class="lg-name">' + esc(catLabel(layer, cat)) + '</span>' +
              '<span class="lg-count"></span></label>';
            ul.appendChild(sli);
          });
          li.appendChild(ul);
        }
      }
      list.appendChild(li);
    });
    appendAreaLegend();
    list.addEventListener('change', function (e) {
      var t = e.target, id = t.getAttribute('data-layer'), cat = t.getAttribute('data-cat');
      var areaMaster = t.getAttribute('data-area-master');
      var areaGroup = t.getAttribute('data-area-group');
      if (areaMaster) {
        areaState.on = t.checked;
        applyAreaFilter();
        return;
      }
      if (areaGroup) {
        areaState.groups[areaGroup] = t.checked;
        applyAreaFilter();
        return;
      }
      if (!id) return;
      if (cat) state[id].hiddenCats[cat] = !t.checked;
      else state[id].visible = t.checked;
      refreshVisibility(id);
    });
    updateLegendCounts();
  }

  function addSatellite() {
    var sat = window.BASEMAPS.satellite;
    if (map.getSource('sat')) return;
    map.addSource('sat', { type: 'raster', tiles: sat.tiles, tileSize: 256, maxzoom: 19, attribution: sat.attribution });
    map.addLayer({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } });
  }
  function setBasemap(kind) {
    if (!map.getLayer('sat')) return;
    map.setLayoutProperty('sat', 'visibility', kind === 'satellite' ? 'visible' : 'none');
    document.querySelectorAll('.bm-btn').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-bm') === kind);
    });
    document.body.classList.toggle('is-sat', kind === 'satellite');
  }
  document.querySelectorAll('.bm-btn').forEach(function (b) {
    b.addEventListener('click', function () { setBasemap(b.getAttribute('data-bm')); });
  });

  var legend = document.getElementById('legend');
  function setLegend(open) {
    legend.classList.toggle('open', open);
    document.body.classList.toggle('legend-open', open);
  }
  document.getElementById('legend-open').addEventListener('click', function () { setLegend(true); });
  document.getElementById('legend-close').addEventListener('click', function () { setLegend(false); });
  if (window.matchMedia('(min-width: 760px)').matches) setLegend(true);

  function loadCsv(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    }).then(function (txt) {
      return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    });
  }

  LAYERS.forEach(function (l) { state[l.id] = { visible: !l.comingSoon, markers: [], hiddenCats: {} }; });
  buildAgeChips();
  buildDayChips();
  buildSendChip();

  map.on('load', function () {
    addSatellite();
    var jobs = LAYERS.filter(function (l) { return !l.comingSoon; }).map(function (layer) {
      return loadCsv(layer.file).then(function (rows) { addMarkers(layer, rows); })
        .catch(function (err) { console.warn('Layer failed:', layer.name, err); });
    });
    jobs.push(addAreaLayer());
    Promise.all(jobs).then(function () {
      buildLegend();
      var b = new gl.LngLatBounds();
      LAYERS.forEach(function (l) { state[l.id].markers.forEach(function (m) { b.extend(m.lnglat); }); });
      var wide = window.innerWidth >= 760, core = window.MAP_START.phoneBounds;
      if (!wide && core) {
        map.fitBounds(core, { padding: { top: 70, bottom: 90, left: 10, right: 10 }, duration: 0 });
      } else if (!b.isEmpty()) {
        map.fitBounds(b, { padding: wide ? { top: 50, bottom: 60, left: 350, right: 70 } : { top: 40, bottom: 90, left: 30, right: 30 }, duration: 0, maxZoom: 12.2 });
      }
      recluster();
      map.on('zoomend', recluster);
      document.body.classList.add('ready');
      window.__dorking = {
        map: map, state: state, setBasemap: setBasemap, setLegend: setLegend,
        openPlace: openPlace, recluster: recluster, tellUsHref: tellUsHref,
        setTellUsLink: setTellUsLink, setAgeFilter: setAgeFilter,
        setDayFilter: setDayFilter, setInclusiveFilter: setInclusiveFilter,
        setLayerVisible: setLayerVisible
      };
      var q = new URLSearchParams(location.search).get('place');
      if (q) openPlace(q);
    });
  });

  function allMarkers() {
    var out = [];
    Object.keys(state).forEach(function (id) { state[id].markers.forEach(function (m) { out.push(m); }); });
    return out;
  }
  function setAgeFilter(id, on) {
    if (id == null) {
      activeAges = {};
    } else {
      activeAges[id] = !!on;
    }
    document.querySelectorAll('.age-chip').forEach(function (b) {
      var onChip = !!activeAges[b.dataset.age];
      b.classList.toggle('on', onChip);
      b.setAttribute('aria-pressed', onChip ? 'true' : 'false');
    });
    refreshAll();
  }
  function openPlace(name) {
    var needle = String(name).toLowerCase();
    var list = allMarkers();
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (String(m.name || m.marker._dkName || '').toLowerCase().indexOf(needle) !== -1) {
        if (openPopup && openPopup.isOpen()) openPopup.remove();
        // make sure its layer is visible and age filter doesn't hide it
        Object.keys(state).forEach(function (id) {
          if (state[id].markers.indexOf(m) !== -1) state[id].visible = true;
        });
        map.jumpTo({ center: m.lnglat, zoom: Math.max(map.getZoom(), 13.5) });
        if (m.clustered) map.jumpTo({ center: m.lnglat, zoom: FAN_ZOOM + 0.2 });
        m.marker.getElement().style.display = '';
        if (!m.marker.getPopup().isOpen()) m.marker.togglePopup();
        return true;
      }
    }
    return false;
  }

  (function initSearch() {
    var input = document.getElementById('place-search');
    var list = document.getElementById('search-results');
    if (!input || !list) return;
    var items = [], active = -1;
    function hide() { list.hidden = true; items = []; active = -1; }
    function render() {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<li class="sr-empty">No matches</li>';
        list.hidden = false;
        return;
      }
      items.forEach(function (m, i) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        if (i === active) btn.className = 'active';
        btn.innerHTML = esc(m.name) + '<span class="sr-cat">' + esc((m.category || '') + (m.ageMin != null || m.ageMax != null ? ' · ' + ageLabel(m.ageMin, m.ageMax) : '')) + '</span>';
        btn.addEventListener('click', function () { hide(); input.blur(); openPlace(m.name); });
        li.appendChild(btn);
        list.appendChild(li);
      });
      list.hidden = false;
    }
    input.addEventListener('input', function () {
      var needle = input.value.trim().toLowerCase();
      if (needle.length < 2) { hide(); return; }
      items = allMarkers().filter(function (m) { return (m.search || '').indexOf(needle) !== -1; }).slice(0, 12);
      active = items.length ? 0 : -1;
      render();
    });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === 'Enter' && items[active]) { e.preventDefault(); hide(); openPlace(items[active].name); }
      else if (e.key === 'Escape') hide();
    });
    document.addEventListener('click', function (e) {
      if (!list.contains(e.target) && e.target !== input) hide();
    });
  })();
})();
