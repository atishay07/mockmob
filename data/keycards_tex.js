// Key cards: typeset formulas (handoff-1102/MATHTEX-SPEC.md, LK34). A mathematics or physics card may carry
// `tex: { front?, back? }`, the faithful typeset form of its plain front and back, with math written inline as `$…$` or as a
// whole display line `$$…$$`. The stored front, back and quote stay the machine-checked anchors; this file reads tex into
// plain Unicode (every client that does not draw math) and into KaTeX HTML (the web).
//
// Imported by the server (src/lib/server/keycards.js), the content scripts and node:test only, never by a client component:
// the KaTeX JS stays on the server, and the web draws the HTML it sends (src/components/keycards/TexHtml.jsx).
import katex from 'katex';
import { LIST_KINDS, ownMarker, stripKindPrefix } from '../src/components/keycards/kinds.js';

export const TEX_SUBJECTS = Object.freeze(['mathematics', 'physics']);
export const KATEX_OPTIONS = Object.freeze({ throwOnError: true, strict: 'error', trust: false, maxExpand: 200, maxSize: 20, output: 'htmlAndMathml' });

/** Commands never allowed in a tex string: links, images, raw HTML, macro definitions, colour and boxes. */
export const FORBIDDEN_TEX = /\\(?:href|url|includegraphics|html[A-Za-z]*|def|gdef|edef|xdef|let|newcommand|renewcommand|providecommand|color|textcolor|colorbox|fcolorbox|raisebox|rule|class|style|data)(?![A-Za-z])/;

/** The lines of a tex.back or a back: split on line breaks, blank lines ignored. */
export const texLines = (text) => String(text ?? '').split(/\n+/).map((l) => l.trim()).filter(Boolean);

// ---------------------------------------------------------------- delimiters

/**
 * A tex string as prose and math parts: { ok, parts: [{ type: 'text' | 'math', value, display }] }. `$$` is matched before
 * `$`. Not ok when a delimiter is unbalanced, a math part is empty or holds a line break, or a `$$…$$` part shares its line
 * with anything else. The parts are a best effort even when not ok (a bad span is kept as text).
 */
export function splitTex(str) {
  const s = String(str ?? '');
  const parts = [];
  let ok = true;
  let text = '';
  let at = 0;
  const flush = () => { if (text) parts.push({ type: 'text', value: text, display: false }); text = ''; };
  while (at < s.length) {
    if (s[at] !== '$') { text += s[at]; at += 1; continue; }
    const display = s.startsWith('$$', at);
    const open = display ? 2 : 1;
    const end = s.indexOf(display ? '$$' : '$', at + open);
    if (end < 0) { ok = false; text += s.slice(at); break; }
    const value = s.slice(at + open, end);
    let good = Boolean(value.trim()) && !/[\n$]/.test(value);
    if (display) {
      const lineStart = s.lastIndexOf('\n', at - 1) + 1;
      const next = s.indexOf('\n', end + 2);
      if (s.slice(lineStart, at).trim() || s.slice(end + 2, next < 0 ? s.length : next).trim()) good = false;
    }
    if (!good) { ok = false; text += s.slice(at, end + open); at = end + open; continue; }
    flush();
    parts.push({ type: 'math', value, display });
    at = end + open;
  }
  flush();
  return { ok, parts };
}

