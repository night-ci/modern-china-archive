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
  subtitle: '1840—2021 · 国家机构资料 · 逐条援引 · 原文可查',
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
    ['methodology.html', '编纂原则', 'methodology']
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
    <p>本站以来源为限，提供导览式叙述与原文摘录；所有事实均可追溯至所引国家机构资料。</p>
    <p>原文版权归原机构所有；本站以摘录与链接方式引用。<a href="methodology.html">编纂原则</a> · <a href="corrections.html">勘误</a> · <a href="data/events.json">数据</a> · <a href="${SITE.repo}" target="_blank" rel="noopener">GitHub</a></p>
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
    <p class="src">导览 · 据所引来源整理</p>` : ''}
    <a class="more" href="events/${esc(e.id)}.html">查看导览与原文 →</a>
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
    <p class="kicker">国家机构公开资料 · 导览与原文</p>
    <div class="hero-tags"><span class="badge">M0 样稿</span><span class="badge">10 条已核验</span><span class="badge">1840—2021</span></div>
    <h1>中国近现代史<br>史料图谱</h1>
    <p class="lede">以时间与地点为骨架，把国家机构公开资料整理成可读的导览与可核对的原文。先读整体，再回到出处。</p>
    <div class="hero-actions">
      <a class="btn primary" href="timeline.html">按时间阅读</a>
      <a class="btn" href="map.html">在地图上查看</a>
      <a class="btn ghost" href="methodology.html">编纂原则</a>
    </div>
    <p class="notice">以来源为限：导览可以展开细节、背景与来源中明确陈述的因果，但只作描述，不写作者判断与评价；关键事实仍逐条附原文与链接。</p>
  </div>
</section>

<section class="stats wrap">
  <div><strong>${events.length}</strong><span>条史料</span></div>
  <div><strong>${sources.length}</strong><span>个来源</span></div>
  <div><strong>${institutions.length}</strong><span>家机构</span></div>
  <div><strong>${periodCounts.length}</strong><span>个时期</span></div>
  <div><strong>1840—2021</strong><span>时间范围</span></div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>地图</h2>
    <p>点位为事件涉及的主要地点；现代底图，历史地名以文字标注。点击点位查看史料。</p>
  </div>
  <div class="map-shell">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点击地图上的红色标记，查看对应史料与原文链接。</p>
    </aside>
  </div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>编年</h2>
    <p>按时期排列。每条先读导览，再进入详情页查看原文摘录与出处。</p>
  </div>
  <div class="period-bar">
    ${periodCounts.map(([p, n]) => `<a href="timeline.html#${encodeURIComponent(p)}">${esc(p)} <span>${n}</span></a>`).join('')}
  </div>
  <div class="grid" id="eventGrid">
    ${events.map(eventCard).join('')}
  </div>
  <div class="empty" id="empty" hidden>没有匹配的史料。</div>
</section>

<section class="section wrap">
  <div class="section-head">
    <h2>来源机构</h2>
    <p>目前仅收录国家机构、国家馆藏与国家媒体的公开页面。</p>
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
  description: '中国近现代史史料图谱：国家机构资料、逐条援引、原文可查。',
  body: homeBody,
  active: 'home'
}));

// ---------- timeline ----------
const timelineBody = `
<section class="page-head wrap">
  <p class="kicker">编年</p>
  <h1>按时间阅读</h1>
  <p class="lede">从 1840 年到 2021 年。每一条只呈现来源中的原文与必要元数据。</p>
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
            <span class="src">导览 · 据 ${(e.source_ids || []).length} 个来源整理</span>
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('')}
  <div class="empty" id="empty" hidden>没有匹配的史料。</div>
</section>
`;

fs.writeFileSync(path.join(dist, 'timeline.html'), layout({
  title: '编年',
  description: '按时间排列的中国近现代史国家机构史料。',
  body: timelineBody,
  active: 'timeline'
}));

// ---------- map page ----------
const mapPageBody = `
<section class="page-head wrap">
  <p class="kicker">地图</p>
  <h1>事件地点</h1>
  <p class="lede">现代底图，历史地名标注。点位仅表示事件涉及的主要地点，不代表精确边界。</p>
</section>
<section class="wrap">
  <div class="map-shell tall">
    <div id="map" class="map"></div>
    <aside id="mapInfo" class="map-info">
      <p class="muted">点击地图上的红色标记，查看对应史料与原文链接。</p>
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

  <div class="notice box">导览为本站据所引来源整理的叙述，不是原文；原文摘录见下方。如导览与原文不一致，以原文为准。</div>

  <section class="overview">
    <h2>导览</h2>
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
    <p class="muted small">元数据据所引来源整理；如与原文不一致，以原文为准。</p>
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
    description: `${e.title}（${e.date_display}）的国家机构史料与原文链接。`,
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
  <p class="lede">每个来源均来自国家机构、国家馆藏或国家媒体。点击“查看原文”跳转至原机构页面。</p>
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
      <p class="muted small">用于：${used.map(e => `<a href="events/${esc(e.id)}.html">${esc(e.title)}</a>`).join('、') || '—'}</p>
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
  description: '本站使用的国家机构来源清单与原文链接。',
  body: sourcesBody,
  active: 'sources'
}));

