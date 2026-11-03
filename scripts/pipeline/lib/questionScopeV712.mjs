// Deterministic question-scope detection for V7.12 (no model judgment). Scope-based refutations are allowed only where the task itself
// makes the printed case or passage the universe of the question; everywhere else source silence and category labels stay non-decisive.

const READING_TYPES = new Set(['reading_comprehension', 'passage_comprehension', 'vocabulary_in_context', 'inference', 'passage_inference']);
const PASSAGE_SCOPED_STEM = /\b(according to the (passage|text|extract|story|poem|author|report)|(in|from|based on) the (passage|text|extract|story)|the (passage|text|extract|author|narrator|writer|poet|report) (states?|says?|suggests?|implies?|indicates?|describes?|mentions?)|(best )?supported by the (passage|text)|can be (inferred|concluded)|most nearly (means?|refers?)|as used in the (passage|text))/i;

// Illustration: the student must match a described case to ONE named concept (feature, principle, function, right...).
const ILLUSTRATION_NOUN = /\b(features?|characteristics?|principles?|functions?|rights?|advantages?|limitations?|importance|elements?|steps?|objectives?|techniques?|dimensions?|levels? of management|nature of management|aspects?|responsibilit(y|ies)|types? of (plan|organisation|organization|structure))\b/i;
const ILLUSTRATION_VERB = /\b(illustrat\w*|show(s|n|ing)?|highlight\w*|depict\w*|reflect\w*|exhibit\w*|demonstrat\w*|indicat\w*|(is|are) (being )?(followed|violated|applied|described|referred to|exercised|performed)|refer(s|red)? to)\b/i;
// Classification: the student must decide which category/treatment an object, receipt or transaction belongs to. Never illustration.
const CLASSIFICATION = /\b(classif\w*|categor\w*|treated as|treatment|recorded|credited|debited|(which|what) account|how should|journal entry|capital (receipt|expenditure)|revenue (receipt|expenditure)|nature of (the )?(receipt|expenditure|transaction|account)|is (it )?(a|an) (asset|liability|income|expense))\b/i;

export function readingTaskV712(view) {
  const passage = typeof view?.passage === 'string' ? view.passage.trim() : '';
  if (!passage) return false;
  if (view?.subject === 'english' && READING_TYPES.has(String(view?.question_type || ''))) return true;
  return PASSAGE_SCOPED_STEM.test(String(view?.body || ''));
}

export function illustrationTaskV712(view) {
  const body = String(view?.body || '');
  if (view?.subject === 'english') return false;
  if (CLASSIFICATION.test(body)) return false;
  return ILLUSTRATION_NOUN.test(body) && ILLUSTRATION_VERB.test(body);
}