// ---------------------------------------------------------------- tex to plain Unicode

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ρ', sigma: 'σ',
  varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYMBOLS = {
  to: '→', rightarrow: '→', longrightarrow: '→', Rightarrow: '⇒', Longrightarrow: '⇒', implies: '⇒', leftarrow: '←', Leftarrow: '⇐',
  leftrightarrow: '↔', Leftrightarrow: '⇔', iff: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', lt: '<', gt: '>', ll: '≪', gg: '≫', approx: '≈', equiv: '≡', sim: '∼',
  simeq: '≃', cong: '≅', propto: '∝', pm: '±', mp: '∓', times: '×', cdot: '·', cdotp: '·', div: '÷', ast: '∗', star: '⋆',
  infty: '∞', circ: '∘', angle: '∠', perp: '⊥', parallel: '∥', triangle: '△', square: '□', partial: '∂', nabla: '∇',
  ldots: '…', dots: '…', cdots: '…', vdots: '⋮', ddots: '⋱', forall: '∀', exists: '∃', emptyset: '∅', varnothing: '∅',
  neg: '¬', lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', therefore: '∴', because: '∵', prime: '′', degree: '°',
  mid: '|', vert: '|', lvert: '|', rvert: '|', Vert: '‖', lVert: '‖', rVert: '‖', '|': '‖',
  langle: '⟨', rangle: '⟩', lbrace: '{', rbrace: '}', '{': '{', '}': '}', lbrack: '[', rbrack: ']', lfloor: '⌊', rfloor: '⌋',
  lceil: '⌈', rceil: '⌉', backslash: '∖', colon: ':', '%': '%', '&': '&', '#': '#', _: '_', imath: 'i', jmath: 'j',
  int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: 'Σ', prod: 'Π',
};
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'cosec', 'log', 'ln', 'exp', 'max', 'min', 'det', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'gcd']);
const SPACES = new Set([',', ';', ':', '>', ' ', 'quad', 'qquad', 'enspace', 'thinspace', 'medspace', 'thickspace']);
const DROPPED = new Set(['!', 'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'nonumber', 'hline', 'middle',
  'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr']);
