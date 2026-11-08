import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rawPath = path.join(root, 'content', 'raw', 'ds100-raw.html');
const outPath = path.join(root, 'content', 'chronology.json');

if (!fs.existsSync(rawPath)) {
  console.error('Missing raw source: content/raw/ds100-raw.html');
  process.exit(1);
}

const html = fs.readFileSync(rawPath, 'utf8');
const start = html.indexOf('font_area');
const end = html.indexOf('repaste.body.end');
if (start < 0 || end < 0) {
  console.error('Cannot locate article body');
  process.exit(1);
}
const body = html.slice(start, end);

function decode(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…').replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map(m => decode(m[1]))
  .filter(Boolean);

const pad = n => String(n).padStart(2, '0');
const months = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
function cnMonth(m) { return months[m - 1] || String(m); }

function periodFor(year) {
  if (year <= 1911) return '晚清';
  if (year <= 1921) return year === 1921 ? '建党与大革命' : '民国初年';
  if (year <= 1927) return '建党与大革命';
  if (year <= 1937) return '土地革命';
  if (year <= 1945) return '全面抗战';
  if (year <= 1949) return '解放战争';
  if (year <= 1978) return '建设与曲折';
  if (year <= 2012) return '改革开放';
  return '新时代';
}

function titleFrom(text) {
  let t = text.replace(/^同日\s*/, '').replace(/^同月\s*/, '').trim();
  t = t.split('。')[0];
  if (t.length > 52) {
    const cut = t.slice(0, 52);
    const idx = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('；'), cut.lastIndexOf('、'));
    t = (idx > 24 ? cut.slice(0, idx) : cut) + '…';
  }
  return t;
}

let year = null;
let month = null;
let lastStart = null;
let lastDisplay = null;
const items = [];
let seq = 0;

function pushItem({ y, mo, d, endY, endMo, endD, precision, display, text, locator }) {
  const date_start = `${y}-${pad(mo)}-${pad(d)}`;
  let date_end = date_start;
  if (endY || endMo || endD) {
    const ey = endY || y;
    const emo = endMo || mo;
    const ed = endD || d;
    date_end = `${ey}-${pad(emo)}-${pad(ed)}`;
  }
  seq += 1;
  items.push({
    id: `ds100-${String(seq).padStart(4, '0')}`,
    date_start,
    date_end,
    date_precision: precision,
    date_display: display,
    year: y,
    period: periodFor(y),
    title: titleFrom(text),
    text,
    source_id: 'cpc12371-ds100',
    locator
  });
  lastStart = { y, mo, d };
  lastDisplay = display;
}

