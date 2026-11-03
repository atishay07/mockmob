// Local publication/retrieval proof for signed V717 outputs. Never touches production; writes only a local SQLite store.
// Usage: node scripts/pipeline/tools/proveLocalPublicationV717.mjs <campaign-dir> <local-release-manifest.json> <output-dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { contentHash } from '../../../data/content_evidence.js';
import { publishUnitV717, retrievePracticeV717, retrieveNtaV717 } from '../lib/publicationBridgeV717.mjs';
import { openLocalPublicationStoreV717 } from '../lib/publicationStoreV717Local.mjs';
import { publicationEligibilityV717 } from '../lib/verifyV717.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const [campaignDir, manifestPath, outDir] = process.argv.slice(2).map(p => p && resolve(p));
if (!campaignDir || !manifestPath || !outDir) throw Error('usage: <campaign-dir> <manifest> <output-dir>');
try { loadEnvFile('.env.local'); } catch {}
const secret = process.env.CUET_EVIDENCE_SIGNING_KEY;
if (!secret) throw Error('signing_key_required');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const state = read(join(campaignDir, 'state.json')), registry = read(join(campaignDir, 'registry.json')), manifest = read(manifestPath);
const campaign = existsSync(join(campaignDir, 'campaign.json')) ? read(join(campaignDir, 'campaign.json')) : { jobs: [] };
if (existsSync(join(outDir, 'store.sqlite'))) throw Error('fresh_output_directory_required');
mkdirSync(outDir, { recursive: true });
const context = { registry, manifest, secret };
const eligible = Object.values(state.cases).filter(c => c.state === 'eligible' && c.question).map(c => c.question);
// Units: standalone questions publish alone; passage groups publish only as complete groups.
const units = [], groups = new Map();
for (const q of eligible) {
 if (q.passage_group_id) { const g = groups.get(q.passage_group_id) || []; g.push(q); groups.set(q.passage_group_id, g); }
 else units.push([q]);
}
const groupStatus = [];
for (const [id, members] of groups) {
 const registered = registry.passage_groups?.[id]?.candidate_ids || [];
 const complete = registered.length >= 2 && registered.every(m => members.some(q => q.id === m));
 groupStatus.push({ id, registered: registered.length, eligible_members: members.length, publishable: complete });
 if (complete) units.push(registered.map(m => members.find(q => q.id === m)).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
}
const report = { campaign: campaignDir.split(/[\\/]/).slice(-1)[0], eligible: eligible.length, units: units.length, groups: groupStatus, publish: [], restart: [], retrieval: {}, invalidation: {} };
let store = openLocalPublicationStoreV717(join(outDir, 'store.sqlite'));
for (const unit of units) {
 const result = await publishUnitV717({ questions: unit, ...context, target: 'local', adapter: store });
 report.publish.push({ ids: unit.map(q => q.id), state: result.state, reasons: result.reasons || [], rejections: result.rejections || [] });
}
store.close();
// Restart: reopen the same store and publish every unit again; committed units must recover receipt-only with zero new writes.
store = openLocalPublicationStoreV717(join(outDir, 'store.sqlite'));
let writes = 0;
const counting = { ...store, writeAtomic: async prepared => { writes++; return store.writeAtomic(prepared); } };
for (const unit of units) {
 const result = await publishUnitV717({ questions: unit, ...context, target: 'local', adapter: counting });
 report.restart.push({ ids: unit.map(q => q.id), state: result.state, recovered: result.recovered === true });
}
report.restart_new_writes = writes;
const rows = store.readRows(), holds = await store.readFamilyHolds();
report.persisted_rows = rows.length;
report.persisted_columns_only = rows.every(row => !['route', 'source_refs', 'learning_objective', 'evidence_quotes'].some(k => Object.hasOwn(row, k)));
for (const subject of ['accountancy', 'business_studies', 'economics', 'english']) {
 const subjectRows = rows.filter(r => r.subject === subject);
 const practice = retrievePracticeV717(subjectRows, { ...context, familyHolds: holds });
 const nta = retrieveNtaV717(subjectRows, 50, { ...context, subjectId: subject, seed: 'v717-local-proof', familyHolds: holds, inventoryComplete: false });
 const byBand = Object.fromEntries(['easy', 'medium', 'hard'].map(level => [level, retrievePracticeV717(subjectRows, { ...context, familyHolds: holds, difficulty: level }).rows.length]));
 report.retrieval[subject] = { persisted: subjectRows.length, practice: practice.rows.length, nta_selected: nta.selectedRows?.length || 0, by_difficulty: byBand,
  practice_only_rows: subjectRows.filter(r => r.quality_band === 'useful').length, nta_band_rows: subjectRows.filter(r => r.quality_band === 'strong').length,
  nta_rejections: (nta.scorecard_rejections || []).map(r => r.reasons).flat().reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {}) };
}
// Dispute one standalone question and (if any) one passage-group child; hold one family.
const standalone = rows.find(r => !r.passage_group_id), grouped = rows.find(r => r.passage_group_id);
if (standalone) store.recordDispute({ id: 'proof-dispute-1', questionId: standalone.id, contentHash: contentHash(standalone), receipt: { proof: 'local_dispute_invalidation' } });
if (grouped) store.recordDispute({ id: 'proof-dispute-2', questionId: grouped.id, contentHash: contentHash(grouped), receipt: { proof: 'local_group_dispute' } });
const afterDispute = store.readRows();
const practiceAfter = retrievePracticeV717(afterDispute, { ...context, familyHolds: await store.readFamilyHolds() });
report.invalidation.disputed_standalone_withheld = standalone ? !practiceAfter.rows.some(r => r.id === standalone.id) : null;
report.invalidation.disputed_group_whole_withheld = grouped ? !practiceAfter.rows.some(r => r.passage_group_id === grouped.passage_group_id) : null;
const victim = afterDispute.find(r => r.id !== standalone?.id && !r.passage_group_id);
if (victim) { store.holdFamily(victim.family_id, 'local proof hold'); }
const afterHold = retrievePracticeV717(store.readRows(), { ...context, familyHolds: await store.readFamilyHolds() });
report.invalidation.family_hold_withheld = victim ? !afterHold.rows.some(r => r.id === victim.id) : null;
report.invalidation.practice_rows_before = rows.length ? retrievePracticeV717(rows, { ...context, familyHolds: holds }).rows.length : 0;
report.invalidation.practice_rows_after = afterHold.rows.length;
// Content tamper check on one persisted row.
if (victim) {
 const tampered = { ...victim, correct_answer: victim.correct_answer === 'A' ? 'B' : 'A' };
 report.invalidation.content_tamper_rejected = publicationEligibilityV717(tampered, { ...context, mode: 'practice' }).reasons.includes('content_changed');
}
store.close();
writeFileSync(join(outDir, 'proof.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, publish: report.publish.map(p => p.state).reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {}), restart: report.restart.map(p => p.state + (p.recovered ? ':recovered' : '')).reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {}) }, null, 2));
