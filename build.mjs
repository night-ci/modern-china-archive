import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'events'), { recursive: true });
fs.mkdirSync(path.join(dist, 'institutions'), { recursive: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
const staticDir = path.join(root, 'static');
if (fs.existsSync(staticDir)) fs.cpSync(staticDir, dist, { recursive: true });

const institutions = JSON.parse(fs.readFileSync(path.join(contentDir, 'institutions.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(contentDir, 'sources.json'), 'utf8'));
const events = fs.readdirSync(path.join(contentDir, 'events'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(contentDir, 'events', f), 'utf8')))
  .sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)));

const chronologyPath = path.join(contentDir, 'chronology.json');
const chronology = fs.existsSync(chronologyPath)
  ? JSON.parse(fs.readFileSync(chronologyPath, 'utf8'))
  : [];
const longCount = chronology.length;
const prePath = path.join(contentDir, 'pre1921.json');
const pre1921 = fs.existsSync(prePath) ? JSON.parse(fs.readFileSync(prePath, 'utf8')) : [];
const preCount = pre1921.length;
const prcPath = path.join(contentDir, 'chronology-prc.json');
const prcChronologyRaw = fs.existsSync(prcPath) ? JSON.parse(fs.readFileSync(prcPath, 'utf8')) : [];
const prcTotal = prcChronologyRaw.length;

const instById = Object.fromEntries(institutions.map(i => [i.id, i]));
const srcById = Object.fromEntries(sources.map(s => [s.id, s]));

const placesPath = path.join(contentDir, 'places.json');
const placeList = fs.existsSync(placesPath) ? JSON.parse(fs.readFileSync(placesPath, 'utf8')) : [];
const cityPlaces = placeList.filter(p => p.type !== 'province');
const provincePlaces = placeList.filter(p => p.type === 'province');

function matchPlaces(text) {
  let hits = cityPlaces.filter(p => text.includes(p.name));
  if (!hits.length) hits = provincePlaces.filter(p => text.includes(p.name));
  if (!hits.length && /中共中央|党中央|中央人民政府|国务院|全国人大|全国政协|中央军委/.test(text)) {
    hits = cityPlaces.filter(p => p.name === '北京');
  }
  hits = hits.slice().sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
  const seen = new Set();
  return hits.filter(p => {
    const k = p.coord.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3).map(p => ({ name: p.name, modern: p.modern || p.name, coord: p.coord, type: p.type }));
}

const annotatedChronology = chronology.map(c => ({ ...c, places: matchPlaces(c.text) }));
const annotatedPre = pre1921.map(c => ({ ...c, places: matchPlaces(c.text) }));
const normTitle = t => String(t).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
const annotatedPrcAll = prcChronologyRaw.map(c => ({ ...c, places: matchPlaces(c.text) }));
const annotatedPrc = annotatedPrcAll.filter(c => !annotatedChronology.some(p => {
  const a = normTitle(p.title), b = normTitle(c.title);
  if (!a || !b) return false;
  const sameDay = p.date_start === c.date_start;
  const close = dayDiff(p.date_start, c.date_start) <= 2;
  if (close && a === b) return true;
  if (sameDay && (a.includes(b) || b.includes(a))) return true;
  if (sameDay && a.slice(0, 12) && a.slice(0, 12) === b.slice(0, 12)) return true;
  return false;
}));
const prcCount = annotatedPrc.length;

function curatedFor(c) {
  return events.find(e => {
    if (e.date_start === c.date_start) return true;
    if (e.title.length >= 5 && c.title.includes(e.title)) return true;
    return false;
  });
}

const PERIODS = ['晚清', '民国初年', '建党与大革命', '土地革命', '全面抗战', '解放战争', '建设与曲折', '改革开放', '新时代'];
const SITE = {
  title: '中国近现代史史料图谱',
  subtitle: '1840—2021 · 国家机构资料 · 原文可查',
  repo: 'https://github.com/night-ci/modern-china-archive'
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const truncate = (s, n = 110) => (s.length > n ? s.slice(0, n) + '…' : s);

function citation(s) {
  const inst = instById[s.institution_id] || { name: '' };
  const author = s.original_source || inst.name;
  const pub = s.published ? `(${s.published})` : '';
  return `${author}. ${s.title}[EB/OL]. ${pub}[${s.accessed}]. ${s.url}.`;
}

function sourceLink(s, text) {
  return `<a href="sources.html#${esc(s.id)}">${esc(text || s.title)}</a>`;
}

function fullscreenLayout({ title, description, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE.title}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#b3141c">
<link rel="stylesheet" href="assets/style.css">
</head>
<body class="fullscreen-body">${body}</body>
</html>`;
}

function layout({ title, description, body, active = '', base = '' }) {
  const nav = [
    ['index.html', '首页', 'home'],
    ['timeline.html', '编年', 'timeline'],
    ['chronology.html', '大事记', 'chronology'],
    ['prc-chronology.html', '国史', 'prc'],
    ['map.html', '地图', 'map'],
    ['red-topics.html', '红色专题', 'topics'],
    ['data-sources.html', '数据来源说明', 'sources'],
  ].map(([href, label, key]) => `<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
${base ? `<base href="${base}">` : ''}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE.title}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#b3141c">
<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/leaflet/leaflet.css">
</head>
<body>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="index.html">
      <span class="seal">史</span>
      <span>
        <strong>${SITE.title}</strong>
        <small>${SITE.subtitle}</small>
      </span>
    </a>
    <nav class="nav">${nav}</nav>
  </div>
</header>
<main>${body}</main>
<footer class="site-foot">
  <div class="wrap">
        <p>原文版权归原机构所有。<a href="corrections.html">勘误</a> · <a href="data/events.json">详解数据</a> · <a href="data/chronology.json">大事记数据</a> · <a href="data/pre1921.json">前编数据</a> · <a href="${SITE.repo}" target="_blank" rel="noopener">GitHub</a></p>
  </div>
</footer>
<script src="assets/app.js"></script>
</body>
</html>`;
}

function quoteBlock(q, i) {
  const s = srcById[q.source_id];
  const inst = s ? (instById[s.institution_id] || { name: '' }) : { name: '' };
  const cite = s
    ? `${sourceLink(s)}（${esc(inst.name)}${s.published ? '，' + esc(s.published) : ''}）${q.locator ? ' · ' + esc(q.locator) : ''}`
    : '来源缺失';
  return `<figure class="quote">
    <blockquote>“${esc(q.text)}”</blockquote>
    <figcaption><span class="num">[${i + 1}]</span> ${cite}</figcaption>
  </figure>`;
}

function eventCard(e) {
  const first = e.quotes[0];
  const overview = e.overview || (first ? first.text : '');
  const search = [e.title, e.period, e.category, ...(e.tags || []), ...(e.places || []).map(p => p.historical + ' ' + p.modern), ...(e.actors || []), ...(e.orgs || [])].join(' ');
  return `<article class="card" data-search="${esc(search)}">
    <div class="card-top"><span class="period">${esc(e.period)}</span><span class="cat">${esc(e.category)}</span></div>
    <h3><a href="events/${esc(e.id)}.html">${esc(e.title)}</a></h3>
    <p class="date">${esc(e.date_display)}</p>
    <p class="places">${(e.places || []).map(p => esc(p.historical)).join(' · ')}</p>
    ${overview ? `<p class="card-overview">${esc(truncate(overview, 112))}</p>
    <p class="src">根据所列来源整理</p>` : ''}
    <a class="more" href="events/${esc(e.id)}.html">查看叙述与原文 →</a>
  </article>`;
}

const mapEntries = [];
const usedMapCurated = new Set();
for (const c of annotatedChronology) {
  const cur = curatedFor(c);
  if (cur) usedMapCurated.add(cur.id);
  if (!(c.places || []).length) continue;
  mapEntries.push({
    id: c.id,
    title: c.title,
    date: c.date_display,
    date_start: c.date_start,
    period: c.period,
    text: c.text,
    places: c.places.slice(0, 1),
    url: cur ? `events/${cur.id}.html` : `chronology.html#${c.id}`,
    detail: !!cur,
    kind: 'chron'
  });
}
for (const c of annotatedPre) {
  if (!(c.places || []).length) continue;
  mapEntries.push({
    id: c.id,
    title: c.title,
    date: c.date_display,
    date_start: c.date_start,
    period: c.period,
    text: c.text,
    places: c.places.slice(0, 1),
    url: `timeline.html#${c.id}`,
    detail: false,
    kind: 'pre'
  });
}
for (const c of annotatedPrc) {
  const cur = curatedFor(c);
  if (cur) usedMapCurated.add(cur.id);
  if (!(c.places || []).length) continue;
  mapEntries.push({
    id: c.id,
    title: c.title,
    date: c.date_display,
    date_start: c.date_start,
    period: c.period,
    text: c.text,
    places: c.places.slice(0, 1),
    url: cur ? `events/${cur.id}.html` : `prc-chronology.html#${c.id}`,
    detail: !!cur,
    kind: 'prc'
  });
}
for (const e of events) {
  if (usedMapCurated.has(e.id) || !(e.places || []).length) continue;
  mapEntries.push({
    id: e.id,
    title: e.title,
    date: e.date_display,
    date_start: e.date_start,
    period: e.period,
    text: e.overview || '',
    places: (e.places || []).slice(0, 1).map(p => ({ name: p.historical, modern: p.modern, coord: p.coord })),
    url: `events/${e.id}.html`,
    detail: true,
    kind: 'event'
  });
}
mapEntries.sort((a, b) => String(a.date_start || a.date).localeCompare(String(b.date_start || b.date)));
const mapPeriodCounts = PERIODS.map(p => [p, mapEntries.filter(e => e.period === p).length]).filter(x => x[1]);

