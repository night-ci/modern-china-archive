import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const content = path.join(root, 'content');
const institutions = JSON.parse(fs.readFileSync(path.join(content, 'institutions.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(content, 'sources.json'), 'utf8'));
const events = fs.readdirSync(path.join(content, 'events'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(content, 'events', f), 'utf8')));

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
  if (e.status === 'published' && !e.last_reviewed) errors.push(`event ${e.id}: published without last_reviewed`);
}

if (errors.length) {
  console.error('Validation failed:');
  for (const err of errors) console.error(' - ' + err);
  process.exit(1);
}
console.log(`Validation passed: ${events.length} events, ${sources.length} sources, ${institutions.length} institutions.`);
