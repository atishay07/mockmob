// The study stage's text rules (A1 3.4, 3.5, 3.9; A8 3.1-3.3): pure, so node --test holds them (pagerModel.test.mjs).

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The front's size step by its length in characters (A1 3.4): 's' up to 60, 'm' up to 120, 'l' longer. */
export function frontSize(text) {
  const n = String(text || '').replace(/\s+/g, ' ').trim().length;
  return n <= 60 ? 's' : n <= 140 ? 'm' : 'l';
}

/** The back's size step (A8 3.2): its characters plus 12 per line break; 's' to 110, 'm' to 200, 'l' to 320, 'xl' longer. */
export function backSize(text) {
  const s = String(text || '');
  const n = s.length + 12 * (s.match(/\n/g) || []).length;
  return n <= 110 ? 's' : n <= 200 ? 'm' : n <= 320 ? 'l' : 'xl';
}

/** A front read aloud: a blank reads "blank" (A8 F7). */
export const speakable = (text) => String(text || '').replace(/_{3,}/g, 'blank').replace(/\s+/g, ' ').trim();

/**
 * The options' words. A leading letter ("A. Sacrifice ratio", "(B) Nil") is stripped only when EVERY option carries its own
 * key that way (the server's servedOptions rule, A8 F23), so an option that starts with the article "A" keeps it.
 */
export function optionTexts(options) {
  const list = Array.isArray(options) ? options : [];
  const pattern = (key) => new RegExp(`^\\(?${String(key).replace(/[^A-Za-z0-9]/g, '')}[).:-]\\s*|^${String(key).replace(/[^A-Za-z0-9]/g, '')}\\s+(?=\\S)`, '');
  const every = list.length > 0 && list.every((o) => o && o.key && pattern(o.key).test(String(o.text ?? '').trim()) && String(o.text).trim().length > String(o.key).length + 1);
  return list.map((o) => {
    const text = String(o?.text ?? '').trim();
    return every ? text.replace(pattern(o.key), '').trim() : text;
  });
}

/** Two option columns on tablet and desktop when every option is 28 characters or fewer (A1 3.5). */
export const twoColumns = (texts) => Array.isArray(texts) && texts.length >= 2 && texts.length <= 4 && texts.every((t) => String(t).length <= 28);

/** An Assertion-Reason stem as two parts, else null (A1 3.5). */
export function assertionReason(stem) {
  const m = String(stem || '').match(/^\s*Assertion\s*(\(A\))?\s*:\s*(.+?)\s*Reason\s*(\(R\))?\s*:\s*(.+)$/is);
  if (!m) return null;
  const reason = m[4].trim();
  // A trailing instruction ("Choose the correct option.") stays with the reason; the options say the rest.
  return { assertion: m[2].trim(), reason };
}

const listItems = (text, labels) => {
  const re = new RegExp(`\\((${labels})\\)\\s*`, 'g');
  const marks = [];
  for (let m = re.exec(text); m; m = re.exec(text)) marks.push({ label: m[1], at: m.index, end: m.index + m[0].length });
  return marks.map((x, i) => ({ label: x.label, text: text.slice(x.end, i + 1 < marks.length ? marks[i + 1].at : text.length).trim() })).filter((x) => x.text);
};

/**
 * A "match List-I with List-II" stem as { lead, one: [{ label, text }], two: [...], tail }, else null. CUET prints both lists
 * inline ("... List-I (A) ... (D) ... List-II (I) ... (IV) ... Choose the correct answer ..."); set as two lists they read.
 */
export function matchLists(stem) {
  const s = String(stem || '').replace(/\s+/g, ' ').trim();
  // The headings that open each list: the last "List-I" before "(A)", the "List-II" before "(I)" (or "(1)", "(P)").
  const headOne = /\bList[\s-]*(?:I|1)\b\s*:?\s*(?=\(A\))/i;
  const headTwo = /\bList[\s-]*(?:II|2)\b\s*:?\s*(?=\((?:I|1|P)\))/i;
  const a = s.search(headOne);
  const b = s.search(headTwo);
  if (a < 0 || b < a) return null;
  const lead = s.slice(0, a).trim();
  const listOne = s.slice(a, b).replace(headOne, '');
  let rest = s.slice(b).replace(headTwo, '');
  let tail = '';
  const ask = rest.match(/^(.*?)\s*((?:Choose|Select|Pick|Identify|Match)\b[^()]*)$/i);
  if (ask) { rest = ask[1]; tail = ask[2].trim(); }
  const one = listItems(listOne, '[A-F]');
  const two = listItems(rest, 'IV|VI|V|I{1,3}|[1-6]|[P-T]');
  if (one.length < 2 || two.length < 2) return null;
  return { lead, one, two, tail };
}

/**
 * A "Statement I / Statement II / Statement III" stem as { lead, items: [{ label, text }], tail }, else null. The lead is what
 * comes before the first statement ("Read the following statements ..."); the tail is the ask that closes the last one
 * ("Choose the correct option.", "Which of the above ..."). Two or more statements are needed; set as a list they read.
 */
export function statementList(stem) {
  const s = String(stem || '').replace(/\s+/g, ' ').trim();
  const re = /Statement\s+(I{1,3}|IV|V|[1-5])\s*[:.–-]\s*/g;
  const marks = [];
  for (let m = re.exec(s); m; m = re.exec(s)) marks.push({ label: m[1], at: m.index, end: m.index + m[0].length });
  if (marks.length < 2) return null;
  const items = marks.map((x, i) => ({ label: x.label, text: s.slice(x.end, i + 1 < marks.length ? marks[i + 1].at : s.length).trim() }));
  let tail = '';
  const last = items[items.length - 1];
  // The ask starts at a capital "Choose", "Which", "Select" or "Pick" after a full stop, question mark or colon.
  const ask = /(?<=[.?!:])\s+(?=(?:Choose|Which|Select|Pick|Identify)\b)/.exec(last.text);
  if (ask) { tail = last.text.slice(ask.index).trim(); last.text = last.text.slice(0, ask.index).trim(); }
  if (items.some((x) => !x.text)) return null;
  return { lead: s.slice(0, marks[0].at).trim(), items, tail };
}

/** The stem's size step (A1 3.5): 's' up to 200 characters, else 'l'. */
export const stemSize = (stem) => (String(stem || '').length <= 200 ? 's' : 'l');

/**
 * The end's done line (A1 3.9, B7 E): "All 21 done in 9 min." / "You stopped at 8 of 21." from feed.done when the server
 * sends it, else from what the client saw (no minutes then).
 */
export function doneLine({ reached = 0, of = 0, minutes = null } = {}) {
  if (!of) return null;
  const mins = Number.isFinite(Number(minutes)) && Number(minutes) > 0 ? Math.max(1, Math.round(Number(minutes))) : null;
  if (reached >= of) return mins ? `All ${of} done in ${mins} min.` : `All ${of} done.`;
  return `You stopped at ${Math.max(0, reached)} of ${of}.`;
}

/** "About 6 min left" / "Under a minute left" from seconds (Learn's one minutes rule: the 10 percent, rounded, at least 1). */
export function timeLeft(seconds) {
  const s = Number(seconds) || 0;
  if (s <= 0) return null;
  if (s * 1.1 < 60) return 'Under a minute left';
  return `About ${Math.max(1, Math.round((s * 1.1) / 60))} min left`;
}

/** The book line of a chapter: "Ch 4, Accountancy Part 1" (either part may be missing). */
export const chapterRef = (chapter) => [chapter?.ref, chapter?.partTitle && chapter.partTitle !== chapter.title ? chapter.partTitle : null].filter(Boolean).join(', ') || null;
