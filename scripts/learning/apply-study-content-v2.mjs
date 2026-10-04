// Applies the dry-run-verified study content v2 to the owner-authorised project only.
//   node --env-file=.env.local scripts/learning/apply-study-content-v2.mjs plan
//   node --env-file=.env.local scripts/learning/apply-study-content-v2.mjs insert     (phase 1, before deploy)
//   node --env-file=.env.local scripts/learning/apply-study-content-v2.mjs supersede  (phase 2, after deploy)
//   node --env-file=.env.local scripts/learning/apply-study-content-v2.mjs verify
// Insert-only for content; supersede only changes publication_state of older unit versions, which fires
// the existing correction trigger. Never deletes. Writes a receipt to artifacts/study-suite/v2/.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalStudyJSON } from '../../data/study_content.js';

const PROJECT = 'isrxrxzjocewrdureyhp';
const mode = process.argv[2] || 'plan';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
if (!url?.includes(`${PROJECT}.supabase.co`)) throw new Error(`Refusing: target is not the authorised project ${PROJECT}`);
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const digest = v => createHash('sha256').update(canonicalStudyJSON(v)).digest('hex');
const pilot = JSON.parse(readFileSync('data/study/pilot.json', 'utf8'));
const release = JSON.parse(readFileSync('data/study/release.json', 'utf8'));
const report = JSON.parse(readFileSync('artifacts/study-suite/content-v2-import-dry-run-report.json', 'utf8'));
if (report.state !== 'passed') throw new Error('Dry run has not passed');
const units = pilot.units.map(u => ({ id: u.id, version: u.version, subject: u.subject, chapter: u.chapter, concept_id: u.conceptId, content: u, content_hash: digest(u), publication_state: 'published' }));
const cards = pilot.cards.map(c => ({ id: c.id, version: c.version, unit_id: c.unitId, unit_version: pilot.units.find(u => u.id === c.unitId).version, content: c, content_hash: digest(c) }));
for (const row of [...units, ...cards]) if (release[units.includes(row) ? 'units' : 'cards'][`${row.id}@${row.version}`]?.contentHash !== row.content_hash) throw new Error(`Not released: ${row.id}@${row.version}`);
const superseded = pilot.units.filter(u => u.version > 1).map(u => ({ id: u.id, below: u.version }));

async function verify() {
  const check = async (table, rows) => {
    const { data, error } = await db.from(table).select('id,version,content,content_hash').in('id', rows.map(r => r.id));
    if (error) throw error;
    return rows.map(r => { const live = data.find(d => d.id === r.id && d.version === r.version); return { id: `${r.id}@${r.version}`, present: !!live, hashMatches: !!live && live.content_hash === r.content_hash && digest(live.content) === r.content_hash }; });
  };
  const result = { units: await check('study_units', units), cards: await check('study_cards', cards) };
  const { data: states, error } = await db.from('study_units').select('id,version,publication_state').in('id', superseded.map(s => s.id)); if (error) throw error;
  return { ...result, ok: [...result.units, ...result.cards].every(r => r.present && r.hashMatches), versions: states };
}
const out = { at: new Date().toISOString(), mode, project: PROJECT, units: units.length, cards: cards.length, superseded };
if (mode === 'plan') out.verify = await verify();
if (mode === 'insert') {
  for (const [table, rows] of [['study_units', units], ['study_cards', cards]]) {
    const { error } = await db.from(table).upsert(rows, { onConflict: 'id,version', ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  out.verify = await verify();
  if (!out.verify.ok) { out.state = 'failed'; }
}
if (mode === 'supersede') {
  const before = await verify();
  if (!before.ok) throw new Error('Refusing to supersede: v2 rows are not all present and hash-matched');
  for (const s of superseded) {
    const { error } = await db.from('study_units').update({ publication_state: 'quarantined' }).eq('id', s.id).lt('version', s.below).eq('publication_state', 'published');
    if (error) throw new Error(`${s.id}: ${error.message}`);
  }
  out.verify = await verify();
}
if (mode === 'verify') out.verify = await verify();
out.state ||= out.verify?.ok ? 'ok' : 'check';
mkdirSync('artifacts/study-suite/v2', { recursive: true });
writeFileSync(`artifacts/study-suite/v2/apply-${mode}-receipt.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ state: out.state, mode, present: out.verify && [...out.verify.units, ...out.verify.cards].filter(r => r.present).length, matched: out.verify && [...out.verify.units, ...out.verify.cards].filter(r => r.hashMatches).length, versions: out.verify?.versions }, null, 1));