// ---------- home ----------
const homeBody = `
<section class="hero">
  <div class="wrap">
    <p class="kicker">国家机构公开资料</p>
    <div class="hero-tags"><span class="badge">${longCount} 条党史大事记</span><span class="badge">${prcTotal} 条国史编年</span><span class="badge">${preCount} 条前编</span><span class="badge">1840—2021</span></div>
    <h1>中国近现代史<br>史料图谱</h1>
    <p class="purpose">本站汇集国家机构公开的中国近现代史编年资料，时间范围为 1840—2021 年。条目按时间、地点和来源编排，提供原文摘录与原文链接，供检索、核对和引用。</p>
    <div class="hero-actions">
      <a class="btn primary" href="timeline.html">按时间阅读</a>
      <a class="btn" href="chronology.html">党史 ${longCount} 条</a>
      <a class="btn" href="prc-chronology.html">国史 ${prcTotal} 条</a>
      <a class="btn" href="map.html">地图</a>
    </div>
  </div>
</section>

<section class="stats wrap">
  <div><strong>${longCount}</strong><span>党史大事记</span></div>
  <div><strong>${prcTotal}</strong><span>国史编年</span></div>
  <div><strong>${preCount}</strong><span>条前编</span></div>
  <div><strong>${sources.length}</strong><span>个来源</span></div>
  <div><strong>1840—2021</strong><span>时间范围</span></div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>地图</h2>
  </div>
  <div class="map-shell">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点红色标记可以看条目和原文链接。</p>
    </aside>
  </div>
</section>



<section class="section wrap">
  <div class="long-banner">
    <div>
      <p class="kicker">编年</p>
      <h2>党史与国史大事记</h2>
      <p>党史大事记 ${longCount} 条，国史编年 ${prcTotal} 条，按年份排列，可检索。</p>
    </div>
    <a class="btn primary" href="chronology.html">党史大事记 →</a>
    <a class="btn" href="prc-chronology.html">国史编年 →</a>
  </div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>红色专题</h2>
    <p><a href="red-topics.html">全部专题 →</a></p>
  </div>
  <a class="topic-card" href="long-march.html">
    <span class="kicker">1934—1936</span>
    <h3>长征路线图</h3>
    <p>红军长征路线与重要事件。</p>
    <span class="more">全屏进入 →</span>
  </a>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>来源机构</h2>
    </div>
  <div class="inst-strip">
    ${institutions.map(i => `<a href="institutions/${esc(i.id)}.html"><strong>${esc(i.name)}</strong><span>${esc(i.type)}</span></a>`).join('')}
  </div>
</section>

<script>window.__CHRONOLOGY__ = ${JSON.stringify(mapEntries)}; window.__TOTAL__ = ${mapEntries.length};</script>
<script src="assets/leaflet/leaflet.js"></script>
<script src="assets/history-map.js"></script>
`;

