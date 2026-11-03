/** The plan row a set was started from (data/plan_item.js), as the finished attempt carries it. */
const plannedFrom = (x) => x?.selectionMeta?.planItem || null;

/**
 * The earliest quick set after this attempt, in the same subject, with 5 or more questions, that followed this plan row.
 * A set started from the row itself (selection_meta.planItem is this paper and this row id, spec D.5-4) comes first.
 * Without one, the earliest set wholly inside the row's chapters stands in for it, as before. `chapter` is a chapter
 * name or the list of the row's chapters; `ref` is { itemId } for the row, or null.
 */
export function laterSet(attempt, allAttempts, chapter, now = Date.now(), ref = null) {
  const names = Array.isArray(chapter) ? chapter : chapter ? [chapter] : [];
  const cur = when(attempt);
  const after = (allAttempts || [])
    .filter((x) => x && x.id !== attempt.id && x.subject === attempt.subject && attemptScoring(x) === 'server' && modeOf(x) === 'quick'
      && when(x) > cur && when(x) <= now)
    .filter((x) => paperRows(x).length >= SWOT_RULES.later.minQuestions)
    .sort((a, b) => when(a) - when(b) || String(a.id).localeCompare(String(b.id)));
  const fromRow = ref ? after.find((x) => plannedFrom(x)?.attemptId === attempt.id && plannedFrom(x)?.itemId === ref.itemId) : null;
  const next = fromRow || (names.length ? after.find((x) => paperRows(x).every((row) => names.includes(row.chapter))) : null);
  if (!next) return null;
  const rows = paperRows(next);
  const right = rows.filter((row) => row.outcome === 'right').length;
  const date = istDayMonth(when(next));
  const line = names.length > 1 ? SWOT_COPY.laterMany(date, right, rows.length)
    : names.length === 1 ? SWOT_COPY.later(date, right, rows.length) : SWOT_COPY.laterPlan(date, right, rows.length);
  return { at: when(next), right, of: rows.length, line, ...(fromRow ? { fromPlan: true } : {}) };
}

function practiceHref(subject, count, chapters, attempt, itemId) {
  const chapter = chapters.length === 1 ? `&chapter=${encodeURIComponent(chapters[0])}` : chapters.length > 1 ? `&chapters=${encodeURIComponent(chapters.join(','))}` : '';
  // The row's own id rides along so the set that follows can be told apart (data/plan_item.js).
  return `/dashboard?subject=${encodeURIComponent(subject)}&mode=quick&count=${count}${chapter}&planAttemptId=${encodeURIComponent(attempt.id)}&planItemId=${itemId}`;
}

/** The plan's candidates in the order the plan reads them. */
function planCandidates(items) {
  const of = (kinds) => items.filter((item) => kinds.includes(item.kind));
  const byLost = (a, b) => (b.evidence?.paper?.lost ?? 0) - (a.evidence?.paper?.lost ?? 0) || (a.id < b.id ? -1 : 1);
  return [
    ...of(['repeat_loss']).sort(byWeight),
    ...of(['weak_chapter', 'chapter_slipped', 'weak_chapter_paper']).sort(byLost),
    ...of(['close_chapter']).sort(byLost),
    ...of(['not_opened']),
    ...of(['marked_review']),
    ...of(['untried']),
  ];
}

/**
 * Which chapters "Do these next" may need counted against the bank (the server reads exactly these, never the bank):
 * every chapter a candidate row names, then the untried candidates, capped. Valid syllabus chapters only.
 */
export function planInventoryChapters(items, subject, cap = 8) {
  const chapters = [];
  const add = (c) => { if (c && !chapters.includes(c) && isValidTopSyllabusPair(subject, c)) chapters.push(c); };
  const candidates = planCandidates(items).filter((item) => item.plan);
  for (const item of candidates) if (item.kind !== 'untried') add(item.chapter);
  for (const item of candidates) if (item.kind === 'untried') for (const c of item.plan.candidates || []) add(c);
  return chapters.slice(0, cap);
}

/**
 * The chapters one untried row takes (spec D.5-4, D.5-5). Without a read of the bank it is the first free chapter, as
 * before. With one: chapters with questions the student has not seen come first, a row takes up to
 * SWOT_RULES.plan.untriedChapters of them until the set size is covered, and a chapter that only holds questions
 * already seen is used only when nothing else is left. Chapters the read did not cover are not used.
 */