// ---------- institutions ----------
const instBody = `
<section class="page-head wrap">
  <p class="kicker">国家机构</p>
  <h1>来源机构</h1>
  <p class="lede">目前只收录中央国家机构、国家馆藏、国家媒体与国家科研机构；地方来源将逐项列入白名单。</p>
</section>
<section class="wrap grid inst-grid">
  ${institutions.map(i => `<article class="card inst">
    <p class="period">${esc(i.type)}</p>
    <h3>${esc(i.name)}</h3>
    <p class="muted small">${esc(i.note || '')}</p>
    ${i.url ? `<a class="more" href="${esc(i.url)}" target="_blank" rel="noopener">访问官网 →</a>` : ''}
    <p class="muted small">本站引用来源：${sources.filter(s => s.institution_id === i.id).length} 条</p>
  </article>`).join('')}
</section>
`;

fs.writeFileSync(path.join(dist, 'institutions.html'), layout({
  title: '国家机构',
  description: '本站来源机构清单。',
  body: instBody,
  active: 'institutions'
}));

// ---------- methodology ----------
const methodologyBody = `
<section class="page-head wrap">
  <p class="kicker">编纂原则</p>
  <h1>有叙述，也有边界</h1>
  <p class="lede">本站以国家机构公开资料为限，写可读的导览，也保留可核对的原文。叙述可以连贯、可以文学化，但只作描述，不加入作者判断和评价，也不超出所引资料。</p>
</section>
<section class="wrap prose">
  <h2>一、定位</h2>
  <p>本站不是纯摘录库，也不是无出处的历史写作。事件页由导览、元数据、原文摘录、来源与原文链接组成：导览负责把事件讲清楚，原文负责让读者核对。</p>
  <h2>二、叙述边界</h2>
  <ul>
    <li><strong>允许：</strong>整体性描述、细节叙事、背景介绍、来源中明确陈述的因果、结构性串联，以及适度的文学化表达。</li>
    <li><strong>必须：</strong>每个事实性陈述都能在所引来源中找到依据；导览段末标注来源；关键数字、日期、地名、人物与原文一致。</li>
    <li><strong>禁止：</strong>作者自己的判断、意义总结、价值评价、因果推断；编造细节、对话、心理活动与场景；把导览文字冒充原文；用修辞改变事实。</li>
    <li><strong>官方评价：</strong>只放在“原文摘录”中，不写入导览。</li>
    <li><strong>冲突：</strong>导览与原文不一致时，以原文为准，并在勘误中修订。</li>
  </ul>
  <h2>三、收录标准</h2>
  <ul>
    <li>全国性事件优先收录；省级只收具有全国影响的事件；县级及以下只收具有全国影响或典型意义者。</li>
    <li>每条至少有一个国家机构来源；核心条目尽量提供两个以上独立来源。</li>
    <li>同一事件如官方来源之间存在差异，保留原文并并列出处，不作裁断。</li>
  </ul>
  <h2>四、来源白名单</h2>
  <p>中央国家机构、国家馆藏、国家媒体、国家科研机构，以及经审核列入白名单的地方党史办、地方志办、地方政府网站与地方党报。个人博客、自媒体、百科与商业聚合不在收录范围。</p>
  <h2>五、原文与版权</h2>
  <ul>
    <li>政府文件、法律法规、公报、白皮书：可全文转载并保存本地快照。</li>
    <li>国家媒体报道：有限摘录 + 官方原文链接，不整篇镜像。</li>
    <li>正式出版物：短引文 + 页码/章节 + 版本信息 + 馆藏或出版社链接。</li>
    <li>档案：馆藏号 + 目录链接；无在线全文时明确标注“需到馆查阅”。</li>
    <li>图片：仅使用公有领域或已授权素材；否则只提供来源链接。</li>
  </ul>
  <h2>六、时间范围</h2>
  <p>1840—2021。2021 年以后仅作大事记式延伸，另行复核。</p>
  <h2>七、勘误</h2>
  <p>如发现引文、日期、地名、链接或机构信息有误，请在 GitHub 提交 Issue，或通过勘误页提供原文链接。修订会保留版本记录。</p>
  <h2>八、说明</h2>
  <p>有叙述就一定有选择。事件的选择、标题的确定、导览的详略与条目的编排仍然需要判断；本站通过公开收录标准、导览来源、逐条原文与链接，使这些判断可以被检查。</p>
  <p>当前版本为 M0 样稿，收录 10 条跨时期史料，用于验证来源、导览、引文、页面与地图流程。下一阶段扩充至 100 条内部测试，再扩充至 1000 条以上公开。</p>
</section>
`;

fs.writeFileSync(path.join(dist, 'methodology.html'), layout({
  title: '编纂原则',
  description: '叙述边界、收录标准、来源白名单、原文与版权策略。',
  body: methodologyBody,
  active: 'methodology'
}));

// ---------- corrections ----------
const correctionsBody = `
<section class="page-head wrap">
  <p class="kicker">勘误</p>
  <h1>勘误与版本</h1>
  <p class="lede">史料汇编难免有错。请尽量附上原文链接、页码或截图。</p>
</section>
<section class="wrap prose">
  <h2>提交方式</h2>
  <p>GitHub Issue：<a href="${SITE.repo}/issues" target="_blank" rel="noopener">${SITE.repo}/issues</a></p>
  <h2>请提供</h2>
  <ul>
    <li>条目名称与链接；</li>
    <li>需要更正的原文与页码/章节；</li>
    <li>国家机构来源链接；</li>
    <li>如为链接失效，请提供新的官方链接或馆藏信息。</li>
  </ul>
  <h2>处理原则</h2>
  <p>以原文为准；如来源之间不一致，并列保留，不作主观裁断。修订后在条目中更新“最后复核”日期。</p>
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
