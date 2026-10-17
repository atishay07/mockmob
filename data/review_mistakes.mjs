// Review's Mistakes view (docs/design-decisions/pass-1017/LEARN-REVIEW-1017.md 5.2 to 5.6, packet P-LR0 in part): every
// mistake on record, grouped by chapter across papers, priced in marks with RESULT-1017's own rule (6 for a wrong answer,
// 5 for a blank), what is already repaired (F17), and the one next move. PURE: no I/O, no React.
//
//   paperItems(attempt, repairedQids)  server: one paper's wrong answers and blanks as small rows (no key, no options)
//   reviewModel(papers, { aiCredits }) client: chapters, receipt, next move and counts from /api/recovery's ordinaryReview
//
// Only what the record holds is said. Check it held outcomes are not on this read, so the receipt counts what is known
// (found, repaired, open, left blank) and never a "held" figure it cannot back.
import { NEXT_MOVE_RULES, repairValueLine, repairCostLine, practiceCostLine } from './result_next_move.mjs';

export const REVIEW_RULES = Object.freeze({
  stemChars: 110, // the stem's first line on a row
  itemsPerPaper: 60, // a full mock has 50 questions; anything past this is counted, not listed
  itemsTotal: 400,
  chaptersShown: 4, // then "See all N chapters"
  itemsShown: 6, // inside an opened chapter, then "Show k more"
});

const LETTERS = 'ABCDEFGH';
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const firstLine = (value) => {
  const raw = typeof value === 'string' ? value : typeof value?.text === 'string' ? value.text : '';
  const line = raw.replace(/\s+/g, ' ').trim();
  if (!line) return '';
  return line.length > REVIEW_RULES.stemChars ? `${line.slice(0, REVIEW_RULES.stemChars - 1).trimEnd()}…` : line;
};

/**
 * One paper's mistakes and blanks, in paper order: [{ qid, n, chapter, state, pick, stem }]. `state` is 'open' (a wrong
 * answer with no saved repair), 'repaired' (a saved repair: it opens free) or 'blank'. `repairedQids` is a Set or an array.
 */
export function paperItems(attempt, repairedQids = []) {
  const repaired = repairedQids instanceof Set ? repairedQids : new Set(repairedQids || []);
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const details = Array.isArray(attempt?.details) ? attempt.details : [];
  const byQid = new Map(details.filter((d) => d && typeof d.qid === 'string').map((d) => [d.qid, d]));
  const out = [];
  questions.forEach((q, index) => {
    if (!q || typeof q.id !== 'string') return;
    const d = byQid.get(q.id) || null;
    if (d?.isCorrect === true) return;
    const wrong = d?.isCorrect === false;
    const state = wrong ? (repaired.has(q.id) ? 'repaired' : 'open') : 'blank';
    out.push({
      qid: q.id, n: index + 1, chapter: typeof q.chapter === 'string' && q.chapter.trim() ? q.chapter.trim() : 'Other questions', state,
      pick: wrong && Number.isInteger(d?.givenIndex) ? LETTERS[d.givenIndex] || null : null,
      stem: firstLine(q.question ?? q.body ?? q.text),
    });
  });
  return out.slice(0, REVIEW_RULES.itemsPerPaper);
}

/** Marks a chapter's open items cost: 6 for each open wrong answer, 5 for each blank (RESULT-1017 4.2). */
export const marksOf = (open, blank) => open * NEXT_MOVE_RULES.gapWrong + blank * NEXT_MOVE_RULES.gapBlank;

/** "Mock 3 and Quick practice", "Mock 3, Mock 2 and 1 more". */
export function papersPhrase(names) {
  const list = [...new Set(names.filter(Boolean))];
  if (list.length <= 2) return list.join(' and ');
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;
}

// "16 Oct" in India time, for naming a paper that has no number of its own ("Quick practice, 16 Oct").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDay(at) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'numeric' }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1] || ''}`.trim();
}
/** A paper's name in a sentence: "Mock 3" as the server numbers it; a practice set with its day, so two never merge. */
export function paperName(paper) {
  const source = paper?.source || 'Quick practice';
  if (/^(Mock|NTA)/.test(source)) return source;
  const day = shortDay(paper?.completedAt);
  return day ? `${source}, ${day}` : source;
}

const practiseHref = (subject, chapter) => {
  const p = new URLSearchParams({ subject: subject || '', mode: 'quick', count: String(NEXT_MOVE_RULES.setSize) });
  if (chapter) p.set('chapter', chapter);
  return `/dashboard?${p}`;
};

/**
 * From /api/recovery's ordinaryReview (newest first; each paper may carry `items`): the whole Mistakes view.
 *   chapters  [{ key, subject, chapter, marks, open, blank, repaired, total, papers, items }] costliest first
 *   receipt   { found, repaired, open, blank, papers }
 *   move      the one next move { kind, title, why, label, href, value, cost, alt } or null
 *   listed    whether item rows exist (an older server sends counts only)
 */
