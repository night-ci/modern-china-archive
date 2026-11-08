(function () {
  var el = document.getElementById('map');
  if (!el) return;
  var info = document.getElementById('mapInfo');
  var data = window.__CHRONOLOGY__ || [];
  var search = document.getElementById('mapSearch');
  var countEl = document.getElementById('mapCount');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-map-period]'));
  var period = 'all';
  var KEY = 'f6586be5cd41bc34eb5d469c7b4d37b3';
  var TILE = 'https://t{s}.tianditu.gov.cn/{layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER={layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&tk=' + KEY + '&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
  var ATTRIB = '天地图 · 国家地理信息公共服务平台 · GS(2026)4921号';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  if (typeof L === 'undefined') {
    el.innerHTML = '<div style="padding:24px;color:#7a6a58;font-size:13px">地图库未加载，请刷新页面。</div>';
    return;
  }

  var map = L.map('map', { zoomControl: true, attributionControl: true, zoomSnap: 0.5 })
    .setView([34.0, 108.5], 4.5);

  function addLayer(layer) {
    return L.tileLayer(TILE.replace(/\{layer\}/g, layer), {
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maxZoom: 18,
      attribution: ATTRIB
    }).addTo(map);
  }
  addLayer('vec');
  addLayer('cva');


  var markers = [];

  function groupsForFilter() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var filtered = data.filter(function (d) {
      var okPeriod = period === 'all' || d.period === period;
      var hay = (d.title + ' ' + d.date + ' ' + d.text + ' ' + (d.places || []).map(function (p) { return p.name; }).join(' ')).toLowerCase();
      return okPeriod && (!q || hay.indexOf(q) !== -1);
    });
    var clusters = [];
    filtered.forEach(function (d) {
      (d.places || []).forEach(function (p) {
        if (!p.coord) return;
        var target = null;
        for (var i = 0; i < clusters.length; i++) {
          var g = clusters[i];
          var dx = g.coord[0] - p.coord[0];
          var dy = g.coord[1] - p.coord[1];
          if (Math.sqrt(dx * dx + dy * dy) <= 0.35) { target = g; break; }
        }
        if (!target) {
          target = { names: [], coord: p.coord, items: [] };
          clusters.push(target);
        }
        if (target.names.indexOf(p.name) === -1) target.names.push(p.name);
        if (!target.items.some(function (x) { return x.id === d.id; })) target.items.push(d);
      });
    });
    clusters.forEach(function (g) { g.name = g.names.join(' / '); });
    return { filtered: filtered, groups: clusters.sort(function (a, b) { return b.items.length - a.items.length; }) };
  }

  function showGroup(g) {
    if (!info) return;
    var items = g.items.slice().sort(function (a, b) { return (a.date_start || a.date).localeCompare(b.date_start || b.date); });
    info.innerHTML = '<p class="period">地点</p>' +
      '<h3>' + esc(g.name) + '</h3>' +
      '<p class="date">' + items.length + ' 条</p>' +
      '<div class="map-list">' +
      items.map(function (d) {
        return '<a href="' + esc(d.url) + '"><span>' + esc(d.date) + '</span>' + esc(d.title) + (d.detail ? '<em>详解</em>' : (d.kind === 'pre' ? '<em>前编</em>' : (d.kind === 'prc' ? '<em>国史</em>' : ''))) + '</a>';
      }).join('') +
      '</div>';
  }

  function render() {
    markers.forEach(function (m) { map.removeLayer(m); });
    markers = [];
    var result = groupsForFilter();
    result.groups.forEach(function (g) {
      var r = 4 + Math.min(5, Math.log2(g.items.length + 1) * 1.2);
      var marker = L.circleMarker([g.coord[1], g.coord[0]], {
        radius: r,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#b3141c',
        fillOpacity: 0.92
      }).addTo(map);
      marker.bindTooltip(g.name + '（' + g.items.length + '）', { direction: 'top', offset: [0, -4] });
      marker.on('click', function () { showGroup(g); });
      markers.push(marker);
    });
    if (countEl) countEl.textContent = '有地点 ' + result.filtered.length + ' 条 / 共 ' + (window.__TOTAL__ || data.length) + ' 条';
    if (result.groups.length) showGroup(result.groups[0]);
    else if (info) info.innerHTML = '<p class="muted">没有匹配的地点。</p>';
  }

  if (search) search.addEventListener('input', render);
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      period = btn.getAttribute('data-map-period');
      render();
    });
  });

  render();
})();
