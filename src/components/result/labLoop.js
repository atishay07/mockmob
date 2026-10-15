// Mistake Lab slice 3 on the website (spec tmp/mistake-lab-v4/SPEC.md 4.7 to 4.10, 4.12): small pure helpers shared by
// the result page, the Lab, the Rule book, Analytics and Practice. Every sentence comes finished from the server
// (data/lab_loop.js, data/rule_book.js, data/across_mocks.js, data/repair_order.js); these only order, pick and label.

/**
 * Rows in repair order (lab.repairOrder): the order's qids first, in its order, then any other row in paper order.
 * Without an order (an older server, a failed part) the rows stay exactly as they were.
 */
export function inRepairOrder(rows, repairOrder) {
  const list = Array.isArray(rows) ? rows : [];
  const qids = Array.isArray(repairOrder?.qids) ? repairOrder.qids : null;
  if (!qids?.length) return list;
  const rank = new Map(qids.map((id, i) => [id, i]));
  const at = (row) => (rank.has(row?.q?.id) ? rank.get(row.q.id) : Number.MAX_SAFE_INTEGER);
  return list.map((row, i) => ({ row, i })).sort((a, b) => at(a.row) - at(b.row) || a.i - b.i).map((x) => x.row);
}

/** The cohort-led items of a repair order by qid ({ qid, number, reason, key, line }); empty in paper order. */
export function cohortItems(repairOrder) {
  if (repairOrder?.state !== 'cohort' || !Array.isArray(repairOrder.items)) return new Map();
  return new Map(repairOrder.items.filter((x) => x && x.reason !== 'paper' && x.key).map((x) => [x.qid, x]));
}

/**
 * The hero's repair key. When the first wrong answer still to repair (in repair order) is cohort-led, the key is
 * "Repair Q12 first" with its line ("26 of 31 other students got it right."); otherwise today's key, from `fallback`
 * (reaction.js repairKeyLabel), with no line. Null when nothing is left to repair.
 */
export function heroRepairKey(candidates, repairOrder, fallback) {
  const first = candidates?.[0];
  if (!first) return null;
  const item = cohortItems(repairOrder).get(first.q?.id);
  if (item) return { label: item.key, line: item.line || null, reason: item.reason, number: first.number };
  const label = fallback(candidates);
  return label ? { label, line: null, reason: null, number: first.number } : null;
}

/** The rule book with `id` as the one rule in force: the active rule and every rule's `active` flag. */
export function withActiveRule(book, active) {
  if (!book) return book;
  const id = active?.id ?? null;
  const mark = (r) => ({ ...r, active: r.id === id });
  return {
    ...book,
    active: active || null,
    repairs: book.repairs ? { ...book.repairs, chapters: (book.repairs.chapters || []).map((ch) => ({ ...ch, rules: (ch.rules || []).map(mark) })) } : book.repairs,
    habits: book.habits ? { ...book.habits, rules: (book.habits.rules || []).map(mark) } : book.habits,
  };
}

/** Every rule of a book, flat, with its chapter for a repair rule. */
export function allRules(book) {
  return [
    ...(book?.repairs?.chapters || []).flatMap((ch) => (ch.rules || []).map((r) => ({ ...r, chapter: ch.chapter }))),
    ...(book?.habits?.rules || []),
  ];
}

/** "14 Oct" for an ISO time, in India, or '' when it cannot be read. */
export function shortDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/** The text a student copies from a repair rule: the rule, and its memory hook on the next line. */
export function copyText(rule, hookLabel = 'To remember it:') {
  const text = String(rule?.text || '').trim();
  return rule?.hook ? `${text}\n${hookLabel} ${rule.hook}` : text;
}

/** The modes that are timed mocks (the rule and its start sheet line are for these only). */
export const MOCK_MODES = Object.freeze(['full', 'nta']);
