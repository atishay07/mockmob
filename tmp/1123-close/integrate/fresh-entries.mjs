// Score records for the four fit-held rows (owner, 24 Nov 2026 "Yes, run it"), in the wave-6 entries format, from real result files only:
// the original five blind solvers (same text) and the fresh pass (j1, j2 quality; h1-h3 fit with the CUET 2026 anchor). OFFLINE.
import fs from 'node:fs';
import path from 'node:path';
const I = 'tmp/1123-close/integrate';
const R = 'docs/brain/reports/authored-w6';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const rows = new Map();
for (const f of ['wave6-candidates-final-2026-11-23.json', 'wave6b3-candidates-final-2026-11-24.json']) for (const c of read(path.join(R, f))) rows.set(c.id, c);
const PICK = [['70fc4da1', 'scoring', 'accountancy'], ['46fc9550', 'scoring3', 'computer_science'], ['a96cb5ae', 'scoring3', 'computer_science'], ['deb62cd1', 'scoring3', 'mathematics']];
const entries = {};
const cands = [];
for (const [short, dir, subject] of PICK) {
  const id = [...rows.keys()].find((k) => k.startsWith(short));
  const c = rows.get(id);
  const sdir = path.join(I, dir, subject);
  const batchFile = fs.readdirSync(sdir).find((f) => /__w6b[0-9a-z]*\.json$/.test(f) && read(path.join(sdir, f)).questions.some((q) => q.id === id));
  const batch = batchFile.replace('.json', '');
  const orig = read(path.join(sdir, batchFile)).questions.find((q) => q.id === id);
  for (const k of ['stem', 'options', 'correct_key', 'explanation', 'chapter']) if (JSON.stringify(orig[k]) !== JSON.stringify(c[k])) throw new Error(`${short}: ${k} differs from what the solvers saw`);
  const fb = `${subject}__w6f`;
  const fdir = path.join(I, 'fresh-fit', subject);
  const fq = read(path.join(fdir, `${fb}.json`)).questions.find((q) => q.id === id);
  for (const k of ['stem', 'options', 'correct_key', 'explanation', 'chapter']) if (JSON.stringify(fq[k]) !== JSON.stringify(c[k])) throw new Error(`${short}: fresh text ${k} differs`);
  const res = (base, d, b, role) => read(path.join(base, d, 'verify', `${b}__${role}.json`)).find((r) => r.id === id);
  const answers = ['s1', 's2', 's3', 's4', 's5'].map((r) => { const x = res(I + '/' + dir, subject, batch, r); return x.answer ?? x.blind_answer ?? x.choice; });
  const quality = ['j1', 'j2'].map((r) => { const x = res(I + '/fresh-fit', subject, fb, r); return { judge: r, quality_score: x.quality_score ?? x.score, blind_answer: x.blind_answer, key_matches: x.blind_answer === c.correct_key, difficulty_check: x.difficulty_check, objective_tag: x.objective_tag, flags: x.flags || [], note: x.note, on_final_text: true, batch: fb }; });
  const fit = ['h1', 'h2', 'h3'].map((r) => { const x = res(I + '/fresh-fit', subject, fb, r); return { judge: r, cuet_type: x.cuet_type, passage_skill: x.passage_skill, unit: x.unit, chapter: x.chapter, pyq_closeness: x.pyq_closeness, ten_route: x.ten_route, est_seconds: x.est_seconds, fit_score: x.fit_score, fit_flags: x.fit_flags || [], note: x.note, on_final_text: true, batch: fb }; });
  entries[id] = {
    subject: c.subject, batch, chapter: c.chapter, set_id: c.set_id ?? null,
    text: { expert_verdict: null, expert_issue: null, expert_reviewed_text: 'not_reviewed', judged: 'as_authored', pre_repair: null, authoring_verdict: 'claude_audited' },
    blind_solvers: { n: 5, matched_key: answers.filter((a) => a === c.correct_key).length, answers, on: 'final' },
    blind_resolve_on_final_text: null, quality, fit,
  };
  cands.push(c);
  console.log(short, 'solvers', answers.join(''), 'key', c.correct_key, 'quality', quality.map((q) => q.quality_score + (q.key_matches ? '' : '!')).join('/'), 'fit', fit.map((f) => f.fit_score + (f.fit_flags.length ? '*' : '')).join('/'), fit.map((f) => f.pyq_closeness).join(''));
}
fs.writeFileSync(path.join(R, 'wave6-fresh-fit-candidates-2026-11-24.json'), JSON.stringify(cands, null, 1) + '\n');
const head = read(path.join(R, 'wave6b3-score-entries-2026-11-24.json'));
const out = { ...head, built_at: new Date().toISOString(), models: { quality: 'claude-opus-5-5 (fresh pass)', fit: 'claude-opus-5-5 (fresh pass, CUET 2026 anchor)', solver: 'claude-subagent-unrecorded (original solvers, same text)' },
  note: 'Owner, 24 Nov 2026 ("Yes, run it"): the four rows held only by the CUET-fit rule were judged again by two fresh quality judges and three fresh fit judges who were shown the real CUET 2026 question each row mirrors (tmp/1123-close/integrate/fresh-fit/FRESH.md). Solvers are the original five on the same text. Built by tmp/1123-close/integrate/fresh-entries.mjs from the result files only.',
  candidates_file: `${R}/wave6-fresh-fit-candidates-2026-11-24.json`, counts: { entries: Object.keys(entries).length }, entries };
const crypto = await import('node:crypto');
out.candidates_sha256 = crypto.createHash('sha256').update(fs.readFileSync(out.candidates_file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
fs.writeFileSync(path.join(R, 'wave6-fresh-fit-score-entries-2026-11-24.json'), JSON.stringify(out, null, 1) + '\n');
