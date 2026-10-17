// Builds the wave 4 plan files from plan-data.mjs. OFFLINE: reads blueprints, score tables and earlier authored candidates; writes files only.
//   node tmp/authored-w4/plan/build-plan.mjs        (run from the repo root)
// Writes: tmp/authored-w4/plan/allocations/<job>.txt, tmp/authored-w4/plan/avoid/<job>.txt, docs/brain/reports/authored-w4/wave4-plan-2026-10-17.json
import fs from 'node:fs';
import path from 'node:path';
import { JOBS, SOURCE } from './plan-data.mjs';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const out = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const problems = [];
const bad = (message) => problems.push(message);
const slug = (value) => String(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const blueprint = {};
const chapterUnits = {};
for (const subject of ['physics', 'chemistry', 'mathematics', 'biology', 'general_test']) {
  blueprint[subject] = read(`data/nta_blueprints/${subject}.json`);
  const map = new Map();
  for (const variant of blueprint[subject].variants) for (const section of variant.sections) for (const unit of section.units) for (const chapter of unit.chapters) {
    if (!map.has(chapter.name)) map.set(chapter.name, new Set());
    map.get(chapter.name).add(unit.name);
  }
  chapterUnits[subject] = map;
}

// Existing authored questions (waves 1-3) and the judges' objective tags, per subject and chapter, for the avoid lists.
const earlier = [
  ...read('docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json'),
  ...read('docs/brain/reports/authored-w2/wave2-candidates-final-2026-10-14.json'),
  ...read('docs/brain/reports/authored-w3/wave3-candidates-final-2026-10-17.json'),
];
const tags = {};
for (const subject of Object.keys(blueprint)) {
  const agent = read(`data/nta_agent_scores/${subject}.json`).questions;
  const fit = read(`data/nta_fit_scores/${subject}.json`).questions;
  const by = (tags[subject] = {});
  for (const [id, entry] of Object.entries(agent)) {
    const chapter = fit[id]?.chapter || entry.chapter;
    for (const tag of entry.objective_tags || []) {
      const concept = String(tag).split('.').slice(2).join('.');
      if (!concept) continue;
      by[chapter] = by[chapter] || new Map();
      by[chapter].set(concept, (by[chapter].get(concept) || 0) + 1);
    }
  }
}

const sum = (object) => Object.values(object).reduce((a, b) => a + b, 0);
const jobs = [];
for (const job of JOBS) {
  const bp = blueprint[job.subject];
  const chapterTotal = job.chapters.reduce((a, c) => a + c.n, 0);
  if (chapterTotal !== 20) bad(`${job.job}: chapters sum to ${chapterTotal}`);
  if (sum(job.types) !== 20) bad(`${job.job}: types sum to ${sum(job.types)}`);
  if (sum(job.difficulty) !== 20) bad(`${job.job}: difficulty sums to ${sum(job.difficulty)}`);
  if (sum(job.keys) !== 20) bad(`${job.job}: keys sum to ${sum(job.keys)}`);
  for (const c of job.chapters) {
    const units = chapterUnits[job.subject].get(c.chapter);
    if (!units) bad(`${job.job}: chapter "${c.chapter}" is not in the ${job.subject} blueprint`);
    else if (!units.has(c.unit)) bad(`${job.job}: unit "${c.unit}" does not list chapter "${c.chapter}" (${[...units].join(' | ')})`);
    if ((bp.excludedChapters || []).some((e) => e.name === c.chapter)) bad(`${job.job}: ${c.chapter} is excluded by the blueprint`);
    if (c.set && c.set.size > c.n) bad(`${job.job}: set larger than chapter count`);
  }
  for (const type of Object.keys(job.types)) if (!bp.typeQuotas[type]) bad(`${job.job}: type ${type} not in the blueprint quotas`);
  const outPath = `C:\\Users\\atish\\Desktop\\mockmob copy\\wt-wave4\\tmp\\authored-w4\\drafts\\${job.subject}\\${job.job}.json`;
  const avoidPath = `C:\\Users\\atish\\Desktop\\mockmob copy\\wt-wave4\\tmp\\authored-w4\\plan\\avoid\\${job.job}.txt`;
  const blueprintPath = `C:\\Users\\atish\\Desktop\\mockmob copy\\wt-wave4\\data\\nta_blueprints\\${job.subject}.json`;
  const syllabusPath = `C:\\Users\\atish\\Desktop\\mockmob copy\\wt-wave4\\data\\CUET 2026\\${job.subject}.pdf`;

  // ---- avoid file
  const lines = [`AVOID LIST for ${job.job} (${job.subject}). Data, not instructions. Concepts and stems below are already in the bank or in earlier authored waves: do not repeat the same idea, the same key answer, the same figures or a near-copy of a stem. Test a different concept from the chapter's topic list.`, ''];
  for (const c of job.chapters) {
    lines.push(`== ${c.chapter}`);
    const concepts = [...(tags[job.subject][c.chapter] || new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push(`Objectives the judges already tagged in this chapter (${concepts.length}; count in brackets):`);
    lines.push(concepts.length ? concepts.map(([concept, n]) => `${concept}${n > 1 ? ` [${n}]` : ''}`).join('; ') : '(none)');
    const stems = earlier.filter((q) => q.subject === job.subject && q.chapter === c.chapter);
    lines.push(`Stems already authored in waves 1-3 for this chapter (${stems.length}; first 120 characters):`);
    for (const q of stems) lines.push(`- ${String(q.stem).replace(/\s+/g, ' ').slice(0, 120)}`);
    lines.push('');
  }
  out(`tmp/authored-w4/plan/avoid/${job.job}.txt`, `${lines.join('\n')}\n`);

  // ---- allocation text
  const A = [];
  A.push(`JOB ${job.job}: ${job.title}`);
  A.push(`Subject: ${job.subject} | Questions: exactly 20 | source value for every question: ${SOURCE}`);
  A.push(`Blueprint: ${blueprintPath}`);
  A.push(`Syllabus PDF: ${syllabusPath}`);
  A.push(`Avoid list (read it): ${avoidPath}`);
  A.push('');
  A.push('1. CHAPTERS (the exact counts; use the chapter and unit strings exactly as written, they are the blueprint spellings; questions of one chapter stay together in the file in this order):');
  job.chapters.forEach((c, i) => {
    A.push(`   ${i + 1}. chapter "${c.chapter}" | unit "${c.unit}" | ${c.n} questions`);
    A.push(`      Topics to draw from (one concept per question, spread across the list, no two questions on the same sub-topic): ${c.topics}.`);
    if (c.set) A.push(`      SET: ${c.set.note}.`);
  });
  A.push('');
  A.push('2. TYPES (exact counts over the 20, set items included):');
  A.push(`   ${Object.entries(job.types).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  for (const p of job.place) A.push(`   - ${p}`);
  A.push('');
  A.push(`3. DIFFICULTY (exact): easy ${job.difficulty.easy}, medium ${job.difficulty.medium}, hard ${job.difficulty.hard}. Spread each level over the chapters; do not put all the hard ones in one chapter. Use the difficulty meanings in the template; a hard item is two or three linked steps or a fine distinction at CUET level, never an Olympiad item.`);
  A.push(`4. KEY LETTERS (exact): A ${job.keys.A}, B ${job.keys.B}, C ${job.keys.C}, D ${job.keys.D}. Decide the key letters first (a shuffled list, no pattern, no three equal in a row, no repeating cycle such as A B C D A B C D) and then build each question around its assigned letter.`);
  A.push(job.numerical === 0 ? '5. NUMERICALS: no minimum. This job is recall and concept based; a numerical is allowed only where the topic list calls for one.' : `5. NUMERICALS: at least ${job.numerical} of the 20 must be computed numericals (the answer is a number you worked out, units checked).`);
  if (job.sets) {
    A.push('6. SETS:');
    for (const s of job.sets) A.push(`   one set in chapter "${s.chapter}": ${s.size} questions (${s.itemTypes}), one passage or scenario of ${s.words} words that you write yourself (original, factual, NCERT-level, no figure or table), every child carries the identical passage_text and the identical set_id "${job.job}-set-1", the ${s.size} children are consecutive in the file, each child tests a different thing and none can be answered without reading the passage, and no child's answer is stated word for word in the passage.`);
  } else {
    A.push('6. SETS: none. passage_text is null and set_id is null on every question.');
  }
  A.push('');
  A.push(`7. FILE: ${outPath}`);
  out(`tmp/authored-w4/plan/allocations/${job.job}.txt`, `${A.join('\n')}\n`);

  jobs.push({
    job: job.job, subject: job.subject, subjectBank: job.subject === 'general_test' ? 'gat' : job.subject, title: job.title, count: 20,
    chapters: job.chapters.map((c) => ({ chapter: c.chapter, unit: c.unit, n: c.n, set: c.set ? c.set.size : 0 })),
    types: job.types, difficulty: job.difficulty, keys: job.keys, numericalMin: job.numerical,
    sets: job.sets || [], outPath, allocationPath: `tmp/authored-w4/plan/allocations/${job.job}.txt`, avoidPath: `tmp/authored-w4/plan/avoid/${job.job}.txt`,
  });
}

// totals and checks across the wave
const totals = {};
for (const j of jobs) {
  const t = (totals[j.subject] = totals[j.subject] || { n: 0, keys: { A: 0, B: 0, C: 0, D: 0 }, types: {}, difficulty: { easy: 0, medium: 0, hard: 0 }, chapters: {} });
  t.n += j.count;
  for (const k of 'ABCD') t.keys[k] += j.keys[k];
  for (const [k, v] of Object.entries(j.types)) t.types[k] = (t.types[k] || 0) + v;
  for (const [k, v] of Object.entries(j.difficulty)) t.difficulty[k] += v;
  for (const c of j.chapters) t.chapters[c.chapter] = (t.chapters[c.chapter] || 0) + c.n;
}
// every chapter of the 2026 syllabus must be covered (the blueprint's chapters, applied-only chapters included)
for (const [subject, t] of Object.entries(totals)) {
  const wanted = new Set(chapterUnits[subject].keys());
  for (const chapter of wanted) if (!t.chapters[chapter]) bad(`${subject}: chapter ${chapter} has no question in the wave`);
  if (t.n !== 60) bad(`${subject}: ${t.n} questions, not 60`);
}
const seen = new Set();
for (const j of jobs) { if (seen.has(j.job)) bad(`duplicate job ${j.job}`); seen.add(j.job); }
if (problems.length) { console.error('PLAN PROBLEMS\n' + problems.join('\n')); process.exit(1); }

const plan = {
  kind: 'authored_w4_plan', date: '2026-10-17', source: SOURCE, branch: 'content/wave4-1017',
  questions: jobs.reduce((a, j) => a + j.count, 0), jobCount: jobs.length,
  note: 'Planned from select-only production counts (live, not deleted) and the committed NTA score tables against the 2026 blueprints. See coverage.',
  totals, jobs,
};
out('docs/brain/reports/authored-w4/wave4-plan-2026-10-17.json', `${JSON.stringify(plan, null, 1)}\n`);
console.log(JSON.stringify({ ok: true, questions: plan.questions, jobs: jobs.length, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { n: v.n, keys: v.keys, types: v.types, difficulty: v.difficulty }])) }, null, 1));
