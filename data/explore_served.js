// Server side of Explore and Saved (R5 Packet A, LK44): a question row as the QuestionCard receives it, in the stable
// option order of data/option_order.js. Kept apart from data/explore_feed.js, which the browser bundles.
//
// The card grades with the served correct_answer and posts the served letter (the website adds option_order, the version
// of the order it was served; the app, which renders the feed's options as sent, posts the served letter without it).
// POST /api/questions/[id]/interact turns that letter back into the stored letter (storedAnswerOf) before it grades and
// stores anything. Every client renders the options these routes send, so every posted letter is a served letter.
import { feedOptions } from './explore_feed.js';
import { OPTION_ORDER_VERSION, keyIndexOf, servedRow, storedIndexOf, storedKeyAt } from './option_order.js';

const LETTERS = 'ABCDE';

/** The answer fields of a feed or Saved question: options, key letter and explanation as served, and the order's version. */
export function feedServed(row) {
  const served = servedRow(row);
  return {
    options: feedOptions(served.row?.options),
    correct_answer: served.row?.correct_answer ?? null,
    explanation: served.row?.explanation ?? null,
    option_order: OPTION_ORDER_VERSION,
  };
}

/**
 * A posted answer as stored identity: { selectedKey: the stored letter, correct: true/false/null }. `row` needs the
 * columns the order reads (options, question/body, correct_index, correct_answer, explanation).
 */
export function storedAnswerOf(row, metadata) {
  const posted = metadata?.selected_key == null ? null : String(metadata.selected_key).trim().toUpperCase();
  if (posted == null) return { selectedKey: null, correct: null };
  const key = keyIndexOf(row);
  const at = LETTERS.indexOf(posted);
  const stored = at < 0 ? -1 : storedIndexOf(servedRow(row).order, at);
  if (stored < 0) return { selectedKey: null, correct: null };
  return { selectedKey: storedKeyAt(row?.options, stored), correct: key < 0 ? null : stored === key };
}