// Commands whose one argument is shown as it is (fonts and words in math).
const CONTENT = new Set(['mathbf', 'mathbb', 'mathrm', 'mathit', 'mathsf', 'mathcal', 'boldsymbol', 'bm', 'operatorname']);
const TEXT = new Set(['text', 'textrm', 'textit', 'textbf', 'textsf', 'mbox']);
// Accents: the argument followed by one combining mark (on every character for an over- or underline).
const ACCENT = { vec: '⃗', overrightarrow: '⃗', hat: '̂', widehat: '̂', bar: '̄', tilde: '̃', widetilde: '̃', dot: '̇', ddot: '̈' };
const EVERY_CHAR = { overline: '̅', underline: '̲' };
const FRACS = new Set(['frac', 'dfrac', 'tfrac', 'cfrac']);
const MATRICES = { matrix: ['[', ']'], bmatrix: ['[', ']'], pmatrix: ['[', ']'], Bmatrix: ['[', ']'], smallmatrix: ['[', ']'], array: ['[', ']'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'] };
const NEGATED = { '=': '≠', '∈': '∉', '⊂': '⊄', '⊆': '⊈', '<': '≮', '>': '≯', '≤': '≰', '≥': '≱', '≡': '≢' };

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ',
  r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '−': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };

// Spaces collapsed, and none just inside a round or square bracket ("\left( x \right)" reads "(x)").
const squash = (s) => s.replace(/[ \t]+/g, ' ').replace(/([([]) /g, '$1').replace(/ ([)\]])/g, '$1').trim();
// A cases row's cells joined with a comma, unless the cell already ends with one ("x, & \text{if } x \ge 0").
const caseRow = (cells) => cells.filter(Boolean).reduce((row, cell) => (!row ? cell : /[,;]$/.test(row) ? `${row} ${cell}` : `${row}, ${cell}`), '');
/** A superscript or subscript: Unicode script characters when every character has one, else ^(…) / _(…). */
function script(body, mark) {
  const s = body.replace(/\s+/g, '');
  if (!s) return '';
  if (mark === '^' && /^′+$/.test(s)) return s;
  if (mark === '^' && s === '∘') return '°';
  const map = mark === '^' ? SUP : SUB;
  const chars = [...s];
  return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join('') : `${mark}(${s})`;
}
// A numerator or denominator of more than one term is bracketed: (a + b)/(c − d).
const term = (s) => (/[\s+−=<>≤≥×·÷/,±∓]/.test(s) ? `(${s})` : s);

/** One math part as linear Unicode. Unknown commands keep their backslash (texCheck's shape:tex_plain catches them). */
function mathPlain(src, { text = false } = {}) {
  let i = 0;
  let out = '';
  const peek = () => src[i];
  const skipSpaces = () => { while (i < src.length && /\s/.test(src[i])) i += 1; };
  // A command name after its backslash: a run of letters, or one other character.
  const commandName = () => {
    const m = /^[A-Za-z]+/.exec(src.slice(i));
    const name = m ? m[0] : src[i] || '';
    i += name.length;
    return name;
  };
  // The balanced group starting at `{` (i on the brace): its inner text.
  const group = () => {
    let depth = 0;
    const start = i;
    for (; i < src.length; i += 1) {
      if (src[i] === '\\') { i += 1; continue; }
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}' && (depth -= 1) === 0) { i += 1; return src.slice(start + 1, i - 1); }
    }
    return src.slice(start + 1);
  };
  // One argument, raw: a group's inner text, a command, or one character.
  const arg = () => {
    skipSpaces();
    if (peek() === '{') return group();
    if (peek() === '\\') { i += 1; return `\\${commandName()}`; }
    const c = src[i] || '';
    i += 1;
    return c;
  };
  const optional = () => {
    skipSpaces();
    if (peek() !== '[') return null;
    const end = src.indexOf(']', i);
    const v = src.slice(i + 1, end < 0 ? src.length : end);
    i = end < 0 ? src.length : end + 1;
    return v;
  };
  const sub = (raw, opts) => squash(mathPlain(raw, opts));
  const env = (name) => {
    if (name === 'array') arg(); // the column spec
    const endTag = `\\end{${name}}`;
    let depth = 0;
    let j = i;
    for (; j < src.length; j += 1) {
      if (src.startsWith(`\\begin{${name}}`, j)) depth += 1;
      else if (src.startsWith(endTag, j)) { if (depth === 0) break; depth -= 1; }
    }
    const body = src.slice(i, j);
    i = Math.min(src.length, j + endTag.length);
    const rows = splitTop(body, '\\\\').map((row) => splitTop(row, '&').map((cell) => sub(cell))).filter((cells) => cells.some(Boolean));
    if (name === 'cases' || name === 'dcases') return `{ ${rows.map(caseRow).join('; ')}`;
    if (MATRICES[name]) return `${MATRICES[name][0]}${rows.map((cells) => cells.join(' ')).join('; ')}${MATRICES[name][1]}`;
    return rows.map((cells) => cells.join('')).join('; ');
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '{') { out += mathPlain(group(), { text }); continue; }
    if (c === '}') { i += 1; continue; }
    if (!text && (c === '^' || c === '_')) { i += 1; out += script(sub(arg()), c); continue; }
    if (!text && c === "'") { out += '′'; i += 1; continue; }
    if (!text && c === '-') { out += '−'; i += 1; continue; }
    if (c === '~') { out += ' '; i += 1; continue; }
    if (c !== '\\') { out += c; i += 1; continue; }
    i += 1;
    const name = commandName();
    if (name === '\\') { out += ' '; continue; }
    if (SPACES.has(name)) { out += ' '; continue; }
    if (DROPPED.has(name)) continue;
    if (name === 'left' || name === 'right') { skipSpaces(); if (peek() === '.') i += 1; continue; }
    if (GREEK[name]) { out += GREEK[name]; continue; }
    if (SYMBOLS[name]) { out += SYMBOLS[name]; continue; }
    if (FUNCTIONS.has(name)) {
      out += name;
      if (/[\\A-Za-z0-9]/.test(peek() || '')) out += ' ';
      continue;
    }
    if (name === 'lim') {
      skipSpaces();
      if (src.startsWith('\\limits', i)) { i += 7; skipSpaces(); }
      if (peek() === '_') { i += 1; out += `lim(${sub(arg()).replace(/\s+/g, '')})`; } else out += 'lim';
      continue;
    }
    if (name === 'not') {
      const next = mathPlain(arg());
      out += NEGATED[next] || `${next}̸`;
      continue;
    }
    if (FRACS.has(name)) { const a = sub(arg()); const b = sub(arg()); out += `${term(a)}/${term(b)}`; continue; }
    if (name === 'binom') { const a = sub(arg()); const b = sub(arg()); out += `C(${a}, ${b})`; continue; }
    if (name === 'sqrt') {
      const n = optional();
      const body = sub(arg());
      const index = n === null ? '' : script(sub(n), '^').replace(/^\^\((.*)\)$/, '($1)');
      out += `${index}√${[...body].length === 1 || /^\d+$/.test(body) ? body : `(${body})`}`;
      continue;
    }
    if (CONTENT.has(name)) { if (peek() === '*') i += 1; out += mathPlain(arg(), { text }); continue; }
    if (TEXT.has(name)) { out += mathPlain(arg(), { text: true }); continue; }
    if (ACCENT[name]) { out += `${sub(arg())}${ACCENT[name]}`; continue; }
    if (EVERY_CHAR[name]) { out += [...sub(arg())].map((ch) => `${ch}${EVERY_CHAR[name]}`).join(''); continue; }
    if (name === 'begin') { out += env(arg()); continue; }
    out += `\\${name}`;
  }
  return out;
}

