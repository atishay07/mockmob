// NTA mode paper patterns: how a 50-question CUET UG paper is laid out per subject.
//
// CUET UG (2025 onward): every subject paper has 50 compulsory questions in 60 minutes.
// English (101) has two syllabus units: Reading Comprehension (factual, narrative and
// literary passages, each followed by a set of questions) and Verbal Ability (vocabulary,
// correct word usage, para jumbles, match the following). Domain subjects are a single
// section that covers every syllabus unit.
//
// The English proportions below follow recent papers, not a published NTA blueprint (NTA
// does not publish one): three passage sets of about five questions, the rest verbal
// ability. Passage sets stay whole and are spread through the paper, so a student never
// meets a long run of passages, and a paper is never padded with one question type.
import { getCanonicalSubject } from './canonical_syllabus.js';

export const NTA_PAPER_SIZE = 50;

export const NTA_PATTERNS = Object.freeze({
  english: Object.freeze({
    id: 'cuet_english_101',
    kind: 'language',
    label: 'CUET UG English',
    passages: Object.freeze({
      sectionId: 'reading_comprehension',
      label: 'Reading comprehension',
      chapters: Object.freeze(['Factual Passage', 'Narrative Passage', 'Literary Passage']),
      minSets: 2,
      targetSets: 3,
      maxSets: 4,
      minSetSize: 3,
      maxSetSize: 8,
      minQuestions: 8,
      targetQuestions: 15,
      maxQuestions: 20,
    }),
    // Verbal ability blocks, in paper order. Weights share the questions left after passages.
    sections: Object.freeze([
      Object.freeze({ id: 'vocabulary', label: 'Vocabulary', chapters: ['Vocabulary'], types: /vocab|synonym|antonym|idiom|one_word|word_meaning/, weight: 12 }),
      Object.freeze({ id: 'correct_word_usage', label: 'Correct word usage', chapters: ['Correct Word Usage'], types: /word_usage|fill|blank|grammar|error|sentence_correction|usage/, weight: 9 }),
      Object.freeze({ id: 'para_jumbles', label: 'Para jumbles', chapters: ['Para Jumbles'], types: /jumble|rearrange|sequence|order/, weight: 7 }),
      Object.freeze({ id: 'match_the_following', label: 'Match the following', chapters: ['Match the Following'], types: /match/, weight: 7 }),
    ]),
    // No section may take more than this multiple of its share when another section is short.
    maxStretch: 1.5,
  }),
});

const DOMAIN_LIMITS = Object.freeze({ maxPassageSets: 2, maxPassageQuestions: 10, maxSetSize: 6 });

export function ntaPatternFor(subjectId) {
  if (NTA_PATTERNS[subjectId]) return NTA_PATTERNS[subjectId];
  const canonical = getCanonicalSubject(subjectId);
  const chapters = [];
  for (const [unitIndex, unit] of (canonical?.units || []).entries()) {
    for (const chapter of unit.chapters || []) chapters.push({ chapter, unit: unit.unit_name, unitIndex });
  }
  return { id: `cuet_domain_${subjectId || 'unknown'}`, kind: 'domain', label: `CUET UG ${canonical?.subject_name || subjectId}`, chapters, ...DOMAIN_LIMITS };
}

function chapterOf(candidate) {
  return String(candidate.rows[0]?.chapter || '').trim();
}

function typeOf(candidate) {
  const row = candidate.rows[0] || {};
  return String(row.question_type ?? row.questionType ?? '').toLowerCase();
}

function englishSectionFor(candidate, pattern) {
  const chapter = chapterOf(candidate);
  const byChapter = pattern.sections.find((section) => section.chapters.includes(chapter));
  if (byChapter) return byChapter.id;
  const type = typeOf(candidate);
  const byType = type && pattern.sections.find((section) => section.types.test(type));
  return byType ? byType.id : null;
}

/** Splits `total` across weights with the largest-remainder method. */
export function apportion(total, weights) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const exact = weights.map((weight) => (total * weight) / sum);
  const base = exact.map(Math.floor);
  let left = total - base.reduce((acc, value) => acc + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    base[index] += 1;
    left -= 1;
  }
  return base;
}

