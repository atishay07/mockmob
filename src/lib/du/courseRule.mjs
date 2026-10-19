// What a DU course asks for in CUET subjects, as plain sentences, for the first run's subjects step (the app's CourseRule and
// EligibilityCheck, flutter_app lib/features/onboarding/data/course_rule.dart; owner 19 Oct, G9: "this shows after someone has
// selected" so it is shown BEFORE any pick). Built only from the Bulletin's combinations in public/du/2026/index.json (the same
// rules the Compass page evaluates), never from a guess. PURE: no I/O, no React.
//
// Copy rules: sentence case, no "!", no em dash, no hype. A course's rule is stated, not promised.
import { evaluateGroup } from './eligibility.js';

const COUNT = ['none', 'one', 'two', 'three', 'four', 'five'];
const count = (n) => COUNT[n] || String(n);

/** "A, B and C"; "A and B"; "A". With a comma inside an item the last join takes one too, so it never reads as part of that item. */
export function joinWords(items, last = 'and') {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} ${last} ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}${list.some((i) => i.includes(',')) ? ',' : ''} ${last} ${list[list.length - 1]}`;
}

/** Profile subject ids are the DU catalog ids, except the aptitude test. */
export const toDuSubjectId = (id) => (id === 'general_test' ? 'gat' : id === 'applied_mathematics' ? 'mathematics' : id);

/** The student's picks as the DU engine reads them: { languages, domains, gat }. Ids it does not know (a non-DU paper) are ignored. */
export function selectionFromSubjects(ids, rules) {
  const languages = new Set((rules?.languages || []).map((l) => l.id));
  const domains = new Set((rules?.domains || []).map((d) => d.id));
  const out = { languages: [], domains: [], gat: false };
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = toDuSubjectId(raw);
    if (id === 'gat') out.gat = true;
    else if (languages.has(id) && !out.languages.includes(id)) out.languages.push(id);
    else if (domains.has(id) && !out.domains.includes(id)) out.domains.push(id);
  }
  return out;
}

/** The name a student knows a DU subject by: "Accountancy", "Mathematics", "Computer Science". */
export function subjectWord(id, rules) {
  if (id === 'gat') return 'the General Test';
  const entry = [...(rules?.domains || []), ...(rules?.languages || [])].find((x) => x.id === id);
  return entry?.aliases?.[0] || entry?.name || String(id).replace(/_/g, ' ');
}

// One way in, as words: "a language, plus Mathematics and any two other subjects".
function wayWords(combination, requiresLanguage, rules) {
  const lead = [];
  const rest = [];
  let named = false;
  for (const slot of combination.slots || []) if (slot.type === 'domain') named = true;
  let hasLanguage = false;
  for (const slot of combination.slots || []) {
    if (slot.type === 'lang') {
      hasLanguage = true;
      const specific = (slot.specific || []).map((id) => subjectWord(id, rules));
      const any = slot.any || 0;
      if (specific.length) lead.push(any ? `${joinWords(specific)} and ${any === 1 ? 'one more language' : `${count(any)} more languages`}` : joinWords(specific));
      else lead.push(any === 1 ? 'a language' : `${count(any)} languages`);
    } else if (slot.type === 'domain') rest.push(subjectWord(slot.subject, rules));
    else if (slot.type === 'free') rest.push(slot.count === 1 ? `one ${named ? 'other ' : ''}subject` : `any ${count(slot.count)} ${named ? 'other ' : ''}subjects`);
    else if (slot.type === 'gat') rest.push('the General Test');
  }
  if (!hasLanguage && requiresLanguage) lead.push('a language');
  return { lead: lead.join(' and '), rest: joinWords(rest) };
}

// A course named "B.Com." already ends in a full stop: one full stop closes the sentence, never two.
const sentence = (text) => (text.endsWith('.') ? text : `${text}.`);
const sameLead = (a, b) => a.lead === b.lead && a.lead !== '';

/**
 * The course's subject rule as one sentence, or null when the course has no combinations on file.
 * "B.Com. (Hons.) needs a language, plus either Mathematics and any two other subjects, or Accountancy and any two other subjects."
 */
export function courseRuleSentence(group, rules) {
  const combos = group?.eligibility?.combinations || [];
  if (!group || !combos.length) return null;
  const requiresLanguage = Boolean(group.eligibility.requiresLanguage);
  const ways = combos.map((c) => wayWords(c, requiresLanguage, rules));
  const text = (w, withLead = true) => (withLead && w.lead ? (w.rest ? `${w.lead}, plus ${w.rest}` : w.lead) : (w.rest || w.lead));
  if (ways.length === 1) return sentence(`${group.name} needs ${text(ways[0])}`);
  const more = ways.length - 2;
  const tail = more === 1 ? ', or one other combination' : more > 1 ? `, or one of ${count(more)} other combinations` : '';
  if (sameLead(ways[0], ways[1]) && ways[0].rest && ways[1].rest) {
    return sentence(`${group.name} needs ${ways[0].lead}, plus either ${ways[0].rest}, or ${ways[1].rest}${tail}`);
  }
  return sentence(`${group.name} needs either ${text(ways[0])}, or ${text(ways[1])}${tail}`);
}

/** The DU subject ids that every combination of the course names (so a student must have them whatever way they go). */
export function neededByEvery(group) {
  const combos = group?.eligibility?.combinations || [];
  if (!combos.length) return [];
  const sets = combos.map((c) => new Set((c.slots || []).filter((s) => s.type === 'domain').map((s) => s.subject)));
  return [...sets[0]].filter((id) => sets.every((s) => s.has(id)));
}

function gapWords(gap, rules) {
  if (gap.kind === 'language') return subjectWord(gap.id, rules);
  if (gap.kind === 'any-language') return gap.count === 1 ? 'a language' : `${count(gap.count)} languages`;
  if (gap.kind === 'domain') return subjectWord(gap.id, rules);
  if (gap.kind === 'any-domain') return gap.count === 1 ? 'one more subject' : `${count(gap.count)} more subjects`;
  return 'the General Test';
}

/**
 * Whether the picks fit the course, as a line the subjects step shows under the rule. Null before any pick.
 * { fits: true,  line: "Your picks fit B.Com. (Hons.)." }
 * { fits: false, line: "To fit B.Com. (Hons.), add Accountancy and one more subject." }
 */
export function courseFit(group, ids, rules) {
  if (!group) return null;
  const selection = selectionFromSubjects(ids, rules);
  if (selection.languages.length + selection.domains.length === 0 && !selection.gat) return null;
  const result = evaluateGroup(group, selection);
  if (result.eligible) return { fits: true, line: sentence(`Your picks fit ${group.name}`) };
  const gaps = result.nearest?.gaps || [];
  if (!gaps.length) return { fits: false, line: sentence(`Your picks do not fit ${group.name} yet`) };
  return { fits: false, line: sentence(`To fit ${group.name}, add ${joinWords(gaps.map((g) => gapWords(g, rules)))}`) };
}
