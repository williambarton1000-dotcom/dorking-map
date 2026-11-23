/* Commercial listings preview — facts and a link only. */
(function () {
  var gl = maplibregl;
  var CFG = window.MAP_CONFIG || {};
  var LAYERS = window.LAYERS || [];
  var ICONS = window.ICONS || {};
  var BASEMAPS = window.BASEMAPS;
  var MAP_START = window.MAP_START;
  var POP_OFFSET = [0, -36];
  var CLUSTER_PX = 40;
  var SPIDER_ZOOM = 16;

  var map, listings = [], state = {}, openPopup = null, groupEls = [];
  var agentFilter = null;
  var showServiced = true;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function svgIcon(name, size) {
    var d = ICONS[name] || ICONS.office || '';
    return '<svg viewBox="0 0 24 24" width="' + (size || 15) + '" height="' + (size || 15) +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      d + '</svg>';
  }

  function layerById(id) {
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i].id === id) return LAYERS[i];
    return LAYERS[0];
  }

  function tenureLabel(t) {
    t = (t || '').toLowerCase();
    if (t === 'let' || t === 'to let') return 'To let';
    if (t === 'sale' || t === 'for sale') return 'For sale';
    if (t === 'sale/let' || t === 'sale / let') return 'For sale or to let';
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function agentLinkName(agent) {
    var first = (agent || 'the agent').split(',')[0].trim();
    return first;
  }

  function parseQuery() {
    var q = {};
    (location.search || '').replace(/^\?/, '').split('&').forEach(function (p) {
      if (!p) return;
      var kv = p.split('=');
      q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return q;
  }

  function inAgentFilter(row) {
    if (!agentFilter) return true;
    var slug = (row.agent_slug || '').toLowerCase();
    var names = (row.agent || '').toLowerCase();
    if (slug === agentFilter) return true;
    // Chapel Lane style joint agency
    var parts = names.split(',').map(function (s) { return s.trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-'); });
    return parts.indexOf(agentFilter) !== -1 || names.indexOf(agentFilter.replace(/-/g, ' ')) !== -1;
  }

  function isShown(row) {
    var st = state[row.layer];
    if (!st || !st.visible) return false;
    if (row.layer === 'offices' && row.serviced && !showServiced) return false;
    return inAgentFilter(row);
  }

  function popupHtml(row, colour, layer) {
    var facts = '';
    function rowf(k, v) {
      if (!v) return '';
      return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
    }
    facts += rowf('Type', row.type_label || (layer && layer.name) || '');
    facts += rowf('Size', row.size);
    facts += rowf('Tenure', tenureLabel(row.tenure));
    facts += rowf('Price', row.price);
    var approx = row.coord_precision === 'approximate'
      ? '<p class="cpop-approx">Approximate location</p>' : '';
    var links = [];
    var urls = (row.urls && row.urls.length) ? row.urls : (row.url ? [row.url] : []);
    var agents = (row.agent || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (urls.length === 1) {
      links.push('<a class="btn" href="' + esc(urls[0]) + '" target="_blank" rel="noopener nofollow">View on ' +
        esc(agentLinkName(agents[0] || 'the agent')) + ' website</a>');
    } else {
      urls.forEach(function (u, i) {
        var name = agents[i] || agentLinkName(agents[0] || 'the agent');
        // Prefer host-based label
        if (/robinsonsmb\.com/i.test(u)) name = 'Robinsons';
        else if (/hurstwarne/i.test(u)) name = 'Hurst Warne';
        links.push('<a class="btn' + (i ? ' btn-ghost' : '') + '" href="' + esc(u) +
          '" target="_blank" rel="noopener nofollow">View on ' + esc(name) + ' website</a>');
      });
    }
    var town = row.town || '';
    var showTown = town && (row.name || '').toLowerCase().indexOf(town.toLowerCase()) === -1;
    return '<div class="cpop">' +
      '<div class="cpop-kicker" style="--c:' + colour + '">' + esc((layer && layer.name) || row.type_label || '') + '</div>' +
      '<h3>' + esc(row.name) + '</h3>' +
      (showTown ? '<p class="cpop-area">' + esc(town) + '</p>' : '') +
      '<dl class="cpop-facts">' + facts + '</dl>' +
      approx +
      '<div class="aerial-slot">' +
        '<img src="img/aerial-placeholder.svg" alt="">' +
        '<span class="aerial-caption">New or existing aerial image</span>' +
      '</div>' +
      '<div class="cpop-actions">' + links.join('') + '</div>' +
    '</div>';
  }

  function fitPopup(popup, lnglat) {
    var pe = popup.getElement(); if (!pe) return;
    var mapH = map.getContainer().clientHeight;
    var popH = pe.offsetHeight || 0;
    var pt = map.project(lnglat);
    var top = pt.y - popH - 48;
    if (top < 12) {
      map.panBy([0, top - 12], { duration: 300 });
    }
    var pad = 16;
    if (pt.x < pad + 40) map.panBy([pt.x - (pad + 80), 0], { duration: 300 });
    if (pt.x > map.getContainer().clientWidth - pad - 40) {
      map.panBy([pt.x - (map.getContainer().clientWidth - pad - 80), 0], { duration: 300 });
    }
  }

  function addMarker(row) {
    var layer = layerById(row.layer) || { id: row.layer, colour: '#5a6e9a', icon: 'office' };
    var colour = layer.colour;
    var el = document.createElement('button');
    el.className = 'pin';
    el.type = 'button';
    el.style.setProperty('--c', colour);
    el.setAttribute('aria-label', row.name);
    el.innerHTML = '<span class="pin-body">' + svgIcon(layer.icon, 15) + '</span>';
    var popup = new gl.Popup({ offset: POP_OFFSET, anchor: 'bottom', maxWidth: '300px', closeButton: true, focusAfterOpen: false })
      .setHTML(popupHtml(row, colour, layer));
    popup.on('open', function () {
      openPopup = popup; el.classList.add('active');
      requestAnimationFrame(function () { fitPopup(popup, [row.lon, row.lat]); });
    });
    popup.on('close', function () {
      el.classList.remove('active');
      if (openPopup === popup) openPopup = null;
    });
    var marker = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([row.lon, row.lat]).setPopup(popup).addTo(map);
    marker._dkName = row.name;
    marker._dkId = row.id;
    marker._dkPopOffset = POP_OFFSET;
    var rec = { marker: marker, row: row, lnglat: [row.lon, row.lat], name: row.name, clustered: false };
    state[row.layer].markers.push(rec);
    return rec;
  }

  function allRecs() {
    var out = [];
    LAYERS.forEach(function (l) {
      if (state[l.id]) state[l.id].markers.forEach(function (m) { out.push(m); });
    });
    return out;
  }

  function setOffset(m, dx, dy) {
    m.marker.setOffset([dx, dy]);
    var po = m.marker._dkPopOffset || POP_OFFSET;
    m.marker.getPopup().setOffset([po[0] + dx, po[1] + dy]);
  }

  function clearGroups() {
    groupEls.forEach(function (g) { try { g.remove(); } catch (e) {} });
    groupEls = [];
  }

  function addSpiderLegs(centre, members, radius) {
    var wrap = document.createElement('div');
    wrap.className = 'spider';
    wrap.style.width = (radius * 2 + 8) + 'px';
    wrap.style.height = (radius * 2 + 8) + 'px';
    wrap.style.pointerEvents = 'none';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', radius * 2 + 8);
    svg.setAttribute('height', radius * 2 + 8);
    var cx = radius + 4, cy = radius + 4;
    members.forEach(function (m, i) {
      var ang = (Math.PI * 2 * i) / members.length - Math.PI / 2;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', cx); line.setAttribute('y1', cy);
      line.setAttribute('x2', cx + Math.cos(ang) * radius);
      line.setAttribute('y2', cy + Math.sin(ang) * radius);
      svg.appendChild(line);
    });
    wrap.appendChild(svg);
    var marker = new gl.Marker({ element: wrap, anchor: 'center' }).setLngLat(centre).addTo(map);
    groupEls.push(marker);
  }

  function addClusterBubble(centre, members) {
    var colours = {};
    members.forEach(function (m) {
      var l = layerById(m.row.layer);
      colours[(l && l.colour) || '#6e3b3a'] = true;
    });
    var cols = Object.keys(colours);
    var el = document.createElement('button');
    el.className = 'cluster';
    el.type = 'button';
    el.style.setProperty('--ring', cols[0] || '#6e3b3a');
    el.innerHTML = '<span>' + members.length + '</span>';
    el.setAttribute('aria-label', members.length + ' listings');
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var b = new gl.LngLatBounds();
      members.forEach(function (m) { b.extend(m.lnglat); });
      if (map.getZoom() >= SPIDER_ZOOM - 0.2) {
        map.easeTo({ center: centre, zoom: Math.min(map.getZoom() + 0.4, 18), duration: 300 });
      } else {
        map.fitBounds(b, { padding: 80, maxZoom: 17, duration: 500 });
      }
    });
    var marker = new gl.Marker({ element: el, anchor: 'center' }).setLngLat(centre).addTo(map);
    groupEls.push(marker);
  }

  function rebuildClusters() {
    clearGroups();
    allRecs().forEach(function (m) {
      if (!isShown(m.row)) {
        setOffset(m, 0, 0);
        m.marker.getElement().style.display = 'none';
        m.clustered = false;
        return;
      }
      m.clustered = false;
      setOffset(m, 0, 0);
      m.marker.getElement().style.display = '';
    });
    var items = allRecs().filter(function (m) { return isShown(m.row); });
    var zoom = map.getZoom();
    var used = {};
    for (var i = 0; i < items.length; i++) {
      if (used[i]) continue;
      var a = items[i];
      var pa = map.project(a.lnglat);
      var group = [a];
      var idx = [i];
      for (var j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        var pb = map.project(items[j].lnglat);
        var dx = pa.x - pb.x, dy = pa.y - pb.y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) {
          group.push(items[j]); idx.push(j);
        }
      }
      if (group.length < 2) continue;
      idx.forEach(function (k) { used[k] = true; });
      var centre = a.lnglat;
      if (zoom >= SPIDER_ZOOM) {
        var radius = 28 + Math.min(group.length, 10) * 4;
        group.forEach(function (m, n) {
          var ang = (Math.PI * 2 * n) / group.length - Math.PI / 2;
          setOffset(m, Math.cos(ang) * radius, Math.sin(ang) * radius);
          m.marker.getElement().style.display = '';
          m.clustered = true;
        });
        addSpiderLegs(centre, group, radius);
      } else {
        group.forEach(function (m) {
          m.marker.getElement().style.display = 'none';
          m.clustered = true;
        });
        addClusterBubble(centre, group);
      }
    }
  }

  function refreshVisibility() {
    allRecs().forEach(function (m) {
      var show = isShown(m.row);
      if (!show && m.marker.getPopup().isOpen()) m.marker.getPopup().remove();
    });
    rebuildClusters();
    updateLegendCounts();
  }

  function updateLegendCounts() {
    var total = 0;
    LAYERS.forEach(function (l) {
      if (l.comingSoon) return;
      var n = (state[l.id] ? state[l.id].markers : []).filter(function (m) { return inAgentFilter(m.row); }).length;
      var countEl = document.querySelector('.lg-count[data-layer="' + l.id + '"]');
      if (countEl) countEl.textContent = n;
      var row = document.querySelector('.lg-row[data-layer="' + l.id + '"]');
      if (row && CFG.hideEmptyLayers) row.style.display = n ? '' : 'none';
      if (l.id === 'offices') {
        var sn = (state.offices ? state.offices.markers : []).filter(function (m) { return m.row.serviced && inAgentFilter(m.row); }).length;
        var sub = document.getElementById('serviced-count');
        if (sub) sub.textContent = sn;
      }
      total += n;
    });
    var tot = document.getElementById('legend-total');
    if (tot) tot.textContent = total + ' listing' + (total === 1 ? '' : 's');
  }

  function buildLegend() {
    var list = document.getElementById('legend-list');
    if (!list) return;
    list.innerHTML = '';
    LAYERS.forEach(function (l) {
      var li = document.createElement('li');
      li.className = 'lg-row' + (l.comingSoon ? ' soon' : '');
      li.dataset.layer = l.id;
      var count = l.comingSoon
        ? '<span class="lg-soon">coming soon</span>'
        : '<span class="lg-count" data-layer="' + l.id + '">0</span>';
      var checked = l.comingSoon ? '' : ' checked';
      var disabled = l.comingSoon ? ' disabled' : '';
      li.innerHTML = '<label><input type="checkbox" data-layer="' + l.id + '"' + checked + disabled + '>' +
        '<span class="lg-icon" style="--c:' + l.colour + '">' + svgIcon(l.icon, 14) + '</span>' +
        '<span class="lg-name">' + esc(l.name) + '</span>' + count + '</label>';
      list.appendChild(li);
      if (l.id === 'offices' && CFG.servicedFilter && !l.comingSoon) {
        var sub = document.createElement('ul');
        sub.className = 'lg-sub';
        sub.innerHTML = '<li><label><input type="checkbox" id="serviced-toggle" checked>' +
          '<span class="lg-name">Serviced / workspace</span>' +
          '<span class="lg-count" id="serviced-count">0</span></label></li>';
        list.appendChild(sub);
      }
    });
    list.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'serviced-toggle') {
        showServiced = t.checked;
        refreshVisibility();
        return;
      }
      var id = t.getAttribute('data-layer');
      if (!id || !state[id]) return;
      state[id].visible = t.checked;
      refreshVisibility();
    });
  }

  function wireChrome() {
    var legend = document.getElementById('legend');
    var openBtn = document.getElementById('legend-open');
    var closeBtn = document.getElementById('legend-close');
    function isMobile() { return window.matchMedia('(max-width:700px)').matches; }
    function showLegend(on) {
      if (on) legend.classList.add('open'); else legend.classList.remove('open');
    }
    showLegend(!isMobile());
    if (openBtn) openBtn.addEventListener('click', function () { showLegend(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { showLegend(false); });
    window.addEventListener('resize', function () {
      if (!isMobile()) showLegend(true);
    });
    document.querySelectorAll('.bm-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.bm-btn').forEach(function (b) { b.classList.toggle('on', b === btn); });
        setBasemap(btn.getAttribute('data-bm'));
      });
    });
    var search = document.getElementById('place-search');
    var results = document.getElementById('search-results');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        if (!q) { results.hidden = true; results.innerHTML = ''; return; }
        var hits = allRecs().filter(function (m) {
          return isShown(m.row) && (m.name + ' ' + (m.row.town || '') + ' ' + (m.row.agent || '')).toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        results.innerHTML = hits.map(function (m) {
          return '<li><button type="button" data-id="' + esc(m.row.id) + '">' + esc(m.name) +
            '<small>' + esc((m.row.town || '') + (m.row.price ? ' · ' + m.row.price : '')) + '</small></button></li>';
        }).join('') || '<li><button type="button" disabled>No matches</button></li>';
        results.hidden = false;
      });
      results.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-id]');
        if (!b) return;
        results.hidden = true;
        openPlace(b.getAttribute('data-id'));
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-wrap')) results.hidden = true;
      });
    }
  }

  var currentBm = 'map';
  function setBasemap(kind) {
    if (kind === currentBm) return;
    currentBm = kind;
    if (kind === 'satellite') {
      if (!map.getSource('sat')) {
        var sat = BASEMAPS.satellite;
        map.addSource('sat', { type: 'raster', tiles: sat.tiles, tileSize: 256, maxzoom: 19, attribution: sat.attribution });
        map.addLayer({ id: 'sat-layer', type: 'raster', source: 'sat' });
      } else {
        map.setLayoutProperty('sat-layer', 'visibility', 'visible');
      }
      // hide liberty layers
      map.getStyle().layers.forEach(function (l) {
        if (l.id !== 'sat-layer' && l.type !== 'raster') {
          try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {}
        }
      });
    } else {
      if (map.getLayer('sat-layer')) map.setLayoutProperty('sat-layer', 'visibility', 'none');
      map.getStyle().layers.forEach(function (l) {
        if (l.id !== 'sat-layer') {
          try { map.setLayoutProperty(l.id, 'visibility', 'visible'); } catch (e) {}
        }
      });
    }
  }

  function openPlace(idOrName) {
    var needle = String(idOrName || '').toLowerCase();
    var found = null;
    allRecs().forEach(function (m) {
      if (found) return;
      if (String(m.row.id).toLowerCase() === needle || String(m.name).toLowerCase().indexOf(needle) !== -1) found = m;
    });
    if (!found) return false;
    var st = state[found.row.layer];
    if (st) {
      st.visible = true;
      var cb = document.querySelector('input[data-layer="' + found.row.layer + '"]');
      if (cb) cb.checked = true;
    }
    if (found.row.serviced) {
      showServiced = true;
      var s = document.getElementById('serviced-toggle');
      if (s) s.checked = true;
    }
    var targetZoom = 17;
    map.easeTo({ center: found.lnglat, zoom: Math.max(map.getZoom(), targetZoom), duration: 500 });
    var opened = false;
    function reveal() {
      if (opened) return;
      opened = true;
      rebuildClusters();
      found.marker.getElement().style.display = '';
      if (!found.marker.getPopup().isOpen()) found.marker.togglePopup();
    }
    map.once('moveend', reveal);
    setTimeout(reveal, 700);
    return true;
  }

  function applyAgentChrome() {
    if (!agentFilter) return;
    var titleEl = document.querySelector('.brand h1');
    var tag = document.querySelector('.tagline');
    var pretty = agentFilter.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    // nicer names
    var names = {
      'robinsons': 'Robinsons', 'hurst-warne': 'Hurst Warne', 'shw': 'SHW',
      'white-and-sons': 'White & Sons', 'owen-isherwood': 'Owen Isherwood',
      'rayners': 'Rayners', 'pwd': 'PWD', 'henry-adams': 'Henry Adams',
      'curchod': 'Curchod & Co', 'michael-rogers': 'Michael Rogers',
      'jll': 'JLL', 'savills': 'Savills', 'knight-frank': 'Knight Frank',
      'halcyon': 'Halcyon Offices', 'regus': 'Regus', 'bizspace': 'Bizspace',
      'office-freedom': 'Office Freedom', 'mileway': 'Mileway',
      'private-boxpod': 'Private listings'
    };
    pretty = names[agentFilter] || pretty;
    if (titleEl) titleEl.innerHTML = esc(pretty) + ' <em>commercial</em>';
    if (tag) tag.textContent = 'Listings around Dorking — a private preview';
    document.title = pretty + ' commercial listings — WB Photography';
    // hide coming soon in agent view
    document.querySelectorAll('.lg-row.soon').forEach(function (el) { el.style.display = 'none'; });
  }

  function boot(data) {
    listings = data || [];
    LAYERS.forEach(function (l) { state[l.id] = { visible: !l.comingSoon, markers: [] }; });

    var q = parseQuery();
    if (q.agent) agentFilter = String(q.agent).toLowerCase().trim();
    applyAgentChrome();
    buildLegend();
    wireChrome();

    map = new gl.Map({
      container: 'map',
      style: BASEMAPS.map.style,
      center: MAP_START.center,
      zoom: MAP_START.zoom,
      attributionControl: true,
      cooperativeGestures: false
    });
    map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new gl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

    map.on('load', function () {
      listings.forEach(function (row) {
        if (row.lat == null || row.lon == null) return;
        if (!state[row.layer]) state[row.layer] = { visible: true, markers: [] };
        addMarker(row);
      });
      updateLegendCounts();
      rebuildClusters();
      map.on('moveend', rebuildClusters);
      document.body.classList.add('ready');
      window.__dorking = {
        map: map,
        openPlace: openPlace,
        listings: listings,
        agentFilter: agentFilter
      };
    });
  }

  var src = CFG.dataUrl || 'data/listings.json';
  fetch(src).then(function (r) { return r.json(); }).then(boot).catch(function (err) {
    console.error(err);
    document.body.classList.add('ready');
  });
})();
