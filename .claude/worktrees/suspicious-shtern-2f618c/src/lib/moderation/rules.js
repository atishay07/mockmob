// Rule-based validation that runs synchronously before the LLM call.
// Returns { violations: [{rule, severity, message}] }
// severity: "hard" → REJECT immediately; "soft" → penalise score

const HARD_MIN_BODY_LEN = 10
const SOFT_MIN_BODY_LEN = 30
const HARD_MAX_BODY_LEN = 4000
const HARD_MIN_ANSWER_LEN = 1
const SOFT_MIN_EXPLANATION_LEN = 20

// Very basic profanity list — extend via env/DB in production
const BLOCKED_TERMS = (process.env.BLOCKED_TERMS ?? '')
  .split(',')
  .map(t => t.trim().toLowerCase())
  .filter(Boolean)

export function runRuleChecks(question) {
  const violations = []
  const { body, correct_answer, explanation, options, subject, chapter } = question

  // ---- Schema completeness ----
  if (!body || body.trim().length < HARD_MIN_BODY_LEN) {
    violations.push({ rule: 'body_too_short', severity: 'hard', message: 'Question body is too short.' })
  } else if (body.trim().length < SOFT_MIN_BODY_LEN) {
    violations.push({ rule: 'body_short', severity: 'soft', message: 'Question body is unusually short.' })
  }

  if (body && body.trim().length > HARD_MAX_BODY_LEN) {
    violations.push({ rule: 'body_too_long', severity: 'hard', message: 'Question body exceeds maximum length.' })
  }

  if (!correct_answer || correct_answer.trim().length < HARD_MIN_ANSWER_LEN) {
    violations.push({ rule: 'missing_answer', severity: 'hard', message: 'correct_answer is required.' })
  }

  if (!subject || subject.trim().length === 0) {
    violations.push({ rule: 'missing_subject', severity: 'hard', message: 'subject is required.' })
  }

  if (!chapter || chapter.trim().length === 0) {
    violations.push({ rule: 'missing_chapter', severity: 'hard', message: 'chapter is required.' })
  }

  // ---- MCQ option validation ----
  if (options !== null && options !== undefined) {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      violations.push({ rule: 'invalid_options_count', severity: 'hard', message: 'options must be an array of 2–6 items.' })
    } else {
      const keys = options.map(o => o?.key)
      if (keys.some(k => typeof k !== 'string' || k.trim() === '')) {
        violations.push({ rule: 'invalid_option_key', severity: 'hard', message: 'Each option must have a non-empty string key.' })
      }
      if (!keys.includes(correct_answer)) {
        violations.push({ rule: 'answer_not_in_options', severity: 'hard', message: 'correct_answer must match one of the option keys.' })
      }
    }
  }

  // ---- Content quality ----
  if (!explanation || explanation.trim().length < SOFT_MIN_EXPLANATION_LEN) {
    violations.push({ rule: 'weak_explanation', severity: 'soft', message: 'Explanation is missing or very short.' })
  }

  // ---- Policy: blocked terms ----
  const fullText = [body, explanation ?? '', correct_answer].join(' ').toLowerCase()
  const matchedTerm = BLOCKED_TERMS.find(t => fullText.includes(t))
  if (matchedTerm) {
    violations.push({ rule: 'blocked_content', severity: 'hard', message: 'Content contains blocked terms.' })
  }

  return { violations }
}
