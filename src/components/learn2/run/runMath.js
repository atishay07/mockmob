// Pure rules of the Learn run player (B section 3.5 and 4.1, DESIGN-SPEC A3/A4): seconds left, "Up next", the option text,
// the explanation's first line, and the stamp line. No React here, so node --test can hold them (runMath.test.mjs).

/** Seconds an item takes on screen (B 4.1): a rated card 15 s, a recap card 10 s, a question 60 s, a lesson its minutes. */
export function itemSeconds(item, kind = 'mix') {
  if (!item) return 0;
  if (item.type === 'question') return 60;
  if (item.type === 'lesson') return Math.max(1, Number(item.lesson?.minutes) || 5) * 60;
  return kind === 'recap' || item.look ? 10 : 15;
}

/** "about 6 min left" from the items still to finish (the current one counts until it is finished), with B's 10 percent. */
export function minutesLeftLine(items, done, kind = 'mix') {
  const rest = (items || []).slice(Math.max(0, done));
  const seconds = rest.reduce((sum, item) => sum + itemSeconds(item, kind), 0) * 1.1;
  if (!rest.length) return null;
  if (seconds < 60) return 'under a minute left';
  return `about ${Math.round(seconds / 60)} min left`;
}

const NOUN = { card: ['card', 'cards'], question: ['question', 'questions'], lesson: ['lesson', 'lessons'] };
const named = (type, n) => {
  const [one, many] = NOUN[type] || NOUN.card;
  if (n === 1) return type === 'card' ? 'a card' : type === 'lesson' ? 'a lesson' : 'a question';
  return `${n} ${many}`;
};

/** "Up next: 2 cards, then a question" from the items after the current one; null when nothing follows. */
export function upNextLine(items, at) {
  const next = (items || []).slice(at + 1);
  if (!next.length) return null;
  const groups = [];
  for (const item of next) {
    const type = item.type === 'question' ? 'question' : item.type === 'lesson' ? 'lesson' : 'card';
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.n += 1;
    else if (groups.length < 2) groups.push({ type, n: 1 });
    else break;
  }
  const [a, b] = groups;
  return b ? `Up next: ${named(a.type, a.n)}, then ${named(b.type, b.n)}` : `Up next: ${named(a.type, a.n)}`;
}

/** An option's text without a letter the bank repeated in front of it ("A Decrease in..." under key A). */
export function optionText(option) {
  const text = String(option?.text ?? '').trim();
  const key = String(option?.key ?? '').trim();
  if (!key) return text;
  const re = new RegExp(`^\\(?${key.replace(/[^A-Za-z0-9]/g, '')}[).:]?\\s+`, 'i');
  return re.test(text) && text.length > key.length + 2 ? text.replace(re, '') : text;
}

/** The explanation's first sentence, for a right answer ("Right." and one line, B 3.5). */
export function firstLine(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/^(.+?[.?])(\s|$)/);
  return (m ? m[1] : s).trim();
}

/** Where a re-inserted item goes: `at` from the server is a position in the run's list; clamp it after the current item. */
export function reinsertAt(length, current, at) {
  const n = Number(at);
  const wanted = Number.isFinite(n) ? n : current + 3;
  return Math.max(current + 1, Math.min(length, wanted));
}

/** The kind of flight a rating makes (A4). */
export const FLIGHT = Object.freeze({ 1: 'missed', 3: 'got', 4: 'easy' });

const STEP_RUNS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['i', 'ii', 'iii', 'iv', 'v', 'vi'],
  ['1', '2', '3', '4', '5', '6'],
];
const ASK = /^(.*?[.;:])\s+((?:Choose|Select|Identify|Pick|Find|Mark|Which|What|Arrange|Give)\b.*)$/;

/**
 * A stem that lists its steps inline ("Arrange ...: (A) Record ... (B) Record ... (C) ... Choose the correct sequence.") split into
 * { lead, steps: [{ label, text }], tail }, so the steps can show as a list (R2). null when the stem is not a clean list: fewer than
 * three steps, steps out of order, or a step label used again after the list.
 */
export function stemParts(body) {
  const s = String(body || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const re = /\(((?:[A-Fa-f]|i{1,3}|iv|vi?|[1-6]))\)\s/g;
  const marks = [];
  for (let m = re.exec(s); m; m = re.exec(s)) marks.push({ label: m[1], at: m.index, end: m.index + m[0].length });
  for (const seq of STEP_RUNS) {
    const start = marks.findIndex((x) => x.label === seq[0]);
    if (start < 0) continue;
    const run = [];
    for (let i = start; i < marks.length && run.length < seq.length && marks[i].label === seq[run.length]; i += 1) run.push(marks[i]);
    if (run.length < 3 || marks.length !== start + run.length) continue;
    const texts = run.map((x, i) => s.slice(x.end, i + 1 < run.length ? run[i + 1].at : s.length).trim());
    let tail = '';
    const last = texts[texts.length - 1].match(ASK);
    if (last) { texts[texts.length - 1] = last[1].trim(); tail = last[2].trim(); }
    if (texts.some((t) => !t)) continue;
    return { lead: s.slice(0, run[0].at).trim(), steps: run.map((x, i) => ({ label: x.label, text: texts[i] })), tail };
  }
  return null;
}

/** The progress pips (B 3.5): one per item, grouped by kind in runs of the same type; null past 40 items (a plain bar then). */
export function pipGroups(items, max = 40) {
  const list = items || [];
  if (!list.length || list.length > max) return null;
  const groups = [];
  list.forEach((item, i) => {
    const type = item?.type === 'question' ? 'question' : item?.type === 'lesson' ? 'lesson' : 'card';
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.to = i;
    else groups.push({ type, from: i, to: i });
  });
  return groups;
}

/** Mobi's one reaction on the run's end (R6): thinking after 3 or more missed cards, a nod at 80 percent right or better. */
export function endAct(tally) {
  const t = tally || {};
  if ((t.missed || 0) >= 3) return 'think';
  const answered = (t.right || 0) + (t.wrong || 0);
  const rated = (t.got || 0) + (t.easy || 0) + (t.missed || 0);
  const share = answered ? (t.right || 0) / answered : rated ? ((t.got || 0) + (t.easy || 0)) / rated : 0;
  return share >= 0.8 ? 'nod' : 'encourage';
}

/** The end's one detail under a number, from the server's line for it: "16 got it", "5 of 5 right", "1 of 2, 1 still open". */
export function numberDetail(line) {
  const text = String(line?.text || '').trim();
  if (!text) return '';
  return text.replace(/\s*fixed\b[.,]?\s*/i, ', ').replace(/,\s*,/g, ',').replace(/[.,\s]+$/, '');
}
