// Pure helpers for scripts/question-reorder.mjs: how to rewrite a sequence or match question whose
// correct option is the order the stem lists its items in ((A)-(B)-(C)-(D), or (A)-(I), (B)-(II), ...),
// so the key stops giving the answer away. No database, no network, no model: a row in, a plan out.
//
// Why not just shuffle option order: the NTA engine already serves every question with the options in a
// per-student order (ntaServedRow). The tell is the CONTENT of the key option, not its position, so the fix
// is to reprint the stem's items in another order and remap every option to the new labels. The same
// facts stay true: item X still belongs to match Y, and the steps are still in the same logical order.
//
//   sequence ("Arrange ..."): the printed items are re-ordered and re-labelled A, B, C, ... (or I, II, ...,
//     or 1, 2, ...) in print order; every option's label list is mapped old label -> new label.
//   match: List-I stays as printed; the List-II entries are re-ordered and re-labelled in order; the
//     right-hand label of every pair in every option is mapped old -> new.
//
// A row that cannot be rewritten with certainty is not touched: the plan says "hold" with the reasons, and
// the dry run lists those ids in a file that scripts/question-hold.mjs accepts as --list.
import { getQuestionText } from '../../data/nta_question_selector.js';
import { classifyNtaType, getNtaBlueprint } from '../../data/nta_engine.js';
import { keyIndexOf, listedOrderKeyReasons, optionLabelList, optionPairs, structuralReasons } from '../../data/nta_item_checks.js';
import { plainOptionTexts } from '../../data/option_text.js';

export const REORDER_VERSION = 1;
const LABEL = String.raw`(?:VI|IV|V|I{1,3}|vi|iv|v|i{1,3}|[A-F]|[P-T]|[1-6])`;
const RIGHT_LABEL = String.raw`(?:VI|IV|V|I{1,3}|[1-6]|[P-T])`;
const ROMAN_RANK = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const STEM_FIELDS = ['question', 'body'];
const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

export function labelRank(label) {
  const value = text(label);
  if (ROMAN_RANK[value]) return ROMAN_RANK[value];
  if (/^[A-F]$/.test(value)) return value.charCodeAt(0) - 64;
  if (/^[P-T]$/.test(value)) return value.charCodeAt(0) - 79;
  if (/^[1-6]$/.test(value)) return Number(value);
  return null;
}

const hold = (reasons, extra = {}) => ({ outcome: 'hold', reasons: [].concat(reasons), ...extra });

// ---------------------------------------------------------------------------------------------
// Seeded choice: the same (seed, id) always picks the same permutation, so a dry run and the apply agree.
// ---------------------------------------------------------------------------------------------

