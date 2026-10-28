import { presentationLint } from '../../../data/question_presentation.mjs';

const LETTER = /^[A-D]$/;

function parseSetExpression(value) {
  const text = String(value ?? '').trim();
  const display = text.match(/^(Statements?) ([A-D](?: and [A-D])*) only$/);
  if (display) {
    const letters = display[2].split(' and ');
    if ((letters.length === 1) !== (display[1] === 'Statement') || new Set(letters).size !== letters.length) return null;
    return letters;
  }
  const match = text.match(/^(\([A-D]\))(?:\s+and\s+(\([A-D]\)))*\s+only$/);
  if (!match) return null;
  const letters = [...text.matchAll(/\(([A-D])\)/g)].map(m => m[1]);
  if (!letters.length || new Set(letters).size !== letters.length) return null;
  return letters;
}

/** Parse only the complete, narrow statement-set forms used by CUET selection items. */
export function parseStatementSelectionOption(value, optionIndex) {
  const text = String(value ?? '').trim();
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) return null;

  // A duplicated outer choice label is recognized only when it matches this
  // option's position and the entire remainder parses as a statement set.
  const outer = text.match(/^\(([A-D])\)\s+(.+)$/);
  if (outer && outer[1] === 'ABCD'[optionIndex]) {
    const inner = parseSetExpression(outer[2]);
    if (inner) return { letters: inner, hadOuterChoiceLabel: true };
  }

  const letters = parseSetExpression(text);
  return letters ? { letters, hadOuterChoiceLabel: false } : null;
}

function displayForSet(letters) {
  return `${letters.length === 1 ? 'Statement' : 'Statements'} ${letters.join(' and ')} only`;
}

/**
 * Repair only the exact statement-selection/presentation-lint collision.
 * Returns a new candidate only after strict before/after semantic round-trip.
 */
export function normalizeStatementSelectionOptions(candidate) {
  if (!candidate || candidate.question_type !== 'statement_selection') {
    return { candidate, changed: false, reason: 'not_statement_selection' };
  }
  if (!Array.isArray(candidate.options) || candidate.options.length !== 4) {
    return { candidate, changed: false, reason: 'options_not_four' };
  }
  if (!LETTER.test(String(candidate.correct_answer ?? ''))) {
    return { candidate, changed: false, reason: 'answer_key_invalid' };
  }
  if (!presentationLint(candidate).includes('option_label_prefix')) {
    return { candidate, changed: false, reason: 'no_targeted_prefix_defect' };
  }
  const before = candidate.options.map((option, index) => parseStatementSelectionOption(option, index));
  if (before.some(value => !value)) {
    return { candidate, changed: false, reason: 'statement_set_parse_failed' };
  }
  const options = before.map(({ letters }) => displayForSet(letters));
  const after = options.map((option, index) => parseStatementSelectionOption(option, index));
  if (after.some(value => !value) || before.some((value, index) => value.letters.join('|') !== after[index].letters.join('|'))) {
    return { candidate, changed: false, reason: 'statement_set_roundtrip_failed' };
  }
  if (new Set(options.map(value => value.toLocaleLowerCase('en'))).size !== 4) {
    return { candidate, changed: false, reason: 'normalized_option_collision' };
  }
  if (options.every((option, index) => option === candidate.options[index])) {
    return { candidate, changed: false, reason: 'already_canonical' };
  }

  return { candidate: { ...candidate, options }, changed: true, reason: 'statement_set_display_normalized' };
}

/**
 * A repair may not change route or passage content. Creating/changing passage
 * topology requires a passage-group rebuild with its registered source text.
 */
export function guardRepairRoute(original, proposed, { passageGroupId = null } = {}) {
  if (!original || !proposed || !original.route || !proposed.route) {
    return { allowed: false, reason: 'repair_route_missing' };
  }
  if (original.route !== proposed.route) {
    return { allowed: false, reason: 'repair_route_change_requires_rebuild' };
  }

  const originalPassage = String(original.passage_text ?? '').trim();
  const proposedPassage = String(proposed.passage_text ?? '').trim();
  if (original.route === 'passage') {
    if (!passageGroupId && !originalPassage) {
      return { allowed: false, reason: 'orphan_passage_route_without_source_passage' };
    }
    if (originalPassage !== proposedPassage) {
      return { allowed: false, reason: 'repair_passage_text_change_requires_rebuild' };
    }
  }
  return { allowed: true, reason: null };
}