function untriedChapters({ subject, candidates, usedChapters, inventory, want }) {
  const free = candidates.filter((c) => isValidTopSyllabusPair(subject, c) && !usedChapters.has(c));
  const known = free.filter((c) => inventoryFor(inventory, c));
  if (!known.length) return { chapters: free.slice(0, 1), bank: null, unseen: null };
  const fresh = known.filter((c) => inventoryFor(inventory, c).unseen > 0);
  const pool = fresh.length ? fresh : known.filter((c) => inventoryFor(inventory, c).bank > 0);
  const chapters = [];
  let bank = 0; let unseen = 0;
  for (const c of pool) {
    const v = inventoryFor(inventory, c);
    chapters.push(c); bank += v.bank; unseen += v.unseen;
    if (chapters.length >= SWOT_RULES.plan.untriedChapters || bank >= want) break;
  }
  return { chapters, bank, unseen };
}

function buildPlan({ attempt, allAttempts, items, now, inventory = null }) {
  const R = SWOT_RULES;
  const subject = attempt.subject;
  const candidates = planCandidates(items);
  const plan = [];
  const usedChapters = new Set();
  let noChapterUsed = false;
  // A chapter that fails the syllabus check, or that the bank cannot fill a set in, cannot be practised, so it gets no
  // row; the read may still name it.
  let chapterSkipped = false;
  for (const item of candidates) {
    if (plan.length >= R.plan.max || !item.plan) continue;
    const want = item.plan.count ?? R.plan.chapterCount;
    let chapters = item.chapter ? [item.chapter] : [];
    let count = want;
    let stock = null; // { bank, unseen } over the row's chapters, when the bank was read
    if (item.kind === 'untried') {
      const taken = untriedChapters({ subject, candidates: item.plan.candidates || [], usedChapters, inventory, want });
      if (!taken.chapters.length) continue;
      chapters = taken.chapters;
      if (taken.bank !== null) stock = { bank: taken.bank, unseen: taken.unseen };
    }
    if (chapters.some((c) => !isValidTopSyllabusPair(subject, c))) { chapterSkipped = true; continue; }
    if (chapters.some((c) => usedChapters.has(c))) continue;
    if (!chapters.length && noChapterUsed) continue;
    if (chapters.length && item.kind !== 'untried') {
      const v = inventoryFor(inventory, chapters[0]);
      if (v) stock = { bank: v.bank, unseen: v.unseen };
    }
    if (chapters.length && stock) {
      // The set is never larger than the bank can fill, and a chapter that cannot fill the smallest set gets no row.
      count = fitCount(want, stock.bank);
      if (count === null) { chapterSkipped = true; continue; }
    }
    const id = `p${plan.length + 1}`;
    const reasonBase = item.kind === 'untried' && chapters.length > 1 ? item.plan.reasonMany : item.plan.reason;
    const label = item.plan.label ?? (chapters.length > 1 ? `Practise ${count} across ${SWOT_COPY.chapterList(chapters)}` : `Practise ${count} on ${chapters[0]}`);
    plan.push({
      id, label, reason: item.kind === 'untried' && stock ? `${reasonBase} ${SWOT_COPY.fresh(stock.unseen, count)}` : reasonBase,
      practice: { subject, mode: 'quick', count, chapter: chapters[0] || null, chapters },
      href: practiceHref(subject, count, chapters, attempt, id),
      later: laterSet(attempt, allAttempts, chapters, now, { itemId: id }),
      ...(stock ? { inventory: stock } : {}),
    });
    item.planId = id;
    for (const c of chapters) usedChapters.add(c);
    if (!chapters.length) noChapterUsed = true;
  }
  if (!plan.length) {
    const count = R.plan.mixedCount;
    // "No single chapter stands out" would be false beside a chapter the read names but no set can practise.
    plan.push({ id: 'p1', label: `Practise ${count} mixed questions`, reason: chapterSkipped ? SWOT_COPY.mixedOnly : SWOT_COPY.mixed,
      practice: { subject, mode: 'quick', count, chapter: null, chapters: [] }, href: practiceHref(subject, count, [], attempt, 'p1'),
      later: laterSet(attempt, allAttempts, [], now, { itemId: 'p1' }) });
  }
  return plan;
}

