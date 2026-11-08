import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const out = path.join(root, 'knowledge-base');

const institutions = JSON.parse(fs.readFileSync(path.join(contentDir, 'institutions.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(contentDir, 'sources.json'), 'utf8'));
const events = fs.readdirSync(path.join(contentDir, 'events'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(contentDir, 'events', f), 'utf8')))
  .sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)));
const party = JSON.parse(fs.readFileSync(path.join(contentDir, 'chronology.json'), 'utf8'));
const prc = JSON.parse(fs.readFileSync(path.join(contentDir, 'chronology-prc.json'), 'utf8'));
const pre = JSON.parse(fs.readFileSync(path.join(contentDir, 'pre1921.json'), 'utf8'));

const instById = Object.fromEntries(institutions.map(i => [i.id, i]));
const srcById = Object.fromEntries(sources.map(s => [s.id, s]));
const q = v => JSON.stringify(v == null ? '' : v);

function citation(s) {
  const inst = instById[s.institution_id] || { name: '' };
  const author = s.original_source || inst.name;
  const pub = s.published ? `(${s.published})` : '';
  return `${author}. ${s.title}[EB/OL]. ${pub}[${s.accessed}]. ${s.url}.`;
}

function write(file, text) {
  const p = path.join(out, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.replace(/\r\n/g, '\n').trim() + '\n', 'utf8');
}

fs.rmSync(out, { recursive: true, force: true });

/* sources */
for (const s of sources) {
  const inst = instById[s.institution_id] || { name: '' };
  const usedEvents = events.filter(e => (e.source_ids || []).includes(s.id));
  const usedPre = pre.filter(p => p.source_id === s.id);
  const partyCount = s.id === 'cpc12371-ds100' ? party.length : 0;
  const prcCount = s.id === 'cpc12371-prc70' ? prc.length : 0;

  const lines = [];
  lines.push('---');
  lines.push(`id: ${q(s.id)}`);
  lines.push('type: "source"');
  lines.push(`title: ${q(s.title)}`);
  lines.push(`institution: ${q(inst.name)}`);
  lines.push(`published: ${q(s.published || '')}`);
  lines.push(`url: ${q(s.url)}`);
  lines.push(`accessed: ${q(s.accessed)}`);
  lines.push('---', '');
  lines.push(`# ${s.title}`, '');
  lines.push(`- 机构：${inst.name}`);
  lines.push(`- 类型：${s.type}`);
  if (s.published) lines.push(`- 日期：${s.published}`);
  lines.push(`- 原始来源：${s.original_source || inst.name}`);
  lines.push(`- 原文链接：${s.url}`);
  lines.push(`- 引用格式：${citation(s)}`);
  if (s.note) lines.push(`- 说明：${s.note}`);
  lines.push('');

  if (s.id === 'cpc12371-ds100') {
    lines.push('## 收录情况', '', `本来源用于党史大事记 ${partyCount} 条。`, '', `目录：../chronology/party/`, '');
  } else if (s.id === 'cpc12371-prc70') {
    lines.push('## 收录情况', '', `本来源用于国史编年 ${prcCount} 条。`, '', `目录：../chronology/prc/`, '');
  } else {
    lines.push('## 本站使用的原文', '');
    const quoteLines = [];
    for (const e of usedEvents) {
      for (const x of e.quotes || []) {
        if (x.source_id !== s.id) continue;
        quoteLines.push(`### ${e.title}`, '', `> ${x.text}`, '', `- 位置：${x.locator || '正文'}`, `- 条目：../events/${e.id}.md`, '');
      }
    }
    for (const p of usedPre) {
      quoteLines.push(`### ${p.title}`, '', `> ${p.text}`, '', `- 位置：${p.locator || '正文'}`, `- 条目：../chronology/pre1921/${p.id}.md`, '');
    }
    if (quoteLines.length) lines.push(...quoteLines);
    else lines.push('本站未直接引用该来源的独立段落，仅登记来源信息。', '');
  }

  if (usedEvents.length) {
    lines.push('## 相关详解', '');
    for (const e of usedEvents) lines.push(`- [${e.title}](../events/${e.id}.md)`);
    lines.push('');
  }
  if (usedPre.length) {
    lines.push('## 相关前编', '');
    for (const p of usedPre) lines.push(`- [${p.title}](../chronology/pre1921/${p.id}.md)`);
    lines.push('');
  }
  write(`sources/${s.id}.md`, lines.join('\n'));
}

/* detailed events */
for (const e of events) {
  const lines = [];
  lines.push('---');
  lines.push(`id: ${q(e.id)}`);
  lines.push('type: "event"');
  lines.push(`title: ${q(e.title)}`);
  lines.push(`date: ${q(e.date_display)}`);
  lines.push(`period: ${q(e.period)}`);
  lines.push(`category: ${q(e.category)}`);
  lines.push(`tags: ${JSON.stringify(e.tags || [])}`);
  lines.push('---', '');
  lines.push(`# ${e.title}`, '');
  lines.push(`- 时间：${e.date_display}`);
  if ((e.places || []).length) lines.push(`- 地点：${e.places.map(p => p.historical).join('；')}`);
  if ((e.actors || []).length) lines.push(`- 人物：${e.actors.join('、')}`);
  if ((e.orgs || []).length) lines.push(`- 组织：${e.orgs.join('、')}`);
  lines.push('');
  if (e.overview) {
    lines.push('## 叙述', '', e.overview, '');
  }
  lines.push('## 原文摘录', '');
  for (const x of e.quotes || []) {
    const s = srcById[x.source_id];
    lines.push(`> ${x.text}`, '');
    lines.push(`—— ${s ? s.title : x.source_id}${x.locator ? '，' + x.locator : ''}`, '');
  }
  lines.push('## 来源', '');
  for (const id of e.source_ids || []) {
    const s = srcById[id];
    if (!s) continue;
    lines.push(`- [${s.title}](../sources/${s.id}.md)`);
    lines.push(`  - ${citation(s)}`);
  }
  lines.push('');
  write(`events/${e.id}.md`, lines.join('\n'));
}

