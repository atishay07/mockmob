// Learn v2: seconds per item (BUILD-1101 1.5, A5 R8; owner decision D3 taken by the CTO). PURE.
// A reading model a 16-year-old can keep to, not a measurement: A12 timings (rate and answer bodies may carry ms) recalibrate
// these constants later. Every composed run item carries its own `seconds`; the composer, the pile minutes, the pick-up minutes
// and the player's "min left" all sum item.seconds, so no screen keeps its own per-kind constant.
//
//   cards       new 18, due 12, a look 10, a recap card 10, a card back again in the run 12;
//               +8 when the front plus its NCERT line is over 60 words
//   questions   easy 50, medium 65, hard 90 (unknown difficulty: medium); +20 when the stem is over 60 words
//   mistakes    an open mistake retried: 60 (+20 when its stem is over 60 words)
//   level       a Find-your-level question: 55 (one line of feedback; 6 of them read "about 6 minutes")
//   lesson      its own minutes

export const SECONDS = Object.freeze({
  card: Object.freeze({ new: 18, due: 12, look: 10, recap: 10, again: 12 }),
  cardLongWords: 60,
  cardLongExtra: 8,
  question: Object.freeze({ easy: 50, medium: 65, hard: 90 }),
  questionLongWords: 60,
  questionLongExtra: 20,
  mistake: 60,
  level: 55,
});

const words = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

/** Words a card asks the student to read: its front plus its NCERT line (the quote, else the back). */
export const cardWords = (card) => words(card?.front) + words(card?.quote || card?.back);

/**
 * Seconds of one card on screen.
 *   stage   'new' | 'due' | 'later' | 'again' | 'recap'
 *   look    shown, never rated (a held card in the feed, or past Free's ratings)
 *   words   front plus NCERT line (cardWords)
 */
export function cardSeconds({ stage = 'new', look = false, recap = false, words: w = 0 } = {}) {
  const C = SECONDS.card;
  let base;
  if (recap || stage === 'recap') base = C.recap;
  else if (look) base = C.look;
  else if (stage === 'due') base = C.due;
  else if (stage === 'again') base = C.again;
  else base = C.new;
  return base + (Number(w) > SECONDS.cardLongWords ? SECONDS.cardLongExtra : 0);
}

/**
 * Seconds of one question on screen.
 *   difficulty  'easy' | 'medium' | 'hard'   words  the stem's words   origin  'mistake' retries at the mistake rate
 *   level       a Find-your-level question
 */
export function questionSeconds({ difficulty = null, words: w = 0, origin = null, level = false } = {}) {
  if (level) return SECONDS.level;
  const base = origin === 'mistake' ? SECONDS.mistake : (SECONDS.question[difficulty] ?? SECONDS.question.medium);
  return base + (Number(w) > SECONDS.questionLongWords ? SECONDS.questionLongExtra : 0);
}

/** Seconds of a composed item: its own `seconds` when set, else the rule for its kind (old stored runs). */
export function itemSeconds(item) {
  const own = Number(item?.seconds);
  if (Number.isFinite(own) && own > 0) return own;
  if (item?.type === 'lesson') return Math.max(0, Number(item.minutes) || 0) * 60;
  if (item?.type === 'question') return questionSeconds({ difficulty: item.difficulty, words: item.words, origin: item.origin });
  return cardSeconds({ stage: item?.stage, look: item?.look, recap: item?.recap, words: item?.words });
}

/** Seconds of a list of items. */
export const sumSeconds = (items) => (items || []).reduce((s, it) => s + itemSeconds(it), 0);