fs.writeFileSync(path.join(dist, 'index.html'), layout({
  title: '首页',
  description: '中国近现代史史料图谱：国家机构资料、事件叙述、原文链接。',
  body: homeBody,
  active: 'home'
}));

// ---------- timeline ----------
const usedCurated = new Set();
const timelineItems = annotatedChronology.map(c => {
  const cur = curatedFor(c);
  if (cur) usedCurated.add(cur.id);
  return {
    id: c.id,
    date_start: c.date_start,
    date_display: c.date_display,
    year: c.year,
    period: c.period,
    title: c.title,
    text: c.text,
    places: c.places || [],
    detailId: cur ? cur.id : null,
    kind: 'chron'
  };
});
for (const c of annotatedPre) {
  timelineItems.push({
    id: c.id,
    date_start: c.date_start,
    date_display: c.date_display,
    year: c.year,
    period: c.period,
    title: c.title,
    text: c.text,
    places: c.places || [],
    detailId: null,
    source_id: c.source_id,
    kind: 'pre'
  });
}
for (const c of annotatedPrc) {
  const cur = curatedFor(c);
  if (cur) usedCurated.add(cur.id);
  timelineItems.push({
    id: c.id,
    date_start: c.date_start,
    date_display: c.date_display,
    year: c.year,
    period: c.period,
    title: c.title,
    text: c.text,
    places: c.places || [],
    detailId: cur ? cur.id : null,
    source_id: c.source_id,
    kind: 'prc'
  });
}
for (const e of events) {
  if (usedCurated.has(e.id)) continue;
  timelineItems.push({
    id: e.id,
    date_start: e.date_start,
    date_display: e.date_display,
    year: Number(e.date_start.slice(0, 4)),
    period: e.period,
    title: e.title,
    text: e.overview || (e.quotes[0] ? e.quotes[0].text : ''),
    places: (e.places || []).slice(0, 1).map(p => ({ name: p.historical, modern: p.modern, coord: p.coord })),
    detailId: e.id,
    kind: 'event'
  });
}
timelineItems.sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)));
const timelineYears = [...new Set(timelineItems.map(i => Number(i.year || i.date_start.slice(0, 4))))].sort((a, b) => a - b);

