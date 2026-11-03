// FIX 6 (Critical): enforce a hard timeout on the LLM call so a
// hanging request never leaves a job stuck in 'processing' forever.
// The AbortController aborts the in-flight HTTP request; the error
// propagates to the worker, which then writes a retry record.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a strict question quality evaluator for a competitive exam preparation platform (MockMob).

Your job is to evaluate uploaded practice questions and return a structured JSON assessment.

Scoring rules:
- clarity_score: Is the question unambiguous and well-written? (0-1)
- syllabus_relevance_score: Does it fit the stated subject/chapter? (0-1)
- answerability_score: Can it be answered with reasonable knowledge? (0-1)
- explanation_quality_score: Is the explanation correct, complete, and educational? (0-1)
- duplicate_risk_score: How likely is this a reformulation of a common question? (0-1, higher = more duplicate-like)
- difficulty_confidence: How confident are you in the stated difficulty? (0-1)

Tiering rules (apply strictly):
- "REJECT": offensive content, completely nonsensical, unanswerable, or obvious duplicate
- "C": plausible topic but low-quality — vague wording, no explanation, marginal relevance, or uncertainty
- "B": solid question — clear, correct, useful explanation
- "A": high quality — precise, well-explained, clearly on-syllabus, low duplicate risk, difficulty well-calibrated

Respond ONLY with a valid JSON object matching this exact shape:
{
  "tier": "A" | "B" | "C" | "REJECT",
  "ai_score": <float 0-1>,
  "clarity_score": <float 0-1>,
  "syllabus_relevance_score": <float 0-1>,
  "answerability_score": <float 0-1>,
  "explanation_quality_score": <float 0-1>,
  "duplicate_risk_score": <float 0-1>,
  "difficulty_confidence": <float 0-1>,
  "recommended_difficulty": "easy" | "medium" | "hard",
  "reason_codes": [<string>, ...]
}

reason_codes are short lowercase_snake_case labels explaining the tier, e.g. ["clear_question","weak_explanation","possible_textbook_duplicate"]`

// Fixed mock parsed object — field names match what process/route.js and
// tiering.js read (flat, not nested). Values taken from the spec example.
const MOCK_PARSED = {
  tier:                        'B',
  ai_score:                    0.87,
  clarity_score:               0.90,
  syllabus_relevance_score:    0.85,
  answerability_score:         0.90,
  explanation_quality_score:   0.70,
  duplicate_risk_score:        0.10,
  difficulty_confidence:       0.80,
  recommended_difficulty:      'medium',
  reason_codes:                ['mocked_response'],
}

/**
 * @param {object} question
 * @param {{ timeoutMs?: number }} options
 * timeoutMs defaults to 28 000 ms — below the 35 s job-level timeout
 * so the worker always has time to write the retry record before the
 * outer job timeout fires.
 *
 * Set MOCK_AI=true to skip the real API call and return a fixed response.
 */
export async function callModerationLLM(question, { timeoutMs = 28_000 } = {}) {
  if (process.env.MOCK_AI === 'true') {
    return {
      parsed:       MOCK_PARSED,
      raw:          JSON.stringify(MOCK_PARSED),
      processingMs: 0,
      modelUsed:    'mock',
    }
  }

  const userMessage = buildUserMessage(question)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('LLM call timed out')), timeoutMs)

  const startMs = Date.now()
  try {
    const response = await client.messages.create(
      {
        model:      'claude-sonnet-4-6',
        max_tokens: 512,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )

    const raw    = response.content[0]?.text ?? ''
    const parsed = parseJsonSafe(raw)

    return { parsed, raw, processingMs: Date.now() - startMs, modelUsed: response.model }
  } finally {
    clearTimeout(timer)
  }
}

function buildUserMessage(q) {
  const optionsText = Array.isArray(q.options)
    ? q.options.map(o => `  ${o.key}: ${o.text}`).join('\n')
    : '(open-ended, no options)'

  return [
    `Subject: ${q.subject}`,
    `Chapter: ${q.chapter}`,
    `Stated difficulty: ${q.difficulty}`,
    ``,
    `Question:`,
    q.body,
    ``,
    `Options:`,
    optionsText,
    ``,
    `Correct answer: ${q.correct_answer}`,
    ``,
    `Explanation:`,
    q.explanation ?? '(none provided)',
  ].join('\n')
}

function parseJsonSafe(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