for (const p of paragraphs) {
  let m;

  if ((m = p.match(/^(\d{4})年$/))) {
    year = Number(m[1]);
    month = null;
    continue;
  }

  if ((m = p.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*[－\-–—]\s*(?:(\d{1,2})月)?(\d{1,2})日)?\s+(.+)$/))) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const endMo = m[4] ? Number(m[4]) : null;
    const endD = m[5] ? Number(m[5]) : null;
    const display = `${y}年${mo}月${d}日` + (endD ? `—${endMo ? endMo + '月' : ''}${endD}日` : '');
    pushItem({ y, mo, d, endMo, endD, precision: 'day', display, text: m[6], locator: display });
    year = y; month = mo;
    continue;
  }

  if ((m = p.match(/^(\d{1,2})月(\d{1,2})日(?:\s*[－\-–—]\s*(?:(\d{1,2})月)?(\d{1,2})日)?\s+(.+)$/))) {
    if (!year) continue;
    const mo = Number(m[1]), d = Number(m[2]);
    const endMo = m[3] ? Number(m[3]) : null;
    const endD = m[4] ? Number(m[4]) : null;
    const display = `${year}年${mo}月${d}日` + (endD ? `—${endMo ? endMo + '月' : ''}${endD}日` : '');
    pushItem({ y: year, mo, d, endMo, endD, precision: 'day', display, text: m[5], locator: display });
    month = mo;
    continue;
  }

  if ((m = p.match(/^(\d{1,2})月\s+(.+)$/))) {
    if (!year) continue;
    const mo = Number(m[1]);
    const display = `${year}年${mo}月`;
    pushItem({ y: year, mo, d: 1, precision: 'month', display, text: m[2], locator: display });
    month = mo;
    continue;
  }

  if ((m = p.match(/^(\d{4})年(\d{1,2})月\s+(.+)$/))) {
    const y = Number(m[1]), mo = Number(m[2]);
    const display = `${y}年${mo}月`;
    pushItem({ y, mo, d: 1, precision: 'month', display, text: m[3], locator: display });
    year = y; month = mo;
    continue;
  }

  if ((m = p.match(/^同日\s+(.+)$/))) {
    if (!lastStart) continue;
    pushItem({ y: lastStart.y, mo: lastStart.mo, d: lastStart.d, precision: 'day', display: lastDisplay, text: m[1], locator: '同日' });
    continue;
  }

  if ((m = p.match(/^同月\s+(.+)$/))) {
    if (!year || !month) continue;
    const display = `${year}年${month}月`;
    pushItem({ y: year, mo: month, d: 1, precision: 'month', display, text: m[1], locator: '同月' });
    continue;
  }

  if ((m = p.match(/^本年\s+(.+)$/))) {
    if (!year) continue;
    const display = `${year}年`;
    pushItem({ y: year, mo: 1, d: 1, precision: 'year', display, text: m[1], locator: '本年' });
    continue;
  }

  if ((m = p.match(/^(春|夏|秋|冬|春夏|春夏之交|年初|年底)(?:\s*[－\-–—]\s*(翌年(?:春|夏|秋|冬|底|\d{1,2}月)))?\s+(.+)$/))) {
    if (!year) continue;
    const season = m[1];
    const range = m[2];
    const starts = { 春: [3, 1], 夏: [6, 1], 秋: [9, 1], 冬: [12, 1], 春夏: [3, 1], '春夏之交': [5, 1], 年初: [1, 1], 年底: [12, 1] };
    const [mo, d] = starts[season] || [1, 1];
    let endMo = mo + 2, endD = 28, endY = year;
    if (range) {
      if (range.includes('底')) { endY = year + 1; endMo = 12; endD = 31; }
      else if (range.includes('春')) { endY = year + 1; endMo = 5; endD = 31; }
      else if (range.includes('夏')) { endY = year + 1; endMo = 8; endD = 31; }
      else if (range.includes('秋')) { endY = year + 1; endMo = 9; endD = 30; }
      else if (range.includes('冬')) { endY = year + 1; endMo = 12; endD = 31; }
      else if (range.match(/(\d{1,2})月/)) { endY = year + 1; endMo = Number(range.match(/(\d{1,2})月/)[1]); endD = 28; }
    } else {
      if (season === '春') { endMo = 5; endD = 31; }
      if (season === '夏') { endMo = 8; endD = 31; }
      if (season === '秋') { endMo = 11; endD = 30; }
      if (season === '冬') { endMo = 12; endD = 31; }
      if (season === '春夏') { endMo = 8; endD = 31; }
      if (season === '春夏之交') { endMo = 6; endD = 30; }
      if (season === '年初') { endMo = 3; endD = 31; }
      if (season === '年底') { endMo = 12; endD = 31; }
    }
    const rangeLabel = range ? `—${range.replace('翌年', String(year + 1) + '年')}` : '';
    const display = `${year}年${season}${rangeLabel}`;
    pushItem({ y: year, mo, d, endY, endMo, endD, precision: 'season', display, text: m[3], locator: display });
    continue;
  }
}

fs.writeFileSync(outPath, JSON.stringify(items, null, 2) + '\n', 'utf8');
console.log(`Wrote ${items.length} chronology entries to content/chronology.json`);
console.log('Range:', items[0]?.date_start, '→', items[items.length - 1]?.date_start);
