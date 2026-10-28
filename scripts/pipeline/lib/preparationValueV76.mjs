import { keyedOrder } from './batchInspection.mjs';

// v7.6 preparation-value checks. Deterministic and free: they use only the candidate's own text, never a model,
// a provider or the network. They add preparation-value requirements ON TOP of the inherited mandatory
// correctness gates and never change a correctness pass or fail; a blocking finding quarantines the candidate.
// Keyword, overlap and ordering cues are diagnostic only. They cannot become blockers through label aggregation.

export const PREPARATION_VALUE_VERSION_V76 = 'preparation-value-v76';
export const OBJECTIVE_RULE_CODES_V76 = Object.freeze(['learning_objective_missing', 'learning_objective_reveals_key', 'vocabulary_target_unstated', 'vocabulary_target_absent']);
export const FINDING_CODES_V76 = Object.freeze([...OBJECTIVE_RULE_CODES_V76, 'ordering_cohesion_cue', 'ordering_printed_order_key', 'stem_discloses_key',
  'absolute_distractors', 'generic_economics_arithmetic', 'difficulty_label_overstated']);

const norm = s => String(s ?? '').normalize('NFKC').toLowerCase();
const tokens = s => norm(s).replace(/[^\p{L}\p{N}₹]+/gu, ' ').split(' ').filter(Boolean);
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'and', 'or', 'but', 'if', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that',
  'these', 'those', 'with', 'as', 'from', 'into', 'than', 'then', 'so', 'such', 'their', 'his', 'her', 'they', 'them', 'he', 'she', 'we', 'you', 'can', 'could', 'may', 'might', 'will', 'would',
  'should', 'shall', 'do', 'does', 'did', 'has', 'have', 'had', 'which', 'what', 'who', 'whom', 'whose', 'when', 'where', 'how', 'why', 'also', 'both', 'each', 'one', 'any', 'under', 'about',
  'following', 'consider', 'statement', 'statements', 'correct', 'choose', 'given', 'below', 'options', 'option', 'answer', 'identify', 'select', 'true', 'describe', 'describes', 'correctly']);