/** `text` split on `sep` where it is outside every brace and nested environment. */
function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let j = 0; j < text.length; j += 1) {
    if (text.startsWith('\\begin{', j)) depth += 1;
    else if (text.startsWith('\\end{', j)) depth -= 1;
    if (text[j] === '\\' && !text.startsWith(sep, j)) { j += 1; continue; }
    if (text[j] === '{') depth += 1;
    else if (text[j] === '}') depth -= 1;
    else if (depth === 0 && text.startsWith(sep, j)) { out.push(text.slice(start, j)); start = j + sep.length; j += sep.length - 1; }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * A tex string as readable linear Unicode (what the app, search and the screen reader read): prose unchanged, each math
 * part converted, the delimiters removed. Deterministic; no backslash is left for supported input.
 */
export function texToPlain(str) {
  return splitTex(str).parts.map((p) => (p.type === 'math' ? squash(mathPlain(p.value)) : p.value)).join('');
}

/**
 * The letters and digits of a text as a sorted string (a multiset; order ignored, since pdftotext scrambles the order of
 * limits, fractions and superscripts): NFKD, combining marks dropped, lowercase.
 */
export const alnumBag = (text) => [...String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()].filter((c) => /[\p{L}\p{N}]/u.test(c)).sort().join('');

// ---------------------------------------------------------------- serving

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** A tex string as HTML: prose escaped, math through KaTeX. Throws on bad delimiters or a forbidden command. */
export function texHtml(str) {
  const split = splitTex(str);
  if (!split.ok) throw new Error('tex delimiters');
  if (FORBIDDEN_TEX.test(String(str))) throw new Error('tex command not allowed');
  return split.parts.map((p) => (p.type === 'text' ? escapeHtml(p.value)
    : katex.renderToString(p.value, { ...KATEX_OPTIONS, throwOnError: false, displayMode: p.display }))).join('');
}

const warned = new Set();
/**
 * A card as the server sends it. Without `tex`: unchanged. With it: `back` becomes the plain form of tex.back, line by line
 * (so every plain client reads the formula, not the pdftotext text), and `texHtml = { front?, back?: [{ text, marker?, html }] }`
 * carries the drawn form (front after cardFace's kind-prefix strip; a list line's own NCERT marker split off as the plain
 * path draws it). Anything wrong: the card without tex and texHtml (the plain stored text), logged once.
 */
export function servedTex(card, { log = console.warn } = {}) {
  if (!card || card.tex === undefined) return card;
  try {
    const { tex } = card;
    if (!TEX_SUBJECTS.includes(card.subject)) throw new Error('subject');
    if (!tex || typeof tex !== 'object' || (tex.front === undefined && tex.back === undefined)) throw new Error('form');
    const out = { ...card, texHtml: {} };
    if (tex.back !== undefined) {
      const lines = texLines(tex.back);
      if (lines.length !== texLines(card.back).length) throw new Error('line count');
      const listed = LIST_KINDS.includes(card.kind) && lines.length > 1;
      out.texHtml.back = lines.map((line) => {
        const text = texToPlain(line);
        if (text.includes('\\')) throw new Error('unknown command');
        const own = listed ? ownMarker(text) : null;
        if (own && line.startsWith(own[0])) return { text, marker: own[0], html: texHtml(line.slice(own[0].length).trimStart()) };
        return { text, html: texHtml(line) };
      });
      out.back = out.texHtml.back.map((r) => r.text).join('\n');
    }
    if (tex.front !== undefined) out.texHtml.front = texHtml(stripKindPrefix(card.kind, tex.front));
    return out;
  } catch (error) {
    if (!warned.has(card.id)) { warned.add(card.id); log(`[keycards] ${card.id}: tex not served (${error.message}); the plain card stands`); }
    const { tex: _tex, texHtml: _html, ...plain } = card;
    return plain;
  }
}
