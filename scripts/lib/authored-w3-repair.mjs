// Wave 3: applies the expert verdicts' repairs to the authored text, without a model and without editing the batch files.
// Offline, pure functions. The repaired text is what the final acceptance judges, hashes and publishes.
//
// A verdict carries its repair in one of two ways:
//   fields   general_test and physics: the new value of every changed field ({ stem, options, correct_key, explanation, difficulty_label, unit, chapter, ncert_ref }).
//   repair   chemistry: sentences, parsed here (an ncert_ref renumbering "old" -> "new", a difficulty_label change, a unit/chapter move, a stem name change,
//            four rewritten options A: "..." to D: "..."). Every parsed old value must be the text's current value, else the repair is refused.
// A repair that cannot be applied cleanly is a problem, never a guess: the question is held.

const REPAIRABLE = ['unit', 'chapter', 'stem', 'options', 'correct_key', 'explanation', 'difficulty_label', 'ncert_ref'];
const SOLVER_VISIBLE = ['stem', 'options', 'correct_key', 'passage_text']; // wave 3's blind file carries no chapter by design
const KEYS = ['A', 'B', 'C', 'D'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The fields a chemistry repair sentence names, parsed to { field: newValue } (old values checked against q). { fields, problems }. */
export function parseTextRepair(q, repair) {
  const fields = {};
  const problems = [];
  const text = String(repair || '');
  const refChange = text.match(/ncert_ref[^"]*?"([^"]+)" -> "([^"]+)"/);
  if (refChange) {
    if (q.ncert_ref !== refChange[1]) problems.push(`ncert_ref is "${q.ncert_ref}", the repair expects "${refChange[1]}"`);
    else fields.ncert_ref = refChange[2];
  }
  const refSet = text.match(/ncert_ref set to "([^"]+)"/);
  if (refSet) fields.ncert_ref = refSet[1];
  const unit = text.match(/unit changed from "([^"]+)" to "([^"]+)"/);
  if (unit) { if (q.unit !== unit[1]) problems.push(`unit is "${q.unit}", the repair expects "${unit[1]}"`); else fields.unit = unit[2]; }
  const chapter = text.match(/chapter from "([^"]+)" to "([^"]+)"/);
  if (chapter) { if (q.chapter !== chapter[1]) problems.push(`chapter is "${q.chapter}", the repair expects "${chapter[1]}"`); else fields.chapter = chapter[2]; }
  const level = text.match(/difficulty_label changed from (\w+) to (\w+)/);
  if (level) { if (q.difficulty_label !== level[1]) problems.push(`difficulty_label is "${q.difficulty_label}", the repair expects "${level[1]}"`); else fields.difficulty_label = level[2]; }
  const stemName = text.match(/Stem name "([^"]+)" changed to "([^"]+)"/);
  if (stemName) {
    const count = String(q.stem).split(stemName[1]).length - 1;
    if (count !== 1) problems.push(`the stem holds "${stemName[1]}" ${count} times, the repair expects once`);
    else fields.stem = String(q.stem).replace(stemName[1], stemName[2]);
  }
  if (/Options rewritten/.test(text)) {
    const found = [...text.matchAll(/\b([A-D]): "([^"]+)"/g)].map((m) => ({ key: m[1], text: m[2] }));
    if (found.map((o) => o.key).join('') !== 'ABCD') problems.push(`the repair names options ${found.map((o) => o.key).join('') || 'none'}, not A to D`);
    else fields.options = found;
    const keyStays = text.match(/key stays ([A-D])/);
    if (keyStays && q.correct_key !== keyStays[1]) problems.push(`the key is ${q.correct_key}, the repair says it stays ${keyStays[1]}`);
  }
  if (!Object.keys(fields).length && !problems.length) problems.push('the repair text names no field this parser knows');
  return { fields, problems };
}

/**
 * q with the verdict's repair applied: { q, changed: [field], solverVisible: bool, problems: [text] }.
 * ready and drop verdicts change nothing. The stated solver-visible flag of the verdict is checked against the real difference.
 */
export function applyExpertRepair(q, verdict) {
  const out = { q, changed: [], solverVisible: false, problems: [] };
  if (!verdict || verdict.verdict !== 'repaired') return out;
  let fields = verdict.fields;
  if (!fields) {
    const parsed = parseTextRepair(q, verdict.repair);
    out.problems.push(...parsed.problems);
    fields = parsed.fields;
  }
  const next = { ...q };
  for (const [field, value] of Object.entries(fields)) {
    if (!REPAIRABLE.includes(field)) { out.problems.push(`repair field ${field} is not one this tool applies`); continue; }
    if (field === 'options' && (!Array.isArray(value) || value.length !== 4 || value.some((o, i) => o?.key !== KEYS[i] || !String(o?.text || '').trim()))) { out.problems.push('repair options are not four keyed A to D'); continue; }
    if (field === 'correct_key' && !KEYS.includes(value)) { out.problems.push(`repair key ${value} is not A to D`); continue; }
    if (!same(q[field], value)) { next[field] = value; out.changed.push(field); }
  }
  out.q = next;
  out.solverVisible = out.changed.some((field) => SOLVER_VISIBLE.includes(field));
  const stated = verdict.solver_visible_text_changed ?? verdict.solver_visible_changed ?? (verdict.repair && /Solver-visible text changed: yes/i.test(verdict.repair) ? true : undefined);
  if (stated !== undefined && Boolean(stated) !== out.solverVisible && !out.problems.length) out.problems.push(`the verdict says solver-visible text ${stated ? 'changed' : 'did not change'}, the applied repair ${out.solverVisible ? 'changes' : 'does not change'} it`);
  if (verdict.solver_visible_text_changed === undefined && verdict.solver_visible_changed === undefined && /Solver-visible text unchanged/i.test(verdict.repair || '') && out.solverVisible && !out.problems.length) out.problems.push('the verdict says solver-visible text is unchanged, the applied repair changes it');
  if (!out.changed.length && !out.problems.length) out.problems.push('the verdict is repaired but its repair changes nothing');
  return out;
}
