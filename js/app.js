/* Surrey Hills, from Dorking — map app (MapLibre GL / Mapbox GL compatible) */
(function () {
  'use strict';

  // ---- Library switch: MapLibre today, Mapbox later (same API) ----
  var gl = window.MAP_PROVIDER.library === 'mapbox' ? window.mapboxgl : window.maplibregl;
  if (window.MAP_PROVIDER.library === 'mapbox') gl.accessToken = window.MAP_PROVIDER.mapboxToken;

  var LAYERS = window.LAYERS, ICONS = window.ICONS;
  var state = {};            // layerId -> { visible, markers:[{marker, category}], hiddenCats:{} }
  var openPopup = null;

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
  map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svgIcon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || ICONS.landmark) + '"/></svg>';
  }
  function colourFor(layer, row) {
    if (layer.categoryField && layer.categories) {
      return layer.categories[row[layer.categoryField]] || layer.colour;
    }
    return layer.colour;
  }
  function isUrl(s) { return /^https?:\/\//i.test(String(s || '').trim()); }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'Website'; } }

  function popupHtml(layer, row, colour) {
    var f = layer.fields, v = function (k) {
      // a field may map to one column or to a list of columns (joined with a space)
      var cols = f[k] ? [].concat(f[k]) : [];
      return cols.map(function (c) { return (row[c] || '').trim(); }).filter(Boolean).join(' ');
    };
    var lat = row.Latitude, lng = row.Longitude;
    var cat = layer.categoryField ? row[layer.categoryField] : layer.name;
    var h = '<div class="pop">';
    h += '<div class="pop-cat" style="color:' + colour + '"><span class="pop-dot" style="background:' + colour + '"></span>' + esc(cat) + '</div>';
    h += '<h3>' + esc(v('name')) + '</h3>';
    if (v('description')) h += '<p class="pop-desc">' + esc(v('description')) + '</p>';
    if (v('practical')) h += '<p class="pop-meta"><strong>Good to know</strong> ' + esc(v('practical')) + '</p>';
    if (v('nearby')) h += '<p class="pop-meta"><strong>Nearby</strong> ' + esc(v('nearby')) + '</p>';
    if (v('lore')) h += '<details class="pop-more"><summary>Read more</summary><p>' + esc(v('lore')) + '</p></details>';
    if (v('address')) h += '<p class="pop-addr">' + esc(v('address')) + '</p>';
    if (/approx/i.test(v('precision'))) h += '<p class="pop-approx">Approximate location</p>';
    h += '<div class="pop-actions">';
    h += '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' +
         encodeURIComponent(lat + ',' + lng) + '">Directions</a>';
    if (isUrl(v('website'))) h += '<a class="btn" target="_blank" rel="noopener" href="' + esc(v('website')) + '">Website ↗</a>';
    h += '</div></div>';
    return h;
  }

  // Pan so an open pop-up (drawn above its pin) is fully visible and clear of the legend
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
    // only move if the pop-up would be clipped or under the legend
    var clipped = (p.y - ph - 50 < 0) || (p.x - pw / 2 < leftPad + 10) || (p.x + pw / 2 > W - 60) || (p.y > H - 20);
    if (clipped) map.panBy([dx, dy], { duration: 350 });
  }

  // ---------- markers ----------
  function addMarkers(layer, rows) {
    var st = state[layer.id];
    rows.forEach(function (row) {
      var lat = parseFloat(row.Latitude), lng = parseFloat(row.Longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      var colour = colourFor(layer, row);
      var el = document.createElement('button');
      el.className = 'pin';
      el.type = 'button';
      el.setAttribute('aria-label', row[layer.fields.name] || layer.name);
      el.title = row[layer.fields.name] || '';
      el.style.setProperty('--c', colour);
      el.innerHTML = '<span class="pin-body">' + svgIcon(layer.icon, 15) + '</span>';
      var popup = new gl.Popup({ offset: [0, -36], anchor: 'bottom', maxWidth: '320px', closeButton: true, focusAfterOpen: false })
        .setHTML(popupHtml(layer, row, colour));
      popup.on('open', function () {
        openPopup = popup; el.classList.add('active');
        requestAnimationFrame(function () { fitPopup(popup, [lng, lat]); });
      });
      popup.on('close', function () { el.classList.remove('active'); });
      var marker = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).setPopup(popup).addTo(map);
      marker._dkName = row[layer.fields.name];
      st.markers.push({ marker: marker, category: layer.categoryField ? row[layer.categoryField] : null, lnglat: [lng, lat] });
    });
  }
  function refreshVisibility(layerId) {
    var st = state[layerId];
    st.markers.forEach(function (m) {
      var show = st.visible && !(m.category && st.hiddenCats[m.category]);
      m.marker.getElement().style.display = show ? '' : 'none';
      if (!show && m.marker.getPopup().isOpen()) m.marker.togglePopup();
    });
  }

  // ---------- legend ----------
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
      list.appendChild(li);
      if (layer.categories && !layer.comingSoon) {
        var sub = document.createElement('ul');
        sub.className = 'lg-sub';
        Object.keys(layer.categories).forEach(function (cat) {
          var n = st.markers.filter(function (m) { return m.category === cat; }).length;
          if (!n) return;
          var s = document.createElement('li');
          s.innerHTML = '<label><input type="checkbox" checked data-layer="' + layer.id + '" data-cat="' + esc(cat) + '">' +
            '<span class="lg-dot" style="background:' + layer.categories[cat] + '"></span>' +
            '<span class="lg-name">' + esc(cat) + '</span><span class="lg-count">' + n + '</span></label>';
          sub.appendChild(s);
        });
        li.appendChild(sub);
      }
    });
    list.addEventListener('change', function (e) {
      var t = e.target, id = t.getAttribute('data-layer'), cat = t.getAttribute('data-cat');
      if (!id) return;
      if (cat) state[id].hiddenCats[cat] = !t.checked;
      else {
        state[id].visible = t.checked;
        var subs = list.querySelectorAll('input[data-layer="' + id + '"][data-cat]');
        subs.forEach(function (s) { s.disabled = !t.checked; });
      }
      refreshVisibility(id);
    });
    var total = LAYERS.reduce(function (a, l) { return a + (state[l.id] ? state[l.id].markers.length : 0); }, 0);
    document.getElementById('legend-total').textContent = total + ' places';
  }

  // ---------- basemap toggle (map / satellite) ----------
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

  // ---------- mobile legend toggle ----------
  var legend = document.getElementById('legend');
  function setLegend(open) {
    legend.classList.toggle('open', open);
    document.body.classList.toggle('legend-open', open);
  }
  document.getElementById('legend-open').addEventListener('click', function () { setLegend(true); });
  document.getElementById('legend-close').addEventListener('click', function () { setLegend(false); });
  if (window.matchMedia('(min-width: 760px)').matches) setLegend(true);

  // ---------- load data ----------
  function loadCsv(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    }).then(function (txt) {
      return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    });
  }

  LAYERS.forEach(function (l) { state[l.id] = { visible: !l.comingSoon, markers: [], hiddenCats: {} }; });

  map.on('load', function () {
    addSatellite();
    var jobs = LAYERS.filter(function (l) { return !l.comingSoon; }).map(function (layer) {
      return loadCsv(layer.file).then(function (rows) { addMarkers(layer, rows); })
        .catch(function (err) { console.warn('Layer failed:', layer.name, err); });
    });
    Promise.all(jobs).then(function () {
      buildLegend();
      // Fit to everything on first load
      var b = new gl.LngLatBounds();
      LAYERS.forEach(function (l) { state[l.id].markers.forEach(function (m) { b.extend(m.lnglat); }); });
      if (!b.isEmpty()) {
        var wide = window.innerWidth >= 760;
        map.fitBounds(b, { padding: wide ? { top: 50, bottom: 60, left: 350, right: 70 } : { top: 40, bottom: 90, left: 30, right: 30 }, duration: 0, maxZoom: 13 });
      }
      document.body.classList.add('ready');
      // Expose for testing / deep links
      window.__dorking = { map: map, state: state, setBasemap: setBasemap, setLegend: setLegend, openPlace: openPlace };
      var q = new URLSearchParams(location.search).get('place');
      if (q) openPlace(q);
    });
  });

  function openPlace(name) {
    var needle = String(name).toLowerCase();
    for (var id in state) {
      for (var i = 0; i < state[id].markers.length; i++) {
        var m = state[id].markers[i];
        if (String(m.marker._dkName || '').toLowerCase().indexOf(needle) !== -1) {
          map.jumpTo({ center: m.lnglat, zoom: Math.max(map.getZoom(), 12.5) });
          if (!m.marker.getPopup().isOpen()) m.marker.togglePopup();
          return true;
        }
      }
    }
    return false;
  }
})();
