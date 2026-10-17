import { computeContentHash } from './hash.js'

// POST /api/questions/upload must not be an answer oracle for live questions (security review 17 Oct 2026).
//
// The stored content_hash is sha256(body || correct_answer). Looking up only the submitted pair let a signed-in student
// submit a live question's body with each option key in turn: the one guess that matched was the answer key.
//
// Now the duplicate check never depends on which key the uploader marked correct:
//   - option keys must come from a fixed set (A-F or 0-6, any case; the hash lowercases), and the answer must be one of
//     the submitted keys, so the submitted pair is always one of the candidates;
//   - the lookup asks for every candidate hash of the body at once, so a body that already exists with any of those
//     keys is a duplicate whichever key the uploader chose, and a body that does not exist is new whichever key;
//   - the route answers both cases with the same status and body, and stores nothing for a duplicate.
export const UPLOAD_ANSWER_KEYS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', '0', '1', '2', '3', '4', '5', '6'])
const KEY_SET = new Set(UPLOAD_ANSWER_KEYS)

const keyOf = (value) => String(value ?? '').trim().toUpperCase()

/** null when the options and the answer have the shape the oracle-free dedupe needs; otherwise a violation. */
export function uploadShapeViolation(options, correctAnswer) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
    return { rule: 'invalid_options_count', severity: 'hard', message: 'options must be an array of 2–6 items.' }
  }
  const keys = options.map((option) => keyOf(option?.key))
  if (keys.some((key) => !KEY_SET.has(key)) || new Set(keys).size !== keys.length) {
    return { rule: 'invalid_option_keys', severity: 'hard', message: 'option keys must be distinct letters A–F (or numbers 0–6).' }
  }
  if (!keys.includes(keyOf(correctAnswer))) {
    return { rule: 'answer_not_in_options', severity: 'hard', message: 'correct_answer must match one of the option keys.' }
  }
  return null
}

/** Every content hash the body could already be stored under, one per allowed answer key. */
export function candidateContentHashes(body) {
  return [...new Set(UPLOAD_ANSWER_KEYS.map((key) => computeContentHash(String(body ?? ''), key)))]
}

/** The one reply for an accepted upload, whether it was new or a silent duplicate. */
export function uploadAccepted(ruleViolations = []) {
  return {
    status: 'pending_moderation',
    rule_violations: (ruleViolations || []).filter((violation) => violation?.severity === 'soft'),
  }
}

export const UPLOAD_ACCEPTED_STATUS = 202