function pickPassageSets(passageCandidates, rules, take, notes) {
  const eligible = passageCandidates.filter((candidate) => {
    if (candidate.size < rules.minSetSize) { notes.fragments += 1; return false; }
    if (candidate.size > rules.maxSetSize) { notes.oversized += 1; return false; }
    return true;
  });
  // Rotate through passage kinds (factual, narrative, literary) so the sets differ in kind.
  const byChapter = new Map();
  for (const candidate of eligible) {
    const chapter = rules.chapters.includes(chapterOf(candidate)) ? chapterOf(candidate) : 'other';
    if (!byChapter.has(chapter)) byChapter.set(chapter, []);
    byChapter.get(chapter).push(candidate);
  }
  const queues = [...rules.chapters, 'other'].map((chapter) => byChapter.get(chapter) || []).filter((queue) => queue.length);
  const sets = [];
  let questions = 0;
  const wantMore = () => sets.length < rules.targetSets || (questions < rules.targetQuestions && sets.length < rules.maxSets);
  while (queues.some((queue) => queue.length) && wantMore()) {
    for (const queue of queues) {
      if (!wantMore()) break;
      while (queue.length) {
        const candidate = queue.shift();
        if (questions + candidate.size > rules.maxQuestions) continue;
        if (!take(candidate)) continue;
        sets.push(candidate);
        questions += candidate.size;
        break;
      }
    }
  }
  return { sets, questions };
}

function fillSections(sectionDefs, buckets, total, maxStretch, take) {
  const quotas = apportion(total, sectionDefs.map((section) => section.weight));
  const caps = quotas.map((quota) => Math.max(quota, Math.ceil(quota * maxStretch)));
  const chosen = sectionDefs.map(() => []);
  const cursor = sectionDefs.map(() => 0);
  const next = (index) => {
    const bucket = buckets.get(sectionDefs[index].id) || [];
    while (cursor[index] < bucket.length) {
      const candidate = bucket[cursor[index]];
      cursor[index] += 1;
      if (take(candidate)) return candidate;
    }
    return null;
  };
  // First pass: each section up to its share.
  for (let index = 0; index < sectionDefs.length; index += 1) {
    while (chosen[index].length < quotas[index]) {
      const candidate = next(index);
      if (!candidate) break;
      chosen[index].push(candidate);
    }
  }
  // Second pass: a short section's questions go to the others, one at a time, up to each cap.
  let count = chosen.reduce((sum, list) => sum + list.length, 0);
  let progress = true;
  while (count < total && progress) {
    progress = false;
    for (let index = 0; index < sectionDefs.length && count < total; index += 1) {
      if (chosen[index].length >= caps[index]) continue;
      const candidate = next(index);
      if (!candidate) continue;
      chosen[index].push(candidate);
      count += 1;
      progress = true;
    }
  }
  return sectionDefs.map((section, index) => ({ section, quota: quotas[index], cap: caps[index], chosen: chosen[index], available: (buckets.get(section.id) || []).length }));
}

function assembleEnglish(pattern, { passages, standalone }, take, size) {
  const notes = { fragments: 0, oversized: 0, unclassified: 0 };
  const rules = pattern.passages;
  const { sets, questions: passageQuestions } = pickPassageSets(passages, rules, take, notes);

  const buckets = new Map();
  for (const candidate of standalone) {
    const sectionId = englishSectionFor(candidate, pattern);
    if (!sectionId) { notes.unclassified += 1; continue; }
    if (!buckets.has(sectionId)) buckets.set(sectionId, []);
    buckets.get(sectionId).push(candidate);
  }
  const verbal = fillSections(pattern.sections, buckets, size - passageQuestions, pattern.maxStretch, take);

  // Layout: a verbal block, then a passage set, alternating, so passages are spread out.
  const blocks = [];
  const verbalBlocks = verbal.filter((entry) => entry.chosen.length);
  const longest = Math.max(verbalBlocks.length, sets.length);
  for (let index = 0; index < longest; index += 1) {
    if (verbalBlocks[index]) blocks.push({ section: verbalBlocks[index].section.id, label: verbalBlocks[index].section.label, candidates: verbalBlocks[index].chosen });
    if (sets[index]) blocks.push({ section: rules.sectionId, label: rules.label, candidates: [sets[index]], passageKey: sets[index].passageKey });
  }

  let shortfall = null;
  if (sets.length < rules.minSets || passageQuestions < rules.minQuestions) shortfall = 'not_enough_complete_passage_sets';
  else if (passageQuestions + verbal.reduce((sum, entry) => sum + entry.chosen.length, 0) < size) shortfall = 'not_enough_verbal_ability_questions';

  return {
    blocks,
    shortfall,
    sections: [
      { id: rules.sectionId, label: rules.label, target: rules.targetQuestions, selected: passageQuestions, sets: sets.length, setSizes: sets.map((set) => set.size) },
      ...verbal.map((entry) => ({ id: entry.section.id, label: entry.section.label, target: entry.quota, cap: entry.cap, selected: entry.chosen.length, available: entry.available })),
    ],
    notes,
  };
}

