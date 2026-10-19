// Mobi's "Where you stand" (C-dec 3 item c, 20 Oct 2026): the student's practice range against their own colleges'
// 2026 Round 1 closing marks. Free for every plan, no model call (C-dec 3b: what is computed from the record is free).
//
// Pure: the route (src/app/api/mobi/standing/route.js) reads the attempts, My colleges and the DU offerings files and
// hands them in, so data/tests/mobi_standing.test.mjs pins every rule without a database.
//
// What it is: arithmetic on the student's own server-scored practice (data/compass_projection.js), set against DU's
// published Round 1 closing marks. What it is not: a prediction, a normalised CUET score or an admission chance. Every
// surface that shows it carries STANDING_NOTE.
import { compassProjection, PAPER_MAX, MIN_PAPER_SAMPLE, QUESTIONS_PER_PAPER } from './compass_projection.js';
import { roundOneCutoff } from '../src/lib/du/compassLine.mjs';

export const STANDING_NOTE = 'From your own practice, before NTA normalisation. Not a prediction.';
export const STANDING_CATEGORY = 'UR';
export const CLOSE_FASTEST_MAX = 3;

const round1 = (n) => Math.round(n * 10) / 10;

/** Where one college sits against the band. `gap` = cutoff - band.mid (positive = marks short), only on a complete band. */
export function collegeRow(entry, cutoffRow, band) {
  const cutoff = cutoffRow?.cutoff ?? null;
  const base = { college: entry.college, programme: entry.programme || '', programmeId: entry.programmeId, cutoff, category: cutoffRow?.category || STANDING_CATEGORY };
  if (cutoff === null || !band?.complete) return { ...base, position: 'none', gap: null };
  const position = band.low >= cutoff ? 'above' : band.high < cutoff ? 'below' : 'within';
  return { ...base, position, gap: round1(cutoff - band.mid) };
}

/** A 10-question set on one chapter, in the same link form the repair uses (data/mistake_repair.js practiceHref). */
export const practiceLink = (subject, chapter) => `/test?${new URLSearchParams({ subject, mode: 'quick', count: '10', chapter })}`;

/**
 * The chapters that close the gap fastest: inside the papers that count, each ranked chapter's share of its paper's open
 * marks (its wrong and blank answers over the paper's wrong and blank answers, times the paper's open marks). Biggest first.
 */
export function closeFastest({ papers = [], ranked = [], subjectNames = {}, limit = CLOSE_FASTEST_MAX } = {}) {
  const bySubject = new Map(papers.filter((p) => p.status === 'ready').map((p) => [p.subject, p]));
  const missedOf = new Map();
  for (const c of ranked) missedOf.set(c.subject, (missedOf.get(c.subject) || 0) + c.wrong + c.skip);
  const out = [];
  for (const c of ranked) {
    const paper = bySubject.get(c.subject);
    const missed = missedOf.get(c.subject) || 0;
    if (!paper || !missed || !(c.wrong + c.skip)) continue;
    const marks = Math.round(paper.open * ((c.wrong + c.skip) / missed));
    if (marks <= 0) continue;
    out.push({ subject: c.subject, subjectName: subjectNames[c.subject] || c.subjectName || c.subject, chapter: c.chapter, marks, wrong: c.wrong, blank: c.skip, href: practiceLink(c.subject, c.chapter) });
  }
  return out.sort((a, b) => b.marks - a.marks || a.chapter.localeCompare(b.chapter)).slice(0, limit);
}


/**
 * @param attempts      server-scored attempts with public subject ids ({ subject, details:[{isCorrect}] })
 * @param colleges      My colleges in order ({ programmeId, programme, college })
 * @param offeringsFor  (programmeId) => the DU offerings file object, or null
 * @param ranked        computePrepOSInsights(...).chapters.ranked (subject, chapter, wrong, skip, ...)
 */
export function buildStanding({ attempts = [], colleges = [], offeringsFor = () => null, ranked = [], subjectNames = {}, category = STANDING_CATEGORY } = {}) {
  const projection = compassProjection(attempts, { subjectNames, rankedChapters: ranked });
  const ready = projection.papers.filter((p) => p.status === 'ready');
  const thin = projection.papers.filter((p) => p.status === 'thin').map((p) => ({ subject: p.subject, name: p.name, needed: p.needed }));
  const total = projection.total;
  const band = total.count ? {
    low: total.low, mid: total.mid, high: total.high, max: total.max, count: total.count, complete: total.complete,
    papers: ready.filter((p) => total.papers.includes(p.subject)).map((p) => ({ subject: p.subject, name: p.name, low: p.low, mid: p.mid, high: p.high, open: p.open })),
  } : null;
  const status = band ? (band.complete ? 'ready' : 'partial') : thin.length ? 'thin' : 'empty';

  const rows = (Array.isArray(colleges) ? colleges : []).map((entry) => {
    let cut = null;
    try { cut = roundOneCutoff(offeringsFor(entry.programmeId), entry, category); } catch { cut = null; }
    return collegeRow(entry, cut, band);
  });
  const first = rows.find((r) => r.cutoff !== null) || null;
  const counted = band ? projection.papers.filter((p) => band.papers.some((b) => b.subject === p.subject)) : [];
  const fastest = closeFastest({ papers: counted, ranked, subjectNames });
  const most = counted.slice().sort((a, b) => b.open - a.open)[0] || null;
  return {
    ok: true,
    status,
    band,
    thin,
    colleges: rows,
    first,
    gap: first?.gap ?? null,
    closeFastest: fastest,
    paperMostOpen: most ? { subject: most.subject, name: most.name, open: most.open } : null,
    category,
    note: STANDING_NOTE,
    minSample: MIN_PAPER_SAMPLE,
    paperMax: PAPER_MAX,
    questionsPerPaper: QUESTIONS_PER_PAPER,
    links: { colleges: '/admission-compass', practice: fastest[0] ? practiceLink(fastest[0].subject, fastest[0].chapter) : '/dashboard?mode=quick' },
  };
}

/**
 * The same standing, cut to fit Ask Mobi's model context (the size cap drops lower-value parts first): the band, the
 * colleges with their cutoffs and gaps, and the chapters that close the gap. Per-paper detail goes first when it must.
 */
export function standingForModel(standing, { compact = false } = {}) {
  if (!standing || standing.status === 'empty') return null;
  const b = standing.band;
  return {
    status: standing.status,
    note: 'Practice arithmetic before NTA normalisation; never a prediction or an admission chance.',
    band: b ? { low: b.low, mid: b.mid, high: b.high, max: b.max, complete: b.complete, ...(compact ? {} : { papers: b.papers.map((p) => ({ subject: p.subject, mid: p.mid, open: p.open })) }) } : null,
    colleges: (standing.colleges || []).slice(0, compact ? 3 : 8).map((c) => ({ college: c.college, programme: c.programme, cutoff2026Round1: c.cutoff, category: c.category, position: c.position, marksShort: c.gap })),
    closeFastest: (standing.closeFastest || []).map((c) => ({ subject: c.subject, chapter: c.chapter, marks: c.marks })),
    ...(compact ? {} : { thin: (standing.thin || []).map((t) => ({ subject: t.subject, needed: t.needed })) }),
  };
}
