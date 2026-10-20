// How the Mob reads the questions of a frozen paper (moved out of src/lib/server/mob/deps.js, 20 Oct 2026, egress F12, so node:test can
// load it). No 'server-only' and no alias imports: the database and the two mappers are passed in.
//
// A race of 5 or 10 minutes read two single rows per answer (the key of the question just answered and the next question), each with
// every column (2 to 35 KB); a Full mock together or a weekly paper reads 10 to 60 rows on start, on every review, on settle, and the
// comparisons read all ten rows on EVERY Mob state read once the Mob has two sittings. Two loaders, because only the two start paths hand
// the rows to the practice session, which stores familyId, sourceKind and verificationEvidence from the signed record:
//   loadFull    the start paths (a weekly paper, an extra paper, a Full mock together). The full rows through the stamp cache
//               (data/question_row_cache.js): the Mob's members start the SAME paper, so the second member reads stamps, not 35 KB rows.
//               The visibility filter is applied to the rows exactly as the query applied it.
//   loadLight   every other read (keys, review, the race's next question, Fix it together, comparisons, the trap name). The light columns
//               (no evidence, no provenance), through questionOut, kept per question id for two minutes and at most 400 questions. A question
//               is content, the same for every member, never per-user data. A key corrected during a race is honoured within two minutes.
// Neither shows any other field to a member than before: the public question views read id, stem, options, key, explanation and passage.
import { readRowsCached } from './question_row_cache.js';
import { QUESTION_READ_SELECT } from './question_reads.js';
import { VISIBLE_QUESTION_FILTER } from './practice_source.js';
import { isInventoryVisible } from './inventory_count.js';

export const LIGHT_MS = 2 * 60 * 1000;
export const LIGHT_MAX = 400;
const MAX_IDS = 60; // a race's pool or a full mock
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createMobQuestionLoaders({ db, attach, toOut, now = Date.now } = {}) {
  const client = () => (typeof db === 'function' ? db() : db);
  const light = new Map(); // id -> { at, out }
  const idsOf = (ids) => (ids || []).filter((id) => typeof id === 'string').slice(0, MAX_IDS);

  async function loadFull(ids) {
    const list = idsOf(ids);
    if (!list.length) return [];
    const { data, error } = await readRowsCached(client(), list);
    if (error) throw error;
    const visible = (data || []).filter((row) => row && row.is_deleted === false && isInventoryVisible(row));
    const rows = await attach(visible);
    const byId = new Map(rows.map((r) => [r.id, toOut(r)]));
    return list.map((id) => byId.get(id)).filter(Boolean);
  }

  // `warm`: ids the caller expects to ask for next (a race's following questions). They are read together with `ids` only when one of
  // `ids` has to be read anyway, so a race of 30 answers reads six batches, not 30 rows; they are never returned.
  async function loadLight(ids, { warm = [] } = {}) {
    const list = idsOf(ids);
    if (!list.length) return [];
    const at = now();
    const stale = (id) => { const hit = light.get(id); return !hit || at - hit.at >= LIGHT_MS; };
    let missing = [...new Set(list)].filter(stale);
    if (missing.length) missing = [...new Set([...missing, ...idsOf(warm).filter(stale)])].slice(0, MAX_IDS);
    if (missing.length) {
      const { data, error } = await client().from('questions').select(QUESTION_READ_SELECT).in('id', missing).eq('is_deleted', false).or(VISIBLE_QUESTION_FILTER);
      if (error) throw error;
      const rows = await attach(data || []);
      const found = new Set();
      for (const row of rows) {
        found.add(row.id);
        light.delete(row.id);
        light.set(row.id, { at, out: toOut(row) });
      }
      // a question that is gone or withdrawn is not served from an older copy
      for (const id of missing) if (!found.has(id)) light.delete(id);
      while (light.size > LIGHT_MAX) light.delete(light.keys().next().value);
    }
    return list.map((id) => light.get(id)?.out).filter(Boolean).map(clone);
  }

  return { loadFull, loadLight, forget() { light.clear(); }, get lightSize() { return light.size; } };
}