export function reviewModel(papers = [], { aiCredits = null, practiceCredits = null, isPremium = false } = {}) {
  const list = Array.isArray(papers) ? papers : [];
  const listed = list.some((p) => Array.isArray(p?.items));
  const byKey = new Map();
  let found = 0, repaired = 0, open = 0, blank = 0;
  list.forEach((paper, order) => {
    const items = Array.isArray(paper?.items) ? paper.items : [];
    for (const item of items) {
      const key = `${paper.subject}|${item.chapter}`;
      if (!byKey.has(key)) byKey.set(key, { key, subject: paper.subject, chapter: item.chapter, open: 0, blank: 0, repaired: 0, wrong: 0, newest: order, papers: [], items: [] });
      const c = byKey.get(key);
      const name = paperName(paper);
      c.items.push({ ...item, attemptId: paper.id, source: paper.source || 'Quick practice', paper: name, at: paper.completedAt, order });
      if (!c.papers.includes(name)) c.papers.push(name);
      if (item.state === 'open') { c.open += 1; c.wrong += 1; open += 1; found += 1; }
      else if (item.state === 'repaired') { c.repaired += 1; c.wrong += 1; repaired += 1; found += 1; }
      else if (item.state === 'blank') { c.blank += 1; blank += 1; }
    }
  });
  // Counts-only papers (an older server, or a paper past the item limit) still count in the receipt.
  if (!listed) {
    for (const p of list) {
      const r = Math.max(0, p?.repaired || 0);
      const m = Math.max(0, p?.mistakes || 0);
      found += m; repaired += r; open += Math.max(0, m - r);
    }
  }
  const stateRank = { open: 0, blank: 1, repaired: 2 };
  const chapters = [...byKey.values()].map((c) => ({
    ...c,
    marks: marksOf(c.open, c.blank),
    total: c.items.length,
    // Inside a chapter: open first (newest paper, then paper order), then blanks, then repaired.
    items: c.items.sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.order - b.order || a.n - b.n),
  })).sort((a, b) => b.marks - a.marks || b.open - a.open || a.newest - b.newest || a.chapter.localeCompare(b.chapter));
  const costly = chapters.filter((c) => c.marks > 0);
  const receipt = { found, repaired, open, blank, papers: list.length };
  return { chapters: costly, cleared: chapters.filter((c) => c.marks === 0), receipt, move: reviewMove(costly, { aiCredits, practiceCredits, isPremium, anyPaper: list.length > 0, subject: list[0]?.subject || null }), listed };
}

/**
 * The one move on Review (LEARN-REVIEW-1017 5.3 with RESULT-1017's rules, on the open set across papers):
 *   a repairable open mistake in the costliest chapter and AI credits 1+ or unknown   Repair Q{n} (opens it on its paper)
 *   0 AI credits, or only blanks left                                                Practise 10 on this chapter
 *   nothing open                                                                     Take another fresh paper
 */
export function reviewMove(chapters, { aiCredits = null, practiceCredits = null, isPremium = false, anyPaper = true, subject = null } = {}) {
  if (!anyPaper) return null;
  const top = chapters[0] || null;
  if (!top) {
    return { kind: 'fresh', title: 'Nothing open', why: 'Every mistake on your record has a saved repair. A fresh paper finds what is left.', label: 'Set up a fresh full mock', href: subject ? `/dashboard?subject=${encodeURIComponent(subject)}&mode=full` : '/dashboard?mode=full', value: null, cost: null, alt: null };
  }
  const where = papersPhrase(top.papers);
  const first = top.items.find((i) => i.state === 'open') || null;
  const practise = { label: 'Practise 10 on this chapter', href: practiseHref(top.subject, top.chapter) };
  if (first && aiCredits !== 0) {
    return {
      kind: 'repair', title: top.chapter,
      why: top.papers.length > 1 ? `Your costliest chapter: ${top.marks} marks lost in ${where}. Q${first.n} from ${first.paper} comes first.` : `Your costliest chapter: ${top.marks} marks lost in ${where}. Q${first.n} comes first.`,
      label: `Repair Q${first.n}`, href: `/result/${encodeURIComponent(first.attemptId)}#repair-${first.n}`,
      value: repairValueLine(first.pick), cost: repairCostLine(aiCredits),
      alt: { label: `${practise.label} instead`, href: practise.href }, target: { attemptId: first.attemptId, n: first.n, qid: first.qid },
    };
  }
  const why = first ? 'Repairs use AI credits. You have 0.' : `${plural(top.blank, 'question')} left blank in ${where}. A chapter set brings them back with marks.`;
  return {
    kind: 'practise', title: top.chapter, why: `Your costliest chapter: ${top.marks} marks lost in ${where}. ${why}`,
    label: practise.label, href: practise.href, value: null, cost: practiceCostLine({ isPremium, practiceCredits }),
    alt: first ? { label: 'See your AI credits', href: '/pricing/ai-credits' } : null,
  };
}

/** The receipt's one line under the four numbers. */
export function receiptLine({ found, repaired, open }) {
  if (!found) return 'No wrong answers on your record yet.';
  if (!repaired) return `None repaired yet. A repair explains why your pick looked right, then checks it on a new question.`;
  const tail = open ? `${plural(open, 'mistake')} still open.` : 'Nothing is open.';
  return `${repaired} of ${found} repaired. Each opens free and comes with a Check it held. ${tail}`;
}

/** A chapter row's source line: "4 wrong, 1 left blank. Accountancy, Mock 3 and Quick practice". */
export function chapterSource(c, subjectName) {
  const parts = [c.open ? `${c.open} open` : null, c.repaired ? `${c.repaired} repaired` : null, c.blank ? `${c.blank} left blank` : null].filter(Boolean).join(', ');
  return `${parts}. ${[subjectName, papersPhrase(c.papers)].filter(Boolean).join(', ')}`;
}