function timelineRow(item) {
  const place = (item.places || [])[0];
  const href = item.detailId
    ? `events/${esc(item.detailId)}.html`
    : (item.kind === 'pre' ? `sources.html#${esc(item.source_id)}` : (item.kind === 'prc' ? `prc-chronology.html#${esc(item.id)}` : `chronology.html#${esc(item.id)}`));
  const search = [item.date_display, item.title, item.text, item.period, ...(item.places || []).map(p => p.name)].join(' ');
  return `<article class="tl-row" id="${esc(item.id)}" data-search="${esc(search)}" data-period="${esc(item.period)}" data-year="${item.year}">
    <div class="tl-date">${esc(item.date_display)}</div>
    <div class="tl-main">
      <h4><a href="${href}">${esc(item.title)}</a></h4>
      <p>${esc(truncate(item.text, 150))}</p>
      <span class="tl-meta">${place ? esc(place.name) : ''}${item.detailId ? ' · 详解' : (item.kind === 'pre' ? ' · 前编' : (item.kind === 'prc' ? ' · 国史' : ' · 党史'))}</span>
    </div>
  </article>`;
}

const timelineBody = `
<section class="page-head wrap">
  <p class="kicker">编年</p>
  <h1>按时间阅读</h1>
  <p class="lede">从 1840 年到 2021 年，共 ${timelineItems.length} 条。详解、前编、党史大事记和国史编年都在这里。</p>
  <input id="timelineSearch" class="search" type="search" placeholder="检索年份、事件、人物、地点……">
  <select id="timelineYearJump" class="year-jump" style="margin-top:12px">
    <option value="">跳到年份</option>
    ${timelineYears.map(y => `<option value="ty${y}">${y}年</option>`).join('')}
  </select>
  <div class="filter-bar" id="timelinePeriods" style="margin-top:12px">
    <button class="on" data-tl-period="all">全部</button>
    ${PERIODS.map(p => {
      const n = timelineItems.filter(i => i.period === p).length;
      return n ? `<button data-tl-period="${esc(p)}">${esc(p)} ${n}</button>` : '';
    }).join('')}
  </div>
  <p class="muted small" id="timelineCount">共 ${timelineItems.length} 条</p>
</section>
<section class="wrap timeline-all">
  ${PERIODS.map(p => {
    const list = timelineItems.filter(i => i.period === p);
    if (!list.length) return '';
    const byYear = new Map();
    for (const item of list) {
      const y = Number(item.year || item.date_start.slice(0, 4));
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(item);
    }
    return `<section class="tl-period" id="${esc(p)}" data-period="${esc(p)}">
      <h2>${esc(p)}<span>${list.length} 条</span></h2>
      ${[...byYear.keys()].sort((a, b) => a - b).map(y => `<section class="tl-year" id="ty${y}" data-year="${y}">
        <h3>${y}年<span>${byYear.get(y).length} 条</span></h3>
        ${byYear.get(y).map(timelineRow).join('')}
      </section>`).join('')}
    </section>`;
  }).join('')}
</section>
<div class="empty" id="timelineEmpty" hidden>没有匹配的条目。</div>
<script src="assets/timeline-all.js"></script>
`;

fs.writeFileSync(path.join(dist, 'timeline.html'), layout({
  title: '编年',
  description: '按时间排列的中国近现代史事件。',
  body: timelineBody,
  active: 'timeline'
}));

// ---------- chronology ----------
const chronSource = srcById['cpc12371-ds100'];
const chronYears = [];
const chronByYear = new Map();
for (const c of annotatedChronology) {
  const y = Number(c.year || c.date_start.slice(0, 4));
  if (!chronByYear.has(y)) { chronByYear.set(y, []); chronYears.push(y); }
  chronByYear.get(y).push(c);
}
chronYears.sort((a, b) => a - b);
const chronPeriods = [...new Set(annotatedChronology.map(c => c.period))];