// For diagnostic overlap only: light stemming so "rules"/"rule" and "utilising"/"utilis" compare equal. Not linguistic; only a coverage heuristic.
const stem = w => (w.length > 6 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const contentWords = text => [...new Set(tokens(text).filter(w => !STOPWORDS.has(w)).map(stem))];
const coverage = (words, preamble) => (words.length ? words.filter(w => preamble.has(w)).length / words.length : 0);

const optionTexts = c => (Array.isArray(c.options) ? c.options : []).map(o => (typeof o === 'string' ? o : String(o?.text ?? '')));
const keyIndex = c => 'ABCD'.indexOf(c.correct_answer);
const labelled = body => [...String(body ?? '').matchAll(/^[ \t]*\(([A-D])\)[ \t]*(.+)$/gm)].map(m => ({ label: m[1], text: m[2].trim() }));
const preambleOf = body => { const text = String(body ?? ''), at = text.search(/^[ \t]*\(A\)/m); return at >= 0 ? text.slice(0, at) : text; };
// "A and C only", "(A), (B) and (D)": a combination of labelled statements, not a textual option.
const letterCombo = o => /^\(?[A-D]\)?(?:\s*(?:,|[Aa][Nn][Dd]|&)\s*\(?[A-D]\)?)*(?:\s+[Oo][Nn][Ll][Yy])?\.?$/.test(String(o).trim());
const pairing = o => /\([A-D]\)\s*[-–]\s*\([IVX]+\)/.test(String(o));
const isTextOption = o => !letterCombo(o) && !pairing(o) && !/^[\s(),.\-–>→]*[A-D](?:[\s(),.\-–>→]+[A-D]){3}[\s(),.\-–>→]*$/.test(String(o));
const isOrdering = c => /order|sequence|jumble/i.test(String(c.question_type ?? ''));
const isReading = c => String(c.passage_text ?? '').trim() !== '' || /reading/i.test(String(c.question_type ?? ''));

const LEXICAL_CHAPTERS = new Set(['vocabulary', 'correct word usage', 'match the following']);
const LEXICAL_TYPE = /(synonym|antonym|word[_\s-]*usage|vocab|one[_\s-]*word|word[_\s-]*meaning)/i;
const isLexical = c => norm(c.subject) === 'english' && (LEXICAL_CHAPTERS.has(norm(c.chapter).trim()) || LEXICAL_TYPE.test(String(c.question_type ?? '')));

const CONNECTOR = /^["'“‘(\s]*(?:this|that|these|those|such|thus|hence|therefore|then|next|finally|thereafter|subsequently|following (?:this|that)|after (?:this|that)|once (?:this|that))\b/i;
const ORDERING_SUBJECTS = new Set(['accountancy', 'business_studies', 'economics']);
const ABSOLUTE = /\b(?:always|never|solely|all|every|none|guarantee[sd]?|completely|entirely|impossible|cannot|only)\b/i;
// Negation or scope-limiting words: a distractor that flips polarity or narrows scope still echoes the stem's words.
const polarityWords = t => new Set(norm(t).match(/\b(?:not|no|never|neither|nor|only|solely|without|cannot|none)\b|n't\b/g) ?? []);

const ECONOMICS_LEXICON = ['multiplier', 'mpc', 'mps', 'apc', 'aps', 'propensity', 'elasticity', 'national income', 'gdp', 'gnp', 'ndp', 'nnp', 'factor cost', 'market price', 'value added',
  'depreciation', 'consumption', 'saving', 'investment', 'deficit', 'reserve ratio', 'crr', 'slr', 'repo', 'money supply', 'demand', 'supply', 'equilibrium', 'balance of payments', 'exchange rate',
  'revenue', 'cost', 'utility', 'marginal', 'profit', 'inflation', 'deflator', 'tax', 'budget', 'expenditure', 'subsidy', 'output', 'income', 'wage', 'interest', 'unemployment', 'poverty',
  'credit', 'bank', 'export', 'import', 'trade', 'price', 'budgetary', 'fiscal', 'monetary', 'population', 'growth rate', 'workforce'];
const lexiconPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${ECONOMICS_LEXICON.map(t => t.replace(/ /g, '\\s+')).join('|')})`, 'iu');

const objectiveOf = c => (c.learning_objective && typeof c.learning_objective === 'object' && !Array.isArray(c.learning_objective) ? c.learning_objective : null);
const targetTerms = lo => {
  const raw = [...(Array.isArray(lo?.target_terms) ? lo.target_terms : []), ...(typeof lo?.target_term === 'string' ? [lo.target_term] : [])];
  return raw.flatMap(t => String(t ?? '').split(/[,;|/]/)).map(t => t.trim()).filter(Boolean);
};
const termPresent = (term, tokenList) => term.split(/\s+/).filter(Boolean).every(word => {
  const w = norm(word).replace(/[^\p{L}\p{N}]+/gu, '');
  return !!w && tokenList.includes(w);
});

export function preparationValueV76(candidate, { reasoningSteps, objectiveRules = true } = {}) {
  const c = candidate ?? {}, findings = [], notApplicable = [];
  const add = (code, blocking, basis) => findings.push({ code, blocking, basis });
  const options = optionTexts(c), at = keyIndex(c), keyed = at >= 0 ? options[at] ?? '' : '';
  const body = String(c.body ?? '');
  const lexical = isLexical(c), ordering = isOrdering(c);

  // a/b. A stated, key-free learning objective, and for lexical items the named target word itself.
  if (objectiveRules) {
    const lo = objectiveOf(c);
    if (!lo || !String(lo.objective ?? '').trim() || !String(lo.syllabus_unit ?? '').trim()) add('learning_objective_missing', true, 'learning_objective needs a non-empty objective and syllabus_unit');
    else {
      // Require answer-bearing language or an entire keyed factual proposition; merely naming a concept is legitimate.
      if (isTextOption(keyed) && ((tokens(keyed).length >= 5 && /\b(?:is|are|was|were|means|records|increases|decreases|acknowledges|requires|includes)\b/i.test(keyed) && tokens(lo.objective).join(' ').includes(tokens(keyed).join(' '))) || new RegExp('\\b(?:correct (?:answer|option)|answer (?:is|must be)|key(?:ed)? (?:is|option))\\s*[:=]?\\s*' + c.correct_answer + '\\b', 'i').test(String(lo.objective)))) add('learning_objective_reveals_key', true, 'the objective text contains the keyed option text');
      if (lexical) {
        const terms = targetTerms(lo);
        if (!terms.length) add('vocabulary_target_unstated', true, 'a lexical item must name the target word in learning_objective.target_term');
        else {
          const visible = [...tokens(body), ...options.flatMap(tokens)], missing = terms.filter(t => !termPresent(t, visible));
          if (missing.length) add('vocabulary_target_absent', true, `target term not tested in the stem or options: ${missing.join(', ')}`);
        }
      }
    }
  } else notApplicable.push(...OBJECTIVE_RULE_CODES_V76);

  const steps = labelled(body);
  // c. Non-English ordering connectors signal a possible shortcut, never establish one by themselves.
  if (ordering && ORDERING_SUBJECTS.has(norm(c.subject))) {
    const cued = steps.filter(s => CONNECTOR.test(s.text));
    if (cued.length >= 2) add('ordering_cohesion_cue', false, `${cued.length} steps begin with a linking word (${cued.map(s => s.label).join(', ')}) requiring contextual scrutiny`);
    else if (cued.length === 1) add('ordering_cohesion_cue', false, `step ${cued[0].label} begins with a linking word`);
  }
  // d. The keyed order is the printed order A-B-C-D: guessable without domain knowledge.
  if (ordering && keyedOrder({ options, correct_answer: c.correct_answer }).join('') === 'ABCD') add('ordering_printed_order_key', false, 'the keyed order equals the printed order A-B-C-D');

  // e. Vocabulary overlap is a contextual diagnostic. Passage items legitimately supply information; numeric keys are exempt.
  if (!isReading(c) && !/\d/.test(keyed)) {
    const pre = new Set(contentWords(preambleOf(body)));
    if (letterCombo(keyed)) {
      const keyedLetters = new Set(keyed.match(/[A-D]/g) ?? []);
      const statements = steps.filter((s, i) => steps.findIndex(x => x.label === s.label) === i);
      const yes = statements.filter(s => keyedLetters.has(s.label)), no = statements.filter(s => !keyedLetters.has(s.label));
      if (yes.length && no.length && yes.length === keyedLetters.size) {
        const yesCov = yes.map(s => coverage(contentWords(s.text), pre));
        // A distractor statement is cleanly separated by the stem when it is mostly absent from it, or when it echoes the
        // stem's words but flips polarity or narrows scope with a negation/limiter the stem does not contain.
        const preamblePolarity = polarityWords(preambleOf(body));
        const separated = no.every(s => coverage(contentWords(s.text), pre) < 0.5 || [...polarityWords(s.text)].some(w => !preamblePolarity.has(w)));
        if (yesCov.every(v => v >= 0.7) && separated) add('stem_discloses_key', false, `every keyed statement is >=70% restated by the stem preamble (${yesCov.map(v => v.toFixed(2)).join(', ')}) while distractor statements are not`);
      }
    } else if (isTextOption(keyed) && !ordering) {
      const keyWords = contentWords(keyed);
      if (keyWords.length >= 4) {
        const keyCov = coverage(keyWords, pre), others = options.filter((o, i) => i !== at && isTextOption(o)).map(o => coverage(contentWords(o), pre));
        if (keyCov >= 0.8 && others.length && others.every(v => keyCov - v >= 0.3)) add('stem_discloses_key', false, `the keyed option is ${(keyCov * 100).toFixed(0)}% restated by the stem and every distractor is at least 0.3 lower`);
      }
    }
  }

  // f. Absolute wording is a contextual diagnostic: precise domain rules may legitimately use it.
  if (!isReading(c) || options.some(isTextOption)) {
    let distractors = [], keyedTexts = [];
    if (letterCombo(keyed)) {
      const keyedLetters = new Set(keyed.match(/[A-D]/g) ?? []);
      distractors = steps.filter(s => !keyedLetters.has(s.label)).map(s => s.text); keyedTexts = steps.filter(s => keyedLetters.has(s.label)).map(s => s.text);
    } else if (isTextOption(keyed) && !ordering) {
      distractors = options.filter((o, i) => i !== at && isTextOption(o)); keyedTexts = [keyed];
    }
    const hasAbsolute = t => ABSOLUTE.test(t), anyKeyedAbsolute = keyedTexts.some(t => ABSOLUTE.test(t));
    if (distractors.length >= 2 && keyedTexts.length && !anyKeyedAbsolute) {
      const hits = distractors.filter(hasAbsolute).length;
      if (hits === distractors.length) add('absolute_distractors', false, `all ${hits} distractors use absolutes the correct choice avoids`);
      else if (hits >= 2) add('absolute_distractors', false, `${hits} of ${distractors.length} distractors use absolutes the correct choice avoids`);
    }
  }

  // g. Economics numericals that never use an economics concept are generic arithmetic.
  const optionDigits = options.filter(o => /\d/.test(o)).length;
  const numerical = /numer|calcul/i.test(String(c.question_type ?? '')) || (optionDigits >= 3 && (body.match(/\d[\d,.]*/g) ?? []).length >= 2);
  if (norm(c.subject) === 'economics' && numerical && !lexiconPattern.test(body)) add('generic_economics_arithmetic', false, 'no economics concept or term appears in the stem of this numerical item');

  // Difficulty is judged from actual demand. Keyword/overlap findings do not determine it.
  // A known low step count is a diagnostic, not proof of low demand: close concepts may
  // require discrimination without a long chain. The model judges the complete task.
  const label = norm(c.difficulty).trim();
  const known = Number.isFinite(Number(reasoningSteps)) && reasoningSteps !== null && reasoningSteps !== undefined && reasoningSteps !== '';
  if (label === 'hard' && known && Number(reasoningSteps) < 3) add('difficulty_label_overstated', false,
    `labelled hard with ${Number(reasoningSteps)} reported reasoning step(s); assess actual conceptual demand in context`);

  return { findings, blocking: findings.some(f => f.blocking), ...(notApplicable.length ? { not_applicable: notApplicable } : {}) };
}

export const preparationReasonsV76 = value => (value?.findings ?? []).filter(f => f.blocking).map(f => f.code);
