import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'events'), { recursive: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });

const institutions = JSON.parse(fs.readFileSync(path.join(contentDir, 'institutions.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(contentDir, 'sources.json'), 'utf8'));
const events = fs.readdirSync(path.join(contentDir, 'events'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(contentDir, 'events', f), 'utf8')))
  .sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)));

const instById = Object.fromEntries(institutions.map(i => [i.id, i]));
const srcById = Object.fromEntries(sources.map(s => [s.id, s]));

const PERIODS = ['晚清', '民国初年', '土地革命', '全面抗战', '解放战争', '建设与曲折', '改革开放', '新时代'];
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

function layout({ title, description, body, active = '', base = '' }) {
  const nav = [
    ['index.html', '首页', 'home'],
    ['timeline.html', '编年', 'timeline'],
    ['map.html', '地图', 'map'],
    ['sources.html', '史料来源', 'sources'],
    ['institutions.html', '国家机构', 'institutions'],
    ['methodology.html', '编纂说明', 'methodology']
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
    <p>我整理国家机构公开的资料。每条事件都附叙述、原文和来源链接。</p>
    <p>原文版权归原机构所有。我只摘录并给出链接。<a href="methodology.html">编纂说明</a> · <a href="corrections.html">勘误</a> · <a href="data/events.json">数据</a> · <a href="${SITE.repo}" target="_blank" rel="noopener">GitHub</a></p>
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
    <p class="src">我根据这些来源整理</p>` : ''}
    <a class="more" href="events/${esc(e.id)}.html">查看叙述与原文 →</a>
  </article>`;
}

function mapData() {
  return events.map(e => {
    const q = e.quotes[0];
    const instNames = [...new Set((e.source_ids || []).map(id => {
      const s = srcById[id];
      return s ? (instById[s.institution_id] || {}).name : '';
    }).filter(Boolean))];
    return {
      id: e.id,
      title: e.title,
      date: e.date_display,
      period: e.period,
      url: `events/${e.id}.html`,
      overview: e.overview || (q ? q.text : ''),
      source: instNames.join('、'),
      places: e.places || []
    };
  });
}

// ---------- home ----------
const periodCounts = PERIODS.map(p => [p, events.filter(e => e.period === p).length]).filter(x => x[1]);
const homeBody = `
<section class="hero">
  <div class="wrap">
    <p class="kicker">国家机构公开资料</p>
    <div class="hero-tags"><span class="badge">M0 样稿</span><span class="badge">10 条已核验</span><span class="badge">1840—2021</span></div>
    <h1>中国近现代史<br>史料图谱</h1>
    <p class="lede">我收集国家机构公开的历史资料，按时间和地点整理。每条事件都有叙述、原文摘录和来源链接。</p>
    <div class="hero-actions">
      <a class="btn primary" href="timeline.html">按时间阅读</a>
      <a class="btn" href="map.html">在地图上查看</a>
      <a class="btn ghost" href="methodology.html">编纂说明</a>
    </div>
    <p class="notice">叙述只使用所列来源中的事实，不加入我的判断和评价。原文和链接附在每条事件后面。</p>
  </div>
</section>

<section class="stats wrap">
  <div><strong>${events.length}</strong><span>条事件</span></div>
  <div><strong>${sources.length}</strong><span>个来源</span></div>
  <div><strong>${institutions.length}</strong><span>家机构</span></div>
  <div><strong>${periodCounts.length}</strong><span>个时期</span></div>
  <div><strong>1840—2021</strong><span>时间范围</span></div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>地图</h2>
    <p>地图上是事件涉及的主要地点。底图是现代地图，历史地名写在文字里。点红色标记可以看条目。</p>
  </div>
  <div class="map-shell">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点红色标记可以看条目和原文链接。</p>
    </aside>
  </div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>编年</h2>
    <p>按时期排列。点开条目可以看叙述、原文摘录和来源。</p>
  </div>
  <div class="period-bar">
    ${periodCounts.map(([p, n]) => `<a href="timeline.html#${encodeURIComponent(p)}">${esc(p)} <span>${n}</span></a>`).join('')}
  </div>
  <div class="grid" id="eventGrid">
    ${events.map(eventCard).join('')}
  </div>
  <div class="empty" id="empty" hidden>没有匹配的事件。</div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>来源机构</h2>
    <p>我现在只用国家机构、国家馆藏和国家媒体的公开页面。</p>
  </div>
  <div class="inst-strip">
    ${institutions.map(i => `<a href="${esc(i.url)}" target="_blank" rel="noopener"><strong>${esc(i.name)}</strong><span>${esc(i.type)}</span></a>`).join('')}
  </div>
</section>

<script>window.__EVENTS__ = ${JSON.stringify(mapData())};</script>
<script src="assets/leaflet/leaflet.js"></script>
<script src="assets/map.js"></script>
`;

fs.writeFileSync(path.join(dist, 'index.html'), layout({
  title: '首页',
  description: '中国近现代史史料图谱：国家机构资料、事件叙述、原文链接。',
  body: homeBody,
  active: 'home'
}));

// ---------- timeline ----------
const timelineBody = `
<section class="page-head wrap">
  <p class="kicker">编年</p>
  <h1>按时间阅读</h1>
  <p class="lede">从 1840 年到 2021 年。每条有叙述、原文摘录和来源。</p>
  <input id="search" class="search" type="search" placeholder="检索事件、地点、人物、标签……">
</section>
<section class="wrap timeline">
  ${PERIODS.map(p => {
    const list = events.filter(e => e.period === p);
    if (!list.length) return '';
    return `<section id="${esc(p)}" class="period-block">
      <h2>${esc(p)}<span>${list.length} 条</span></h2>
      ${list.map(e => {
        const overview = e.overview || (e.quotes[0] ? e.quotes[0].text : '');
        const search = [e.title, e.period, e.category, ...(e.tags || []), ...(e.places || []).map(x => x.historical + ' ' + x.modern)].join(' ');
        return `<article class="t-row" data-search="${esc(search)}">
          <div class="t-date">${esc(e.date_display)}</div>
          <div class="t-main">
            <h3><a href="events/${esc(e.id)}.html">${esc(e.title)}</a></h3>
            <p>${(e.places || []).map(x => esc(x.historical)).join(' · ')}</p>
            ${overview ? `<p class="t-overview">${esc(truncate(overview, 155))}</p>` : ''}
            <span class="src">我根据 ${(e.source_ids || []).length} 个来源整理</span>
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('')}
  <div class="empty" id="empty" hidden>没有匹配的事件。</div>
</section>
`;

fs.writeFileSync(path.join(dist, 'timeline.html'), layout({
  title: '编年',
  description: '按时间排列的中国近现代史事件。',
  body: timelineBody,
  active: 'timeline'
}));

// ---------- map page ----------
const mapPageBody = `
<section class="page-head wrap">
  <p class="kicker">地图</p>
  <h1>事件地点</h1>
  <p class="lede">底图是现代地图，历史地名写在文字里。标记只表示事件涉及的主要地点，不代表精确边界。</p>
</section>
<section class="wrap">
  <div class="map-shell tall">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点红色标记可以看条目和原文链接。</p>
    </aside>
  </div>
</section>
<script>window.__EVENTS__ = ${JSON.stringify(mapData())};</script>
<script src="assets/leaflet/leaflet.js"></script>
<script src="assets/map.js"></script>
`;

fs.writeFileSync(path.join(dist, 'map.html'), layout({
  title: '地图',
  description: '中国近现代史事件地点地图。',
  body: mapPageBody,
  active: 'map'
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

  <div class="notice box">上面是我根据所列来源写的叙述，不是原文。原文摘录在下面。如果叙述和原文不一致，以原文为准。</div>

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
    <p class="muted small">元数据是我根据所列来源整理的；如与原文不一致，以原文为准。</p>
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
const sourcesBody = `
<section class="page-head wrap">
  <p class="kicker">史料来源</p>
  <h1>来源清单</h1>
  <p class="lede">这些来源都来自国家机构、国家馆藏或国家媒体。点“查看原文”可以去原机构页面。</p>
</section>
<section class="wrap">
  ${sources.map(s => {
    const inst = instById[s.institution_id] || { name: '' };
    const used = events.filter(e => e.source_ids.includes(s.id));
    return `<article class="source-card" id="${esc(s.id)}">
      <p class="src-inst">${esc(inst.name)} · ${esc(s.type)}${s.published ? ' · ' + esc(s.published) : ''}</p>
      <h2>${esc(s.title)}</h2>
      <p class="cite">${esc(citation(s))}</p>
      <p class="muted small">原始来源：${esc(s.original_source || inst.name)}${s.note ? '；' + esc(s.note) : ''}</p>
      <p class="muted small">我把它用在这些条目：${used.map(e => `<a href="events/${esc(e.id)}.html">${esc(e.title)}</a>`).join('、') || '—'}</p>
      <div class="source-actions">
        <a class="btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">查看原文</a>
        <button class="btn copy" data-copy="${esc(citation(s))}">复制引用</button>
      </div>
    </article>`;
  }).join('')}
</section>
`;

fs.writeFileSync(path.join(dist, 'sources.html'), layout({
  title: '史料来源',
  description: '我用的国家机构来源，以及每条来源的原文链接。',
  body: sourcesBody,
  active: 'sources'
}));

// ---------- institutions ----------
const instBody = `
<section class="page-head wrap">
  <p class="kicker">国家机构</p>
  <h1>来源机构</h1>
  <p class="lede">现在只用中央国家机构、国家馆藏、国家媒体和国家科研机构。地方来源以后逐项审核加入。</p>
</section>
<section class="wrap grid inst-grid">
  ${institutions.map(i => `<article class="card inst">
    <p class="period">${esc(i.type)}</p>
    <h3>${esc(i.name)}</h3>
    <p class="muted small">${esc(i.note || '')}</p>
    ${i.url ? `<a class="more" href="${esc(i.url)}" target="_blank" rel="noopener">访问官网 →</a>` : ''}
    <p class="muted small">我用了这家机构的 ${sources.filter(s => s.institution_id === i.id).length} 条来源</p>
  </article>`).join('')}
</section>
`;

fs.writeFileSync(path.join(dist, 'institutions.html'), layout({
  title: '国家机构',
  description: '我用的来源机构。',
  body: instBody,
  active: 'institutions'
}));

// ---------- methodology ----------
const methodologyBody = `
<section class="page-head wrap">
  <p class="kicker">编纂说明</p>
  <h1>我怎样写这些条目</h1>
  <p class="lede">我根据国家机构公开的资料写事件叙述。叙述尽量写细，但事实都来自所列来源。每条事件后面附原文摘录和链接。</p>
</section>
<section class="wrap prose">
  <h2>一、写什么</h2>
  <p>我按时间顺序整理中国近现代史的事件。每个事件写一段叙述，说明时间、地点、人物和经过；来源里明确说到的原因和结果，我也会写进去。我不写自己的判断、评价和推测。</p>
  <p>每条事件有元数据、叙述、原文摘录、来源和原文链接。叙述是我写的，原文摘录是来源里的原话。</p>

  <h2>二、怎么写</h2>
  <p>叙述里的数字、日期、地名、人名要和原文一致。每条叙述后面注明用了哪些来源。</p>
  <p>官方对事件的评价，我放在“原文摘录”里，不写进叙述。</p>
  <p>如果叙述和原文不一致，以原文为准，并改过来。</p>

  <h2>三、收哪些事件</h2>
  <p>我先收全国性事件。省级事件只收影响全国或意义典型的，县级及以下一般不收。每条至少有一个国家机构、国家馆藏或国家媒体的来源。官方来源说法不一致时，我把原文并列，不替它们下结论。</p>

  <h2>四、用哪些来源</h2>
  <p>我用中央国家机构、国家馆藏、国家媒体和国家科研机构的公开资料，也会用经过审核的地方党史办、地方志办、地方政府网站和地方党报。个人博客、自媒体、百科和商业聚合不用。</p>

  <h2>五、原文和版权</h2>
  <p>政府文件、法律、公报和白皮书可以全文转载，并保存本地快照。国家媒体的报道只摘录，附原文链接，不整篇转载。图书只引短段，标页码和版本。档案给馆藏号和目录链接；没有在线全文的，注明需要到馆查阅。图片只用公有领域或已授权的。</p>

  <h2>六、时间范围</h2>
  <p>1840—2021。2021 年以后只做大事件记，另行核对。</p>

  <h2>七、纠错</h2>
  <p>如果引文、日期、地名、链接或机构信息有错，请在 GitHub 提 Issue，或从勘误页发我原文链接。我会改，并更新条目的复核日期。</p>

  <h2>八、其他</h2>
  <p>事件选哪些、标题怎么定、叙述写多长，都由我判断。我把收录标准、来源和原文都列出来，方便你检查。</p>
  <p>现在是 10 条样稿，后面会加到 100 条，再到 1000 条以上。</p>
</section>
`;

fs.writeFileSync(path.join(dist, 'methodology.html'), layout({
  title: '编纂说明',
  description: '我怎样写事件、怎么选来源、怎么处理原文和版权。',
  body: methodologyBody,
  active: 'methodology'
}));

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
    <li>如果是链接失效，请给我新的官方链接或馆藏信息。</li>
  </ul>
  <h2>怎么处理</h2>
  <p>我会以原文为准。来源说法不一致时，把原文并列。改完后更新条目的复核日期。</p>
</section>
`;

fs.writeFileSync(path.join(dist, 'corrections.html'), layout({
  title: '勘误',
  description: '勘误提交与版本说明。',
  body: correctionsBody,
  active: ''
}));

// ---------- data ----------
fs.writeFileSync(path.join(dist, 'data', 'events.json'), JSON.stringify(mapData(), null, 2));

// ---------- sitemap / robots ----------
const BASE_URL = 'https://night-ci.github.io/modern-china-archive/';
const pages = [
  '', 'timeline.html', 'map.html', 'sources.html', 'institutions.html',
  'methodology.html', 'corrections.html',
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