function chronItem(c) {
  const cur = curatedFor(c);
  const search = [c.date_display, c.title, c.text, c.period, ...(c.places || []).map(p => p.name)].join(' ');
  const sourceUrl = chronSource ? chronSource.url : '#';
  return `<article class="chron-item" id="${esc(c.id)}" data-search="${esc(search)}" data-period="${esc(c.period)}" data-year="${c.year}">
    <div class="chron-date">${esc(c.date_display)}</div>
    <div class="chron-main">
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.text)}</p>
      <p class="chron-src">${(c.places || []).length ? `<span class="chron-place">${esc(c.places[0].name)}</span>` : ''}${cur ? `<a href="events/${esc(cur.id)}.html">详解 →</a>` : ''}<a href="${esc(sourceUrl)}" target="_blank" rel="noopener" title="${esc(c.locator || '')}">查看原文</a></p>
    </div>
  </article>`;
}

const chronologyBody = `
<section class="page-head wrap">
  <p class="kicker">大事记</p>
  <h1>中国共产党一百年大事记</h1>
  <p class="lede">据中共中央党史和文献研究院《中国共产党一百年大事记（1921年7月—2021年6月）》整理，共 ${longCount} 条，含 1919—1920 年前史。按年份排列，可检索。</p>
</section>
<section class="wrap chron-tools">
  <input id="chronSearch" class="search" type="search" placeholder="检索年份、事件、人物、地点……">
  <select id="yearJump" class="year-jump">
    <option value="">跳到年份</option>
    ${chronYears.map(y => `<option value="y${y}">${y}年（${chronByYear.get(y).length}）</option>`).join('')}
  </select>
  <div class="filter-bar" id="chronPeriods">
    <button class="on" data-chron-period="all">全部</button>
    ${chronPeriods.map(p => `<button data-chron-period="${esc(p)}">${esc(p)}</button>`).join('')}
  </div>
  <p class="muted small" id="chronCount">共 ${longCount} 条</p>
</section>
<section class="wrap chronology" id="chronology">
  ${chronYears.map(y => `<section class="chron-year" id="y${y}" data-year="${y}">
    <h2>${y}年<span>${chronByYear.get(y).length} 条</span></h2>
    ${chronByYear.get(y).map(chronItem).join('')}
  </section>`).join('')}
</section>
<div class="empty" id="chronEmpty" hidden>没有匹配的条目。</div>
<script src="assets/chronology.js"></script>
`;

fs.writeFileSync(path.join(dist, 'chronology.html'), layout({
  title: '大事记',
  description: '《中国共产党一百年大事记》1921—2021 年条目检索。',
  body: chronologyBody,
  active: 'chronology'
}));

// ---------- PRC chronology ----------
const prcSource = srcById['cpc12371-prc70'];
const prcYears = [];
const prcByYear = new Map();
for (const c of annotatedPrcAll) {
  const y = Number(c.year || c.date_start.slice(0, 4));
  if (!prcByYear.has(y)) { prcByYear.set(y, []); prcYears.push(y); }
  prcByYear.get(y).push(c);
}
prcYears.sort((a, b) => a - b);
const prcPeriods = [...new Set(annotatedPrcAll.map(c => c.period))];

function prcItem(c) {
  const cur = curatedFor(c);
  const src = srcById[c.source_id] || prcSource;
  const search = [c.date_display, c.title, c.text, c.period, ...(c.places || []).map(p => p.name)].join(' ');
  return `<article class="chron-item" id="${esc(c.id)}" data-search="${esc(search)}" data-period="${esc(c.period)}" data-year="${c.year}">
    <div class="chron-date">${esc(c.date_display)}</div>
    <div class="chron-main">
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.text)}</p>
      <p class="chron-src">${(c.places || []).length ? `<span class="chron-place">${esc(c.places[0].name)}</span>` : ''}${cur ? `<a href="events/${esc(cur.id)}.html">详解 →</a>` : ''}<a href="${esc(src ? src.url : '#')}" target="_blank" rel="noopener" title="${esc(c.locator || '')}">查看原文</a></p>
    </div>
  </article>`;
}