function seededRandom(seed) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 16777619); }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutations(n) {
  const out = [];
  const walk = (prefix, rest) => {
    if (!rest.length) { out.push(prefix); return; }
    rest.forEach((value, i) => walk([...prefix, value], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  walk([], Array.from({ length: n }, (_, i) => i));
  return out;
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------------------------
// Stem parsing: the printed items of one list
// ---------------------------------------------------------------------------------------------

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BOUNDARY = /\b(?:Choose|Select|Which of|Pick|Identify the correct)\b/;

function markerPattern(label, style) {
  const L = escapeRe(label);
  if (style === 'paren') return new RegExp(String.raw`\(\s*${L}\s*\)`, 'g');
  if (style === 'dotted') return new RegExp(String.raw`^[ \t]*${L}[.)](?=[ \t])`, 'gm');
  return new RegExp(String.raw`(?<=(?:^|[,;:\n])[ \t]*)${L}(?=[ \t])`, 'g');
}

/**
 * The items of one list in `stem`, in printed order: [{ label, markerText, markerStart, markerEnd, gap, body, sep }].
 * `labels` is the canonical label sequence ("A".."D"). `region` limits the search. `canonicalOrder` demands
 * that the items are printed in label order (match lists); sequence lists may be printed in any order.
 * Returns null when the list cannot be found with one marker per label.
 */
export function parseItems(stem, labels, { region = [0, stem.length], canonicalOrder = false, styles = ['paren', 'dotted', 'bare'], multiline = null } = {}) {
  const [from, to] = region;
  const slice = stem.slice(from, to);
  for (const style of styles) {
    const found = [];
    let ok = true;
    let cursor = 0;
    for (const label of labels) {
      const hits = [...slice.matchAll(markerPattern(label, style))].filter((hit) => hit.index >= cursor || !canonicalOrder);
      if (style === 'bare') {
        // The first marker at or after the cursor; a bare "2" inside an entry is not a marker unless a separator precedes it.
        const hit = hits.find((candidate) => candidate.index >= cursor);
        if (!hit) { ok = false; break; }
        found.push({ label, index: hit.index, length: hit[0].length, markerText: hit[0] });
        cursor = hit.index + hit[0].length;
      } else {
        if (hits.length !== 1) { ok = false; break; }
        found.push({ label, index: hits[0].index, length: hits[0][0].length, markerText: hits[0][0] });
        if (canonicalOrder) cursor = hits[0].index + hits[0][0].length;
      }
    }
    if (!ok) continue;
    const printed = [...found].sort((a, b) => a.index - b.index);
    if (canonicalOrder && printed.some((entry, i) => entry.label !== labels[i])) continue;
    // Bare markers must start the list: nothing but the heading before the first one.
    const items = printed.map((entry, i) => {
      const markerStart = from + entry.index;
      const markerEnd = markerStart + entry.length;
      let end;
      if (i + 1 < printed.length) end = from + printed[i + 1].index;
      else if (multiline === false) {
        const boundary = stem.slice(markerEnd, to).search(BOUNDARY);
        end = boundary >= 0 ? markerEnd + boundary : to;
      } else {
        const newline = stem.slice(markerEnd, to).indexOf('\n');
        if (newline >= 0) end = markerEnd + newline;
        else {
          const boundary = stem.slice(markerEnd, to).search(BOUNDARY);
          end = boundary >= 0 ? markerEnd + boundary : to;
        }
      }
      const raw = stem.slice(markerEnd, end);
      const gap = raw.match(/^[ \t]*/)[0];
      const rest = raw.slice(gap.length);
      const sep = rest.match(/[\s,;]*$/)[0];
      return { label: entry.label, markerText: entry.markerText, markerStart, markerEnd, gap, body: rest.slice(0, rest.length - sep.length), sep, end };
    });
    if (items.some((item) => !item.body)) continue;
    return { style, items };
  }
  return null;
}

/** Re-print a parsed list with its entries in a new order and the canonical labels in print order. */
export function rebuildList(stem, parsed, order, labels) {
  const { items } = parsed;
  const lastEnd = items[items.length - 1].end;
  const periodOnLast = /\.$/.test(items[items.length - 1].body) && !items.every((item) => /\.$/.test(item.body));
  const bodies = items.map((item, i) => (periodOnLast && i === items.length - 1 ? item.body.slice(0, -1) : item.body));
  let out = '';
  items.forEach((slot, j) => {
    const body = bodies[order[j]] + (periodOnLast && j === items.length - 1 ? '.' : '');
    const marker = slot.markerText.replace(slot.label, labels[j]);
    out += marker + slot.gap + body + slot.sep;
  });
  return stem.slice(0, items[0].markerStart) + out + stem.slice(lastEnd);
}

// ---------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------

function optionRaw(option) {
  if (typeof option === 'string') return option;
  const value = option?.text ?? option?.label ?? option?.value;
  return value === undefined || value === null ? '' : String(value);
}

function withOptionText(option, value) {
  if (typeof option === 'string') return value;
  const field = ['text', 'label', 'value'].find((name) => option?.[name] !== undefined && option?.[name] !== null) || 'text';
  return { ...option, [field]: value };
}

/** Prefix lengths of the stored self-letter ("A ", "B. ") of every option, so only the body is rewritten. */
function optionPrefixLengths(rawTexts) {
  const plain = plainOptionTexts(rawTexts);
  return rawTexts.map((raw, i) => (plain[i] !== raw && raw.endsWith(plain[i]) ? raw.length - plain[i].length : 0));
}

const SEQUENCE_TOKEN = new RegExp(String.raw`\(?\b(${LABEL})\b\)?`, 'g');
const PAIR = new RegExp(String.raw`(\(?\b[A-F]\b\)?\s*[-–:→]\s*\(?\b)(${RIGHT_LABEL})(\b\)?)`, 'g');

function mapSequenceOption(value, map) {
  return value.replace(SEQUENCE_TOKEN, (whole, label) => whole.replace(label, map[label] ?? label));
}

function mapPairOption(value, map) {
  return value.replace(PAIR, (_, before, label, after) => `${before}${map[label] ?? label}${after}`);
}

// ---------------------------------------------------------------------------------------------
// Explanation: remap the labels it names; flag what cannot be remapped with certainty
// ---------------------------------------------------------------------------------------------

const NAMED_LABEL = (labelAlternation) => new RegExp(String.raw`\b(?:step|stage|item|statement|event|part|point|entry|entries|list[- ]?(?:ii|2))s?\s+\(?(${labelAlternation})\)?(?![\w'’])`, 'i');

export function remapExplanation(explanation, map, kind) {
  const value = explanation === null || explanation === undefined ? '' : String(explanation);
  if (!value) return { text: explanation, changed: false, flags: [] };
  const labels = Object.keys(map);
  const alternation = labels.map(escapeRe).join('|');
  const digits = labels.every((label) => /^[1-6]$/.test(label));
  const flags = [];
  // Every pass writes markers (NUL ... SOH); the markers become labels at the end, so no reference is rewritten twice.
  const mark = (label) => `\u0000${map[label]}\u0001`;
  const markAll = (chain) => chain.replace(new RegExp(String.raw`\b(${alternation})\b`, 'g'), (label) => mark(label));
  let next = value;
  if (kind === 'match') next = next.replace(PAIR, (whole, before, label, after) => (map[label] ? `${before}${mark(label)}${after}` : whole));
  next = next.replace(new RegExp(String.raw`\(\s*(${alternation})\s*\)`, 'g'), (whole, label) => whole.replace(label, mark(label)));
  // Chains written without brackets: "I → III → II", "2-1-3-4", "I, II, III, IV". A bare pair of figures ("3-4") is not a chain.
  const joiner = String.raw`\s*(?:→|->|-|–|—)\s*`;
  const before = String.raw`(?<![\w(\u0000])`;
  const after = String.raw`(?![\w)\u0001])`;
  const chain = new RegExp(`${before}((?:${alternation})(?:${joiner}(?:${alternation}))${digits ? '{2,}' : '+'})${after}`, 'g');
  next = next.replace(chain, markAll);
  const listed = new RegExp(`${before}((?:${alternation})(?:,\\s*(?:and\\s+)?(?:${alternation})){2,})${after}`, 'g');
  if (digits) { if (listed.test(next)) flags.push('explanation_has_number_list'); } else next = next.replace(listed, markAll);
  if (digits && new RegExp(`${before}(?:${alternation})${joiner}(?:${alternation})${after}`).test(next)) flags.push('explanation_has_number_pair');
  next = next.replace(/\u0000([^\u0001]*)\u0001/g, '$1');
  if (NAMED_LABEL(alternation).test(value)) flags.push('explanation_names_label_in_words');
  return { text: next, changed: next !== value, flags };
}

// ---------------------------------------------------------------------------------------------
// The plan for one row
// ---------------------------------------------------------------------------------------------

// The column the engine reads the stem from (getQuestionText takes the first of question, body, q, prompt, stem).
export function stemFieldOf(row) {
  const field = ['question', 'body', 'q', 'prompt', 'stem'].find((name) => typeof row?.[name] === 'string' && text(row[name]));
  return STEM_FIELDS.includes(field) ? field : null;
}

function canonicalLabels(labels) {
  const unique = [...new Set(labels)];
  const ranked = unique.map((label) => [label, labelRank(label)]);
  if (ranked.some(([, rank]) => rank === null)) return null;
  ranked.sort((a, b) => a[1] - b[1]);
  if (ranked.some(([, rank], i) => rank !== i + 1)) return null;
  const kinds = new Set(ranked.map(([label]) => (/^[A-F]$/.test(label) ? 'upper' : /^[P-T]$/.test(label) ? 'pt' : /^[1-6]$/.test(label) ? 'digit' : /^[ivx]+$/.test(label) ? 'lower-roman' : 'roman')));
  return kinds.size === 1 ? ranked.map(([label]) => label) : null;
}

function typeOf(row, explicitType) {
  if (explicitType) return explicitType;
  const blueprint = getNtaBlueprint(row?.subject);
  return classifyNtaType(row, row?.subject, blueprint ? Object.keys(blueprint.typeQuotas) : undefined);
}

/**
 * The plan for one row.
 *   { outcome: 'skip', reasons }  the row is not a listed-order key (nothing to do)
 *   { outcome: 'hold', reasons }  a listed-order key this module will not rewrite; hold it instead
 *   { outcome: 'reorder', kind, stemField, order, labelMap, before, after, explanationChanged, checks }
 * `before` and `after` carry { stem, options, explanation } exactly as stored (options keep their stored shape).
 */
export function planListedOrderFix(row, { seed = 'listed-order-2026-10-14', type: explicitType } = {}) {
  const type = typeOf(row, explicitType);
  const gateBefore = listedOrderKeyReasons(row, type);
  if (!gateBefore.length) return { id: row?.id, outcome: 'skip', reasons: ['not_a_listed_order_key'] };
  const base = { id: row.id, subject: row.subject, chapter: row.chapter, type, gateBefore };
  const stemField = stemFieldOf(row);
  if (!stemField) return { ...base, ...hold('stem_field_unresolved') };
  if (!Array.isArray(row.options) || row.options.length < 3) return { ...base, ...hold('options_not_a_list') };
  const keyIndex = keyIndexOf(row);
  if (keyIndex < 0) return { ...base, ...hold('key_unresolved') };
  const isSequence = gateBefore.includes('sequence_key_is_listed_order');
  const isMatch = gateBefore.includes('match_key_is_listed_order');
  if (isSequence === isMatch) return { ...base, ...hold('kind_ambiguous') };
  const kind = isSequence ? 'sequence' : 'match';

  const stem = String(row[stemField]);
  const rawTexts = row.options.map(optionRaw);
  const prefix = optionPrefixLengths(rawTexts);
  const plain = rawTexts.map((raw, i) => raw.slice(prefix[i]));
  const lists = plain.map((value) => (kind === 'sequence' ? optionLabelList(value) : optionPairs(value)));
  if (lists.some((entry) => !entry)) return { ...base, ...hold(kind === 'sequence' ? 'sequence_options_not_label_lists' : 'match_options_not_pairs') };

  // The labels being permuted, and where the list sits in the stem.
  let labels;
  let parsed;
  let regionEnd = null;
  if (kind === 'sequence') {
    labels = canonicalLabels(lists[0]);
    if (!labels || lists.some((entry) => entry.length !== labels.length || [...entry].sort().join() !== [...labels].sort().join())) return { ...base, ...hold('sequence_labels_not_one_set') };
    parsed = parseItems(stem, labels, { styles: ['paren', 'dotted'] });
  } else {
    labels = canonicalLabels(lists[0].map(([, right]) => right));
    const lefts = lists[0].map(([left]) => left);
    if (!labels || lists.some((entry) => entry.length !== labels.length || [...entry.map(([, r]) => r)].sort().join() !== [...labels].sort().join() || entry.map(([l]) => l).join() !== lefts.join())) return { ...base, ...hold('match_pairs_not_one_shape') };
    const heading = /list[\s-]*(?:ii|2)\b/gi;
    const headings = [...stem.matchAll(heading)].reverse();
    for (const hit of headings) {
      const start = hit.index + hit[0].length;
      const stop = stem.slice(start).search(BOUNDARY);
      regionEnd = stop >= 0 ? start + stop : stem.length;
      parsed = parseItems(stem, labels, { region: [start, regionEnd], canonicalOrder: true, multiline: false });
      if (parsed) break;
    }
  }
  if (!parsed) return { ...base, ...hold(kind === 'sequence' ? 'stem_items_not_found' : 'list_two_not_found') };
  if (parsed.items.length !== labels.length) return { ...base, ...hold('stem_items_count_differs') };
  // Options printed a second time inside the stem (an "A. (A)-(III), ..." block) would be left stale by the rewrite.
  const outsideList = stem.slice(0, parsed.items[0].markerStart) + stem.slice(parsed.items[parsed.items.length - 1].end);
  if (plain.some((value) => text(value).length >= 5 && outsideList.includes(text(value)))) return { ...base, ...hold('options_printed_in_stem') };

  // Candidate permutations: every option must stop being the listed order, and the key must not keep most of its places.
  const printed = parsed.items.map((item) => item.label);
  const keyList = kind === 'sequence' ? lists[keyIndex] : lists[keyIndex].map(([, right]) => right);
  const isListed = (entry) => (kind === 'sequence'
    ? entry.every((label, i) => label === labels[i])
    : entry.every(([left, right]) => labelRank(left) === labelRank(right)));
  const random = seededRandom(`${seed}:${row.id}`);
  const candidates = shuffled(permutations(labels.length), random);
  const evaluate = (order, maxFixed) => {
    const map = {};
    order.forEach((oldIndex, j) => { map[printed[oldIndex]] = labels[j]; });
    const mapped = lists.map((entry) => (kind === 'sequence' ? entry.map((label) => map[label]) : entry.map(([left, right]) => [left, map[right]])));
    if (mapped.some(isListed)) return null;
    // The key's right-hand sequence: the labels in the order the option lists them (sequence), or the right label of each left label (match).
    const keyOrder = kind === 'sequence' ? mapped[keyIndex] : mapped[keyIndex].map(([, right]) => right);
    const keyLeft = kind === 'sequence' ? labels : mapped[keyIndex].map(([left]) => left);
    const fixed = keyOrder.filter((label, i) => labelRank(label) === labelRank(keyLeft[i])).length;
    // Straight reversal is as much a tell as the listed order.
    if (keyOrder.every((label, i) => labelRank(label) === labels.length + 1 - labelRank(keyLeft[i]))) return null;
    if (fixed > maxFixed) return null;
    return { map, mapped };
  };
  // Match lists keep List-I in print order, so printed labels are canonical there and order[j] indexes both.
  let chosen = null;
  for (const maxFixed of [Math.max(0, Math.floor((labels.length - 1) / 2)), Math.floor(labels.length / 2), labels.length - 2]) {
    for (const order of candidates) {
      const result = evaluate(order, maxFixed);
      if (result) { chosen = { order, ...result }; break; }
    }
    if (chosen) break;
  }
  if (!chosen) return { ...base, ...hold('no_permutation_clears_every_option') };

  const newStem = rebuildList(stem, parsed, chosen.order, labels);
  const options = row.options.map((option, i) => {
    const body = kind === 'sequence' ? mapSequenceOption(plain[i], chosen.map) : mapPairOption(plain[i], chosen.map);
    return withOptionText(option, rawTexts[i].slice(0, prefix[i]) + body);
  });
  const explanation = remapExplanation(row.explanation, chosen.map, kind);
  if (explanation.flags.length) return { ...base, ...hold(explanation.flags) };

  const afterRow = { ...row, [stemField]: newStem, options, explanation: explanation.text };
  const checks = { gateAfter: listedOrderKeyReasons(afterRow, type), structuralBefore: structuralReasons(row, type), structuralAfter: structuralReasons(afterRow, type) };
  const problems = [];
  if (checks.gateAfter.length) problems.push('still_listed_order_after_rewrite');
  if (checks.structuralAfter.some((reason) => !checks.structuralBefore.includes(reason))) problems.push('rewrite_breaks_structure');
  if (keyIndexOf(afterRow) !== keyIndex) problems.push('key_position_moved');
  // Round trip: the new stem holds the same entries, each under the label the options now use.
  const tail = stem.length - (kind === 'sequence' ? parsed.items[parsed.items.length - 1].end : regionEnd);
  const again = parseItems(newStem, labels, kind === 'sequence' ? { styles: ['paren', 'dotted'] } : { region: [parsed.items[0].markerStart, newStem.length - tail], canonicalOrder: true, multiline: false });
  const strip = (value) => value.replace(/\.$/, '');
  if (!again || again.items.some((item) => {
    const old = parsed.items.find((entry) => chosen.map[entry.label] === item.label);
    return !old || strip(old.body) !== strip(item.body);
  })) problems.push('round_trip_differs');
  // The key must still say the same thing: read through the old stem and through the new one, the key names the same entries.
  if (again) {
    const plainAfter = options.map((option, i) => optionRaw(option).slice(prefix[i]));
    const newKey = kind === 'sequence' ? optionLabelList(plainAfter[keyIndex]) : optionPairs(plainAfter[keyIndex]);
    const bodyIn = (items, label) => strip(items.find((item) => item.label === label)?.body ?? '');
    const meaning = (items, entry) => (kind === 'sequence' ? entry.map((label) => bodyIn(items, label)) : entry.map(([left, right]) => [left, bodyIn(items, right)]));
    if (!newKey || JSON.stringify(meaning(parsed.items, lists[keyIndex])) !== JSON.stringify(meaning(again.items, newKey))) problems.push('key_meaning_changed');
  }
  if (problems.length) return { ...base, ...hold(problems) };

  return {
    ...base, outcome: 'reorder', reasons: [], kind, stemField, order: chosen.order, labelMap: chosen.map,
    before: { stem, options: row.options, explanation: row.explanation ?? null },
    after: { stem: newStem, options, explanation: explanation.text ?? null },
    explanationChanged: explanation.changed, keyBefore: keyList, checks,
  };
}

/** The row as it reads after the plan's rewrite (used to double-check a plan against the gates). */
export function rowAfterPlan(row, plan) {
  if (plan.outcome !== 'reorder') return row;
  return { ...row, [plan.stemField]: plan.after.stem, options: plan.after.options, explanation: plan.after.explanation };
}

/** The columns an apply writes for one planned row. */
export function updateFor(plan) {
  return { [plan.stemField]: plan.after.stem, options: plan.after.options, explanation: plan.after.explanation };
}

/** One restore entry: the original values, plus what the apply wrote so a restore can refuse to overwrite a later edit. */
export function restoreEntry(row, plan) {
  return {
    id: row.id, subject: row.subject, chapter: row.chapter, status: row.status, stemField: plan.stemField,
    original: { [plan.stemField]: plan.before.stem, options: plan.before.options, explanation: plan.before.explanation },
    written: { [plan.stemField]: plan.after.stem, options: plan.after.options, explanation: plan.after.explanation },
  };
}

/** True when the row still holds exactly what the apply wrote (so restoring it cannot clobber a later edit). */
export function rowStillAsWritten(row, entry) {
  return Object.entries(entry.written).every(([field, value]) => JSON.stringify(row?.[field] ?? null) === JSON.stringify(value ?? null));
}
