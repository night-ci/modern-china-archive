(function () {
  var el = document.getElementById('map');
  if (!el) return;
  var info = document.getElementById('mapInfo');
  var events = window.__EVENTS__ || [];

  if (typeof L === 'undefined') {
    el.innerHTML = '<div style="padding:24px;color:#7a6a58;font-size:13px;line-height:1.8">地图库未加载。请刷新页面，或检查网络。</div>';
    return;
  }

  var KEY = 'f6586be5cd41bc34eb5d469c7b4d37b3';
  var TILE = 'https://t{s}.tianditu.gov.cn/{layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER={layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&tk=' + KEY + '&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
  var ATTRIB = '天地图 · 国家地理信息公共服务平台 · GS(2026)4921号';

  var map = L.map('map', { zoomControl: true, attributionControl: true, zoomSnap: 0.5 })
    .setView([34.0, 108.5], 4.5);

  function addLayer(layer, opts) {
    var url = TILE.replace(/\{layer\}/g, layer);
    return L.tileLayer(url, Object.assign({
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maxZoom: 18,
      attribution: ATTRIB
    }, opts || {})).addTo(map);
  }

  addLayer('vec');
  addLayer('cva');

  function showEvent(ev) {
    if (!info) return;
    var first = (ev.places && ev.places[0]) || null;
    info.innerHTML =
      '<p class="period">' + ev.period + '</p>' +
      '<h3>' + ev.title + '</h3>' +
      '<p class="date">' + ev.date + '</p>' +
      (first ? '<p class="period">' + first.historical + '</p>' : '') +
      '<p class="map-label">导览</p>' +
      '<p class="map-overview">' + (ev.overview || '').slice(0, 140) + ((ev.overview || '').length > 140 ? '…' : '') + '</p>' +
      '<p class="src">据 ' + (ev.source || '') + ' 整理</p>' +
      '<a class="btn primary" href="' + ev.url + '">查看原文与出处</a>';
  }

  var seen = {};
  events.forEach(function (ev) {
    (ev.places || []).forEach(function (p) {
      if (!p.coord || p.coord.length < 2) return;
      var key = ev.id + '@' + p.coord.join(',');
      if (seen[key]) return;
      seen[key] = 1;
      var marker = L.circleMarker([p.coord[1], p.coord[0]], {
        radius: 6.5,
        color: '#ffffff',
        weight: 1.6,
        fillColor: '#b3141c',
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindTooltip(ev.title, { direction: 'top', offset: [0, -6] });
      marker.on('click', function () { showEvent(ev); });
    });
  });

  if (events[0]) showEvent(events[0]);
})();