const prcBody = `
<section class="page-head wrap">
  <p class="kicker">国史</p>
  <h1>中华人民共和国大事记</h1>
  <p class="lede">据中共中央党史和文献研究院《中华人民共和国大事记（1949年10月—2019年9月）》整理，共 ${prcTotal} 条。按年份排列，可检索。</p>
</section>
<section class="wrap chron-tools">
  <input id="chronSearch" class="search" type="search" placeholder="检索年份、事件、人物、地点……">
  <select id="yearJump" class="year-jump">
    <option value="">跳到年份</option>
    ${prcYears.map(y => `<option value="y${y}">${y}年（${prcByYear.get(y).length}）</option>`).join('')}
  </select>
  <div class="filter-bar" id="chronPeriods">
    <button class="on" data-chron-period="all">全部</button>
    ${prcPeriods.map(p => `<button data-chron-period="${esc(p)}">${esc(p)}</button>`).join('')}
  </div>
  <p class="muted small" id="chronCount">共 ${prcTotal} 条</p>
</section>
<section class="wrap chronology" id="chronology">
  ${prcYears.map(y => `<section class="chron-year" id="y${y}" data-year="${y}">
    <h2>${y}年<span>${prcByYear.get(y).length} 条</span></h2>
    ${prcByYear.get(y).map(prcItem).join('')}
  </section>`).join('')}
</section>
<div class="empty" id="chronEmpty" hidden>没有匹配的条目。</div>
<script src="assets/chronology.js"></script>
`;

fs.writeFileSync(path.join(dist, 'prc-chronology.html'), layout({
  title: '国史编年',
  description: '《中华人民共和国大事记》1949—2019 年条目检索。',
  body: prcBody,
  active: 'prc'
}));

// ---------- map page ----------
const mapPageBody = `
<section class="page-head wrap">
  <p class="kicker">地图</p>
  <h1>事件地点</h1>
  <p class="lede">地点根据大事记和详解中的地名匹配，每条事件只标一个主要地点，邻近地点合并显示。底图是现代地图，不是精确地理编码。</p>
</section>
<section class="wrap chron-tools">
  <input id="mapSearch" class="search" type="search" placeholder="检索事件、地点、年份……">
  <div class="filter-bar" id="mapPeriods">
    <button class="on" data-map-period="all">全部</button>
    ${mapPeriodCounts.map(([p, n]) => `<button data-map-period="${esc(p)}">${esc(p)} ${n}</button>`).join('')}
  </div>
  <p class="muted small" id="mapCount">有地点 ${mapEntries.length} 条 / 共 ${timelineItems.length} 条</p>
</section>
<section class="wrap">
  <div class="map-shell tall">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点地图上的标记，查看该地点的条目。</p>
    </aside>
  </div>
</section>
<script>window.__CHRONOLOGY__ = ${JSON.stringify(mapEntries)}; window.__TOTAL__ = ${timelineItems.length};</script>
<script src="assets/leaflet/leaflet.js"></script>
<script src="assets/history-map.js"></script>
`;

fs.writeFileSync(path.join(dist, 'map.html'), layout({
  title: '地图',
  description: '中国近现代史事件地点地图。',
  body: mapPageBody,
  active: 'map'
}));

// ---------- red topics ----------
const redTopicsBody = `
<section class="page-head wrap">
  <p class="kicker">专题</p>
  <h1>红色专题</h1>
</section>
<section class="wrap grid">
  <a class="topic-card" href="long-march.html">
    <span class="kicker">1934—1936</span>
    <h3>长征路线图</h3>
    <p>红军长征路线与重要事件。</p>
    <span class="more">全屏进入 →</span>
  </a>
  <div class="topic-card placeholder">
    <span class="kicker">待补充</span>
    <h3>更多专题</h3>
  </div>
</section>
`;

fs.writeFileSync(path.join(dist, 'red-topics.html'), layout({
  title: '红色专题',
  description: '红色专题入口。',
  body: redTopicsBody,
  active: 'topics'
}));

// ---------- long march topic ----------
const longMarchBody = `
<iframe class="fullscreen-frame" src="long-march/index.html" title="长征路线图"></iframe>
<a class="fullscreen-back" href="red-topics.html">← 返回红色专题</a>
`;

fs.writeFileSync(path.join(dist, 'long-march.html'), fullscreenLayout({
  title: '长征路线图',
  description: '1934—1936 年红军长征路线与事件。',
  body: longMarchBody
}));

