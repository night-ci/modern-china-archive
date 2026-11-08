import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const content = path.join(root, 'content');
const institutions = JSON.parse(fs.readFileSync(path.join(content, 'institutions.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(content, 'sources.json'), 'utf8'));
const events = fs.readdirSync(path.join(content, 'events'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(content, 'events', f), 'utf8')));
const chronologyPath = path.join(content, 'chronology.json');
const chronology = fs.existsSync(chronologyPath)
  ? JSON.parse(fs.readFileSync(chronologyPath, 'utf8'))
  : [];
const prePath = path.join(content, 'pre1921.json');
const pre1921 = fs.existsSync(prePath) ? JSON.parse(fs.readFileSync(prePath, 'utf8')) : [];
const prcPath = path.join(content, 'chronology-prc.json');
const prcChronology = fs.existsSync(prcPath) ? JSON.parse(fs.readFileSync(prcPath, 'utf8')) : [];

const errors = [];
const instById = Object.fromEntries(institutions.map(i => [i.id, i]));
const srcById = Object.fromEntries(sources.map(s => [s.id, s]));

for (const s of sources) {
  const inst = instById[s.institution_id];
  if (!inst) { errors.push(`source ${s.id}: unknown institution ${s.institution_id}`); continue; }
  if (!s.url) { errors.push(`source ${s.id}: missing url`); continue; }
  let host = '';
  try { host = new URL(s.url).hostname; } catch { errors.push(`source ${s.id}: invalid url ${s.url}`); continue; }
  if (inst.domain && !(host === inst.domain || host.endsWith('.' + inst.domain))) {
    errors.push(`source ${s.id}: host ${host} not under institution domain ${inst.domain}`);
  }
}

for (const e of events) {
  if (!Array.isArray(e.quotes) || e.quotes.length === 0) errors.push(`event ${e.id}: no quotes`);
  for (const q of e.quotes || []) {
    if (!q.text || !q.source_id) errors.push(`event ${e.id}: malformed quote`);
    if (!srcById[q.source_id]) errors.push(`event ${e.id}: unknown source ${q.source_id}`);
  }
  for (const id of e.source_ids || []) {
    if (!srcById[id]) errors.push(`event ${e.id}: unknown source_id ${id}`);
  }
  for (const id of e.overview_sources || []) {
    if (!srcById[id]) errors.push(`event ${e.id}: unknown overview source ${id}`);
    if (!(e.source_ids || []).includes(id)) errors.push(`event ${e.id}: overview source ${id} not in source_ids`);
  }
  if (e.status === 'published') {
    if (!e.overview || e.overview.trim().length < 40) errors.push(`event ${e.id}: published without a substantive overview`);
    if (!Array.isArray(e.overview_sources) || e.overview_sources.length === 0) errors.push(`event ${e.id}: overview without sources`);
  }
  if (e.status === 'published' && !e.last_reviewed) errors.push(`event ${e.id}: published without last_reviewed`);
}

if (chronology.length < 1000) errors.push(`chronology: only ${chronology.length} entries; expected at least 1000`);
const seenChron = new Set();
for (const c of prcChronology) {
  if (!c.id || !c.text || !c.title) errors.push(`prc ${c.id || '?'}: missing id/title/text`);
  if (!c.source_id || !srcById[c.source_id]) errors.push(`prc ${c.id}: unknown source ${c.source_id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_start || '')) errors.push(`prc ${c.id}: bad date_start ${c.date_start}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_end || '')) errors.push(`prc ${c.id}: bad date_end ${c.date_end}`);
}
if (prcChronology.length < 700) errors.push(`prc chronology: only ${prcChronology.length} entries; expected at least 700`);
for (const c of pre1921) {
  if (!c.id || !c.text || !c.title) errors.push(`pre1921 ${c.id || '?'}: missing id/title/text`);
  if (!c.source_id || !srcById[c.source_id]) errors.push(`pre1921 ${c.id}: unknown source ${c.source_id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_start || '')) errors.push(`pre1921 ${c.id}: bad date_start ${c.date_start}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_end || '')) errors.push(`pre1921 ${c.id}: bad date_end ${c.date_end}`);
}
for (const c of chronology) {
  if (!c.id || !c.text || !c.title) errors.push(`chronology ${c.id || '?'}: missing id/title/text`);
  if (!c.source_id || !srcById[c.source_id]) errors.push(`chronology ${c.id}: unknown source ${c.source_id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_start || '')) errors.push(`chronology ${c.id}: bad date_start ${c.date_start}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_end || '')) errors.push(`chronology ${c.id}: bad date_end ${c.date_end}`);
  if (seenChron.has(c.id)) errors.push(`chronology ${c.id}: duplicate id`);
  seenChron.add(c.id);
}

if (errors.length) {
  console.error('Validation failed:');
  for (const err of errors) console.error(' - ' + err);
  process.exit(1);
}
console.log(`Validation passed: ${events.length} events, ${chronology.length} party chronology, ${prcChronology.length} PRC chronology, ${pre1921.length} pre-1921, ${sources.length} sources, ${institutions.length} institutions.`);
