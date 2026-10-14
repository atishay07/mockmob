// Comparison key for answer OPTIONS (engine r5.2). Used by the validity and duplicate checks of data/answer_integrity.js and
// data/nta_question_selector.js.
//
// The older key kept only [a-z0-9] and threw everything else away, so "(e + 1)/2" and "(e - 1)/2" both became "e 1 2", "pi/4"
// and "4" both became "4", and "ENAME LIKE 'S%'" and "ENAME LIKE '%S'" were the same option. Mathematical and code symbols
// now take part in the key:
//   operators      + - (U+2212 minus and hyphen alike) x * (multiply sign, asterisk, dot operator) / (and the division sign)
//                  ^ (a superscript run becomes ^run, a subscript run becomes _run, so x^2 and x2 with a superscript two
//                  are the same) sqrt, integral, sum, product, = < > <= >= != approx, percent, degree, prime, infinity,
//                  set symbols, partial/nabla/delta, bar, underscore
//   brackets       ( ) [ ] { } when the option is mathematical (has a digit or an operator), so (1, 3) and [1, 3] differ
//   decimal point  kept between digits
//   letters/digits every Unicode letter, mark and number (pi, theta, Devanagari, superscript letters), not just a-z
// Still ignored, so true duplicates are still caught: case, spacing, quotes, trailing . , ; : ! ?, brackets and hyphens in
// ordinary prose ("co-ordinate" = "co ordinate"), and the articles a / an / the in a prose option ("The cell" = "cell").
// A single-letter option ("A") is not special-cased here; the validity rule in each caller still rejects it.

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸᵀᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷᶻ';
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢᵣᵤᵥ';
const SUPERSCRIPT_RUN = new RegExp(`[${SUPERSCRIPTS}]+`, 'g');
const SUBSCRIPT_RUN = new RegExp(`[${SUBSCRIPTS}]+`, 'g');
const MINUS_SENTINEL = '\u0001';
const ALWAYS_OPERATORS = '+*/^√∛∜∫∑∏=<>≤≥≠≈≡%°′″∞∪∩∈∉⊂⊆⊃⊇∂∇∆|_';
const ALWAYS_OPERATOR_TEST = new RegExp(`[${ALWAYS_OPERATORS.replace(/[\]\\^-]/g, '\\$&')}\\d${MINUS_SENTINEL}]`);
const KEEP_CHAR = new RegExp(`[\\p{L}\\p{M}\\p{N}${ALWAYS_OPERATORS.replace(/[\]\\^-]/g, '\\$&')}]`, 'u');
const ARTICLES_ALWAYS = new Set(['an', 'the']);
const A_NOT_ARTICLE_BEFORE = new Set(['and', 'or', 'to', 'only', 'is', 'not']);

function baseOf(run) {
  return run.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

// Prose options: drop a / an / the, but never turn an option into nothing and never touch the label A of "Vitamin A".
function dropArticles(tokens, originalWords) {
  const kept = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (ARTICLES_ALWAYS.has(token)) continue;
    if (token === 'a') {
      const original = originalWords[i] ?? 'a';
      const next = tokens[i + 1];
      const isLabel = original === 'A' && (i > 0 || !next || next.length < 2 || A_NOT_ARTICLE_BEFORE.has(next));
      if (!isLabel && next) continue;
    }
    kept.push(token);
  }
  return kept.length ? kept : tokens;
}

export function normalizeOptionComparable(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim().normalize('NFC');
  if (!text) return '';
  // Superscript and subscript runs first (the lowercasing below would not harm them, but NFKD-style folding would).
  text = text
    .replace(SUPERSCRIPT_RUN, (run) => `^${baseOf(run)}`)
    .replace(SUBSCRIPT_RUN, (run) => `_${baseOf(run)}`);
  // Words with their original case, for the article rule, are taken before lowercasing.
  const originalWords = text.replace(/&/g, ' and ').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().split(' ');
  text = text.toLowerCase();
  text = text
    .replace(/&/g, ' and ')
    .replace(/<=|⩽/g, '≤')
    .replace(/>=|⩾/g, '≥')
    .replace(/!=|<>/g, '≠')
    .replace(/[×⋅·∗]/g, '*')
    .replace(/÷/g, '/')
    .replace(/⁄|∕/g, '/')
    .replace(/−/g, MINUS_SENTINEL)
    .replace(/[‐-―﹘﹣－]/g, '-')
    .replace(/(\p{L}{2,})-(?=\p{L}{2,})/gu, '$1 ');

  const mathy = ALWAYS_OPERATOR_TEST.test(text) || /(^|[^\p{L}])\p{L}\s*-|-\s*\p{L}($|[^\p{L}])|^\s*-/u.test(text);

  let out = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === MINUS_SENTINEL) { out += ' - '; continue; }
    if (ch === '-') { out += mathy ? ' - ' : ' '; continue; }
    if (ch === '.') {
      const before = chars[i - 1];
      const after = chars[i + 1];
      out += before && after && /\d/.test(before) && /\d/.test(after) ? '.' : ' ';
      continue;
    }
    if ('()[]{}'.includes(ch)) { out += mathy ? ` ${ch} ` : ' '; continue; }
    if (ALWAYS_OPERATORS.includes(ch)) { out += ` ${ch} `; continue; }
    out += KEEP_CHAR.test(ch) ? ch : ' ';
  }
  const tokens = out.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!mathy) return dropArticles(tokens, originalWords).join(' ');
  return tokens.join(' ');
}