// ---------- event pages ----------
for (const e of events) {
  const srcList = e.source_ids.map(id => srcById[id]).filter(Boolean);
  const body = `
<article class="wrap event">
  <nav class="crumb"><a href="index.html">首页</a> / <a href="timeline.html">编年</a> / <span>${esc(e.title)}</span></nav>
  <header class="event-head">
    <p class="kicker">${esc(e.period)} · ${esc(e.category)}</p>
    <h1>${esc(e.title)}</h1>
    <p class="date">${esc(e.date_display)}</p>
    <p class="places">${(e.places || []).map(p => `${esc(p.historical)}${p.modern && p.modern !== p.historical ? `（今 ${esc(p.modern)}）` : ''}`).join(' · ')}</p>
  </header>

  <section class="overview">
    <h2>叙述</h2>
    ${(e.overview || '').split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}
    <p class="overview-src">据：${(e.overview_sources || e.source_ids || []).map(id => srcById[id]).filter(Boolean).map(s => sourceLink(s)).join('、')} 整理。</p>
  </section>

  <section class="event-main">
    <h2>原文摘录</h2>
    ${e.quotes.map(quoteBlock).join('')}
  </section>

  <aside class="event-side">
    <h2>元数据</h2>
    <dl class="meta">
      <dt>时间</dt><dd>${esc(e.date_display)}</dd>
      <dt>地点</dt><dd>${(e.places || []).map(p => esc(p.historical)).join('；')}</dd>
      <dt>相关人物</dt><dd>${(e.actors || []).length ? e.actors.map(esc).join('、') : '—'}</dd>
      <dt>相关组织</dt><dd>${(e.orgs || []).length ? e.orgs.map(esc).join('、') : '—'}</dd>
      <dt>类别</dt><dd>${esc(e.category)}</dd>
      <dt>标签</dt><dd>${(e.tags || []).map(esc).join('、')}</dd>
      <dt>最后复核</dt><dd>${esc(e.last_reviewed)}</dd>
    </dl>
    <p class="muted small">如与原文不一致，以原文为准。</p>
  </aside>

  <section class="sources-block">
    <h2>来源与原文</h2>
    ${srcList.map(s => {
      const inst = instById[s.institution_id] || { name: '' };
      return `<div class="source-card">
        <p class="src-inst">${esc(inst.name)} · ${esc(s.type)}${s.published ? ' · ' + esc(s.published) : ''}</p>
        <h3>${esc(s.title)}</h3>
        <p class="cite">${esc(citation(s))}</p>
        <div class="source-actions">
          <a class="btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">查看原文</a>
          <button class="btn copy" data-copy="${esc(citation(s))}">复制引用</button>
          <a class="btn ghost" href="sources.html#${esc(s.id)}">来源详情</a>
        </div>
      </div>`;
    }).join('')}
  </section>
</article>
`;
  fs.writeFileSync(path.join(dist, 'events', `${e.id}.html`), layout({
    title: e.title,
    description: `${e.title}（${e.date_display}）的叙述、原文和来源链接。`,
    body,
    active: '',
    base: '../'
  }));
}

// ---------- sources ----------
function usageLine(s) {
  const used = events.filter(e => e.source_ids.includes(s.id));
  if (s.id === 'cpc12371-ds100') return `用于党史大事记：<a href="chronology.html">${longCount} 条大事记</a>`;
  if (s.id === 'cpc12371-prc70') return `用于国史编年：<a href="prc-chronology.html">${prcTotal} 条</a>`;
  return `用于条目：${used.map(e => `<a href="events/${esc(e.id)}.html">${esc(e.title)}</a>`).join('、') || '—'}${s.id === 'qstheory-dangshi-1' ? `；也用于前编 ${preCount} 条` : ''}`;
}

function sourceCard(s, linkInstitution = true) {
  const inst = instById[s.institution_id] || { id: '', name: '' };
  const instLabel = linkInstitution
    ? `<a href="institutions/${esc(inst.id)}.html">${esc(inst.name)}</a>`
    : esc(inst.name);
  return `<article class="source-card" id="${esc(s.id)}">
    <p class="src-inst">${instLabel} · ${esc(s.type)}${s.published ? ' · ' + esc(s.published) : ''}</p>
    <h2>${esc(s.title)}</h2>
    <p class="cite">${esc(citation(s))}</p>
    <p class="muted small">原始来源：${esc(s.original_source || inst.name)}${s.note ? '；' + esc(s.note) : ''}</p>
    <p class="muted small">${usageLine(s)}</p>
    <div class="source-actions">
      <a class="btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">查看原文</a>
      <button class="btn copy" data-copy="${esc(citation(s))}">复制引用</button>
      <a class="btn ghost" href="sources.html#${esc(s.id)}">来源详情</a>
    </div>
  </article>`;
}

const sourcesBody = `
<section class="page-head wrap">
  <p class="kicker">来源条目</p>
  <h1>来源清单</h1>
</section>
<section class="wrap">
  ${sources.map(s => sourceCard(s)).join('')}
</section>
`;

fs.writeFileSync(path.join(dist, 'sources.html'), layout({
  title: '来源清单',
  description: '国家机构来源与原文链接。',
  body: sourcesBody,
  active: 'sources'
}));