function assembleDomain(pattern, { passages, standalone }, take, size) {
  const notes = { fragments: 0, oversized: 0, unclassified: 0 };
  const order = new Map(pattern.chapters.map((entry, index) => [entry.chapter, index]));
  const unitOf = new Map(pattern.chapters.map((entry) => [entry.chapter, entry.unit]));
  const queues = new Map();
  const push = (candidate) => {
    const chapter = chapterOf(candidate) || 'Other';
    if (!queues.has(chapter)) queues.set(chapter, []);
    queues.get(chapter).push(candidate);
  };
  for (const candidate of standalone) push(candidate);
  for (const candidate of passages) {
    if (candidate.size > pattern.maxSetSize) { notes.oversized += 1; continue; }
    push(candidate);
  }
  for (const queue of queues.values()) queue.sort((a, b) => b.rank - a.rank);
  const chapters = [...queues.keys()].sort((a, b) => (order.get(a) ?? 1e6) - (order.get(b) ?? 1e6) || a.localeCompare(b));

  // Round-robin across chapters so the paper covers the whole syllabus.
  const picked = new Map(chapters.map((chapter) => [chapter, []]));
  let count = 0;
  let passageSets = 0;
  let passageQuestions = 0;
  let progress = true;
  while (count < size && progress) {
    progress = false;
    for (const chapter of chapters) {
      if (count >= size) break;
      const queue = queues.get(chapter);
      while (queue.length) {
        const candidate = queue.shift();
        if (count + candidate.size > size) continue;
        if (candidate.kind === 'passage' && (passageSets >= pattern.maxPassageSets || passageQuestions + candidate.size > pattern.maxPassageQuestions)) continue;
        if (!take(candidate)) continue;
        picked.get(chapter).push(candidate);
        count += candidate.size;
        if (candidate.kind === 'passage') { passageSets += 1; passageQuestions += candidate.size; }
        progress = true;
        break;
      }
    }
  }

  // Paper order follows the syllabus units; each chapter's questions stay together.
  const blocks = chapters.filter((chapter) => picked.get(chapter).length).map((chapter) => ({ section: unitOf.get(chapter) || 'Other', label: chapter, candidates: picked.get(chapter) }));
  const units = new Map();
  for (const block of blocks) units.set(block.section, (units.get(block.section) || 0) + block.candidates.reduce((sum, candidate) => sum + candidate.size, 0));
  return {
    blocks,
    shortfall: count < size ? 'not_enough_questions' : null,
    sections: [...units.entries()].map(([id, selected]) => ({ id, label: id, selected })),
    chaptersCovered: blocks.length,
    notes,
  };
}

/**
 * Assembles a paper. `take(candidate)` must accept or refuse a candidate (dedupe and answer
 * checks) and remember accepted ones. Candidates are ranked best first within each list.
 */
export function assembleNtaPaper(subjectId, candidates, take, size = NTA_PAPER_SIZE) {
  const pattern = ntaPatternFor(subjectId);
  const ranked = {
    passages: candidates.passages.map((candidate, index) => ({ ...candidate, rank: candidate.rank ?? -index })),
    standalone: candidates.standalone.map((candidate, index) => ({ ...candidate, rank: candidate.rank ?? -index })),
  };
  const result = pattern.kind === 'language'
    ? assembleEnglish(pattern, ranked, take, size)
    : assembleDomain(pattern, ranked, take, size);
  const ordered = result.blocks.flatMap((block) => block.candidates);
  return { pattern, ordered, ...result };
}

/** Longest run of consecutive questions that sit under a passage. */
export function longestPassageRun(rows) {
  let run = 0;
  let longest = 0;
  for (const row of rows) {
    if (row.passage_text || row.passageText) { run += 1; longest = Math.max(longest, run); } else run = 0;
  }
  return longest;
}