/* chronology collections */
function chronologyFile(c, collection, dir) {
  const s = srcById[c.source_id];
  const lines = [];
  lines.push('---');
  lines.push(`id: ${q(c.id)}`);
  lines.push('type: "chronology"');
  lines.push(`collection: ${q(collection)}`);
  lines.push(`title: ${q(c.title)}`);
  lines.push(`date: ${q(c.date_display)}`);
  lines.push(`date_start: ${q(c.date_start)}`);
  lines.push(`date_end: ${q(c.date_end)}`);
  lines.push(`period: ${q(c.period)}`);
  lines.push(`source_id: ${q(c.source_id)}`);
  lines.push('---', '');
  lines.push(`# ${c.title}`, '');
  lines.push(`- 日期：${c.date_display}`);
  lines.push(`- 时期：${c.period}`);
  if (s) {
    lines.push(`- 来源：${s.title}`);
    lines.push(`- 原文链接：${s.url}`);
  }
  lines.push('');
  lines.push('## 原文', '', c.text, '');
  if (s) {
    lines.push('## 来源信息', '', `- [${s.title}](../../sources/${s.id}.md)`, `- ${citation(s)}`, '');
  }
  write(`${dir}/${c.id}.md`, lines.join('\n'));
}

for (const c of party) chronologyFile(c, '党史大事记', 'chronology/party');
for (const c of prc) chronologyFile(c, '国史编年', 'chronology/prc');
for (const c of pre) chronologyFile(c, '前编', 'chronology/pre1921');

/* collection indexes */
function collectionIndex(title, collection, dir, items) {
  const lines = [`# ${title}`, '', `共 ${items.length} 条。`, ''];
  let lastYear = null;
  for (const c of items.slice().sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)))) {
    const y = String(c.date_start).slice(0, 4);
    if (y !== lastYear) { lines.push(`## ${y}年`, ''); lastYear = y; }
    lines.push(`- [${c.title}](${c.id}.md) — ${c.date_display}`);
  }
  lines.push('');
  write(`${dir}/index.md`, lines.join('\n'));
}

collectionIndex('党史大事记', '党史大事记', 'chronology/party', party);
collectionIndex('国史编年', '国史编年', 'chronology/prc', prc);
collectionIndex('前编', '前编', 'chronology/pre1921', pre);

/* source index */
{
  const lines = ['# 来源文章', '', `共 ${sources.length} 个来源。`, ''];
  for (const s of sources) {
    const inst = instById[s.institution_id] || { name: '' };
    lines.push(`- [${s.title}](./${s.id}.md) — ${inst.name}${s.published ? ' · ' + s.published : ''}`);
  }
  lines.push('');
  write('sources/index.md', lines.join('\n'));
}

/* event index */
{
  const lines = ['# 详解事件', '', `共 ${events.length} 条。`, ''];
  for (const e of events) lines.push(`- [${e.title}](./${e.id}.md) — ${e.date_display}`);
  lines.push('');
  write('events/index.md', lines.join('\n'));
}

/* root index + csv */
{
  const rows = [];
  for (const c of party) rows.push(['党史大事记', c.id, c.title, c.date_display, c.period, c.source_id, srcById[c.source_id]?.url || '', `chronology/party/${c.id}.md`]);
  for (const c of prc) rows.push(['国史编年', c.id, c.title, c.date_display, c.period, c.source_id, srcById[c.source_id]?.url || '', `chronology/prc/${c.id}.md`]);
  for (const c of pre) rows.push(['前编', c.id, c.title, c.date_display, c.period, c.source_id, srcById[c.source_id]?.url || '', `chronology/pre1921/${c.id}.md`]);
  for (const e of events) rows.push(['详解', e.id, e.title, e.date_display, e.period, (e.source_ids || []).join(';'), '', `events/${e.id}.md`]);

  const csv = [['collection', 'id', 'title', 'date', 'period', 'source_id', 'source_url', 'file'], ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  write('index.csv', csv);

  const lines = [
    '# 中国近现代史史料图谱知识库',
    '',
    '由网站内容导出，供本地知识库使用。',
    '',
    '## 统计',
    '',
    `- 来源文章：${sources.length} 个`,
    `- 详解事件：${events.length} 条`,
    `- 党史大事记：${party.length} 条`,
    `- 国史编年：${prc.length} 条`,
    `- 前编：${pre.length} 条`,
    `- 合计条目：${events.length + party.length + prc.length + pre.length} 条`,
    '',
    '## 目录',
    '',
    '- [来源文章](sources/index.md)',
    '- [详解事件](events/index.md)',
    '- [党史大事记](chronology/party/index.md)',
    '- [国史编年](chronology/prc/index.md)',
    '- [前编](chronology/pre1921/index.md)',
    '- [总索引 CSV](index.csv)',
    ''
  ];
  write('index.md', lines.join('\n'));
}

console.log(`Knowledge base written to ${out}`);
console.log(`sources=${sources.length} events=${events.length} party=${party.length} prc=${prc.length} pre=${pre.length}`);