// ---------- data sources ----------
const dataSourcesBody = `
<section class="page-head wrap">
  <p class="kicker">数据来源</p>
  <h1>数据来源说明</h1>
  <p class="purpose">本站资料来自以下国家机构。点击机构查看引用文章。</p>
</section>
<section class="wrap grid inst-grid">
  ${institutions.map(i => {
    const sc = sources.filter(s => s.institution_id === i.id).length;
    const ec = events.filter(e => e.source_ids.some(id => (srcById[id] || {}).institution_id === i.id)).length;
    return `<article class="card inst">
      <p class="period">${esc(i.type)}</p>
      <h3><a href="institutions/${esc(i.id)}.html">${esc(i.name)}</a></h3>
      <p class="muted small">${esc(i.note || '')}</p>
      <p class="muted small">来源 ${sc} 条 · 引用事件 ${ec} 条</p>
      <a class="more" href="institutions/${esc(i.id)}.html">查看引用文章 →</a>
    </article>`;
  }).join('')}
</section>
`;

fs.writeFileSync(path.join(dist, 'data-sources.html'), layout({
  title: '数据来源说明',
  description: '国家机构与引用文章。',
  body: dataSourcesBody,
  active: 'sources'
}));

// ---------- institution pages ----------
for (const inst of institutions) {
  const list = sources.filter(s => s.institution_id === inst.id);
  const body = `
<section class="page-head wrap">
  <p class="kicker">数据来源</p>
  <h1>${esc(inst.name)}</h1>
  <p class="purpose">${esc(inst.type)}${inst.note ? ' · ' + esc(inst.note) : ''}</p>
  ${inst.url ? `<p class="muted small"><a href="${esc(inst.url)}" target="_blank" rel="noopener">访问官网 →</a></p>` : ''}
</section>
<section class="wrap">
  <p class="muted small"><a href="data-sources.html">← 全部机构</a></p>
  ${list.map(s => sourceCard(s, false)).join('') || '<p class="muted">暂无引用文章。</p>'}
</section>
`;
  fs.writeFileSync(path.join(dist, 'institutions', `${inst.id}.html`), layout({
    title: inst.name,
    description: `${inst.name}的引用文章。`,
    body,
    active: 'sources',
    base: '../'
  }));
}

// ---------- corrections ----------
const correctionsBody = `
<section class="page-head wrap">
  <p class="kicker">勘误</p>
  <h1>勘误与版本</h1>
  <p class="lede">如果发现错误，请附上原文链接、页码或截图。</p>
</section>
<section class="wrap prose">
  <h2>提交方式</h2>
  <p>GitHub Issue：<a href="${SITE.repo}/issues" target="_blank" rel="noopener">${SITE.repo}/issues</a></p>
  <h2>请附上</h2>
  <ul>
    <li>条目名称与链接；</li>
    <li>需要更正的原文与页码/章节；</li>
    <li>国家机构来源链接；</li>
    <li>如果是链接失效，请附上新的官方链接或馆藏信息。</li>
  </ul>
  <h2>怎么处理</h2>
  <p>以原文为准。来源说法不一致时，把原文并列。改完后更新条目的复核日期。</p>
</section>
`;

fs.writeFileSync(path.join(dist, 'corrections.html'), layout({
  title: '勘误',
  description: '勘误提交与版本说明。',
  body: correctionsBody,
  active: ''
}));

// ---------- data ----------
fs.writeFileSync(path.join(dist, 'data', 'events.json'), JSON.stringify(events, null, 2));
fs.writeFileSync(path.join(dist, 'data', 'chronology.json'), JSON.stringify(chronology, null, 2));
fs.writeFileSync(path.join(dist, 'data', 'chronology-prc.json'), JSON.stringify(prcChronologyRaw, null, 2));
fs.writeFileSync(path.join(dist, 'data', 'pre1921.json'), JSON.stringify(pre1921, null, 2));

// ---------- sitemap / robots ----------
const BASE_URL = 'https://night-ci.github.io/modern-china-archive/';
const pages = [
  '', 'timeline.html', 'chronology.html', 'prc-chronology.html', 'map.html', 'red-topics.html', 'long-march.html', 'long-march/index.html', 'data-sources.html', 'sources.html', 'corrections.html',
  ...institutions.map(i => `institutions/${i.id}.html`),
  ...events.map(e => `events/${e.id}.html`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${BASE_URL}${p}</loc><lastmod>2026-11-08</lastmod></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}sitemap.xml\n`);
console.log(`Built ${events.length} events, ${sources.length} sources, ${institutions.length} institutions.`);
