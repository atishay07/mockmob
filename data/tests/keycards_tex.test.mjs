// Key cards: typeset formulas (handoff-1102/MATHTEX-SPEC.md sections 2, 3, 4, 5 and 7). The tex module (data/keycards_tex.js),
// the validator's texCheck (scripts/keycards/lib.mjs), the server's servedTex and loadDecks, the tex-show bag difference, and
// the row shapes the web draws a typeset back with (src/components/keycards/kinds.js texBackRows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { FORBIDDEN_TEX, KATEX_OPTIONS, TEX_SUBJECTS, alnumBag, servedTex, splitTex, texHtml, texLines, texToPlain } from '../keycards_tex.js';
import { shapeCheck, texCheck } from '../../scripts/keycards/lib.mjs';
import { bagMinus, showCard } from '../../scripts/keycards/tex-show.mjs';
import { loadDecks } from '../../src/lib/server/keycards.js';
import { cardFace, texBackRows } from '../../src/components/keycards/kinds.js';

// A Mathematics formula card that passes every check: its back is the quote (as pdftotext reads the page), its tex the
// typeset form of the same text.
const BACK = 'sin-1 x : [-1, 1] → [-π/2, π/2]';
const math = (over = {}) => ({
  id: 'kc.mathematics.inverse-trigonometric-functions.formula-sin-inverse', v: 1, subject: 'mathematics',
  chapterKey: 'mathematics.inverse-trigonometric-functions', chapter: 'Inverse Trigonometric Functions', unit: 'Relations and Functions',
  kind: 'formula', front: 'Formula: Principal value branch of sin-1 x', back: BACK, quote: BACK, blanks: [], importance: 'must', asked: 0,
  tags: [], order: 10, source: { kind: 'ncert', book: 'Mathematics Part I', code: 'lemh102', chapterNo: 2, page: 20 },
  tex: { front: 'Formula: Principal value branch of $\\sin^{-1} x$', back: '$\\sin^{-1} x : [-1, 1] \\to \\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$' },
  ...over,
});
const withTex = (tex, over = {}) => math({ ...over, tex });

// ---------------------------------------------------------------- constants

test('the tex subjects, the KaTeX options and the forbidden commands', () => {
  assert.deepEqual([...TEX_SUBJECTS], ['mathematics', 'physics']);
  assert.deepEqual({ ...KATEX_OPTIONS }, { throwOnError: true, strict: 'error', trust: false, maxExpand: 200, maxSize: 20, output: 'htmlAndMathml' });
  for (const cmd of ['href', 'url', 'includegraphics', 'htmlClass', 'htmlData', 'def', 'gdef', 'edef', 'xdef', 'let', 'futurelet', 'newcommand', 'renewcommand',
    'providecommand', 'char', 'color', 'textcolor', 'colorbox', 'fcolorbox', 'raisebox', 'rule', 'class', 'style', 'data']) {
    assert.ok(FORBIDDEN_TEX.test(`$\\${cmd}{x}$`), cmd);
  }
  assert.ok(FORBIDDEN_TEX.test('$\\char65$'), '\\char with a number');
  for (const ok of ['\\left(', '\\leq', '\\le', '\\lambda', '\\cdot', '\\dagger', '\\colon', '\\urcorner', '\\chi', '\\leftarrow']) assert.ok(!FORBIDDEN_TEX.test(`$${ok}$`), ok);
});

test('texHtml: FORBIDDEN_TEX itself refuses every forbidden command, before KaTeX sees it', () => {
  const real = katex.renderToString;
  const seen = [];
  katex.renderToString = (src, opts) => { seen.push(src); return real(src, opts); };
  try {
    for (const cmd of ['\\href{javascript:alert(1)}{x}', '\\url{x}', '\\htmlClass{a}{x}', '\\def\\a{b}', '\\futurelet\\a\\b', '\\char65', '\\color{red}{x}']) {
      assert.throws(() => texHtml(`$x + ${cmd}$`), /not allowed/, cmd);
    }
    assert.deepEqual(seen, [], 'nothing reached renderToString');
  } finally {
    katex.renderToString = real;
  }
  assert.throws(() => texHtml('$x'), /delimiters/);
});

// ---------------------------------------------------------------- splitTex

test('splitTex: inline, display, mixed', () => {
  assert.deepEqual(splitTex('Area $A = \\pi r^2$ of a circle'), { ok: true, parts: [
    { type: 'text', value: 'Area ', display: false }, { type: 'math', value: 'A = \\pi r^2', display: false }, { type: 'text', value: ' of a circle', display: false },
  ] });
  assert.deepEqual(splitTex('$$\\int_a^b f(x)\\,dx$$'), { ok: true, parts: [{ type: 'math', value: '\\int_a^b f(x)\\,dx', display: true }] });
  const mixed = splitTex('Here $x$ and\n$$y = 2$$\nthen $z$');
  assert.equal(mixed.ok, true);
  assert.deepEqual(mixed.parts.filter((p) => p.type === 'math').map((p) => [p.value, p.display]), [['x', false], ['y = 2', true], ['z', false]]);
  assert.deepEqual(splitTex('no math at all'), { ok: true, parts: [{ type: 'text', value: 'no math at all', display: false }] });
});

test('splitTex: unbalanced, empty, display not alone on its line, a line break inside math', () => {
  assert.equal(splitTex('$x + 1').ok, false, 'unclosed $');
  assert.equal(splitTex('$$x + 1').ok, false, 'unclosed $$');
  assert.equal(splitTex('a $ $ b').ok, false, 'empty inline');
  assert.equal(splitTex('a\n$$  $$').ok, false, 'empty display');
  assert.equal(splitTex('So $$x = 1$$').ok, false, 'prose before display on its line');
  assert.equal(splitTex('$$x = 1$$ so').ok, false, 'prose after display on its line');
  assert.equal(splitTex('$x\n+ 1$').ok, false, 'line break inside inline math');
  assert.equal(splitTex('$$x\n= 1$$').ok, false, 'line break inside display math');
});

// ---------------------------------------------------------------- texToPlain

test('texToPlain: prose unchanged, delimiters removed, minus as U+2212 in math only', () => {
  assert.equal(texToPlain('Area of a circle - $\\pi r^2$'), 'Area of a circle - π r²');
  assert.equal(texToPlain('$$a - b$$'), 'a − b');
  assert.equal(texToPlain('no math - here'), 'no math - here');
});

test('texToPlain: one row per mapping, with NCERT-shaped inputs', () => {
  const rows = [
    // Greek letters and variants
    ['$\\alpha + \\beta$', 'α + β'], ['$\\theta, \\phi, \\varphi$', 'θ, φ, φ'], ['$\\lambda \\mu \\sigma$', 'λ μ σ'], ['$\\Delta, \\omega, \\pi$', 'Δ, ω, π'],
    ['$\\varepsilon \\epsilon$', 'ε ε'], ['$\\gamma\\delta$', 'γδ'],
    // relations and operators
    ['$x \\to a$', 'x → a'], ['$A \\rightarrow B$', 'A → B'], ['$p \\Rightarrow q$', 'p ⇒ q'], ['$p \\Leftrightarrow q$', 'p ⇔ q'],
    ['$x \\in A, y \\notin A$', 'x ∈ A, y ∉ A'], ['$A \\subset B \\subseteq C$', 'A ⊂ B ⊆ C'], ['$A \\cup B \\cap C$', 'A ∪ B ∩ C'],
    ['$a \\le b \\leq c$', 'a ≤ b ≤ c'], ['$a \\ge b \\geq c$', 'a ≥ b ≥ c'], ['$a \\ne b \\neq c$', 'a ≠ b ≠ c'], ['$\\pi \\approx 3.14$', 'π ≈ 3.14'],
    ['$\\pm 1, \\mp 1$', '± 1, ∓ 1'], ['$a \\times b$', 'a × b'], ['$\\vec{a} \\cdot \\vec{b}$', 'a\u20D7 · b\u20D7'], ['$a \\div b$', 'a ÷ b'], ['$(-\\infty, \\infty)$', '(−∞, ∞)'],
    ['$f \\circ g$', 'f ∘ g'], ['$90^\\circ$', '90°'], ['$\\angle ABC$', '∠ ABC'], ['$l \\perp m, l \\parallel n$', 'l ⊥ m, l ∥ n'],
    ['$1, 2, \\ldots, n$', '1, 2, …, n'], ['$a_1, \\dots, a_n$', 'a₁, …, aₙ'], ['$1 + 2 + \\cdots$', '1 + 2 + …'],
    ['$\\forall x \\exists y$', '∀ x ∃ y'], ['$\\emptyset = \\varnothing$', '∅ = ∅'], ['$\\{x \\mid x > 0\\}$', '{x | x > 0}'], ['$\\vert x \\vert$', '|x|'],
    ['$\\|\\vec{a}\\|$', '‖a\u20D7‖'], ['$x - y$', 'x − y'], ['$A \\setminus B$', 'A ∖ B'], ['$a \\equiv b$', 'a ≡ b'],
    // functions
    ['$\\sin x + \\cos x$', 'sin x + cos x'], ['$\\tan x, \\cot x, \\sec x, \\csc x$', 'tan x, cot x, sec x, csc x'], ['$\\cosec x$', 'cosec x'],
    ['$\\log x, \\ln x, \\exp x$', 'log x, ln x, exp x'], ['$\\max f, \\min f$', 'max f, min f'], ['$\\det A$', 'det A'], ['$\\operatorname{cosec} x$', 'cosec x'],
    ['$\\cos\\theta$', 'cos θ'], ['$\\sin^{-1}x$', 'sin⁻¹x'], ['$\\tan^{-1} x$', 'tan⁻¹ x'], ['$\\log_e x$', 'logₑ x'],
    // scripts
    ['$e^{x}$', 'eˣ'], ['$x^2 + y^2$', 'x² + y²'], ['$a^{n-1}$', 'aⁿ⁻¹'], ['$x_1 + x_2$', 'x₁ + x₂'], ['$A^{-1}$', 'A⁻¹'], ['$e^{\\pi}$', 'e^(π)'],
    ['$x_{y}$', 'x_(y)'], ["$f'(x)$", 'f′(x)'], ["$f''(x)$", 'f′′(x)'], ['$f^\\prime(x)$', 'f′(x)'], ['$a_{ij}$', 'aᵢⱼ'],
    // fractions
    ['$\\frac{\\pi}{2}$', 'π/2'], ['$\\frac{a + b}{c - d}$', '(a + b)/(c − d)'], ['$\\dfrac{1}{2}$', '1/2'], ['$\\tfrac{x}{y}$', 'x/y'],
    ['$\\frac{d}{dx}$', 'd/dx'], ['$\\frac{dy}{dx}$', 'dy/dx'], ['$\\frac{d^2y}{dx^2}$', 'd²y/dx²'],
    // roots
    ['$\\sqrt{x}$', '√x'], ['$\\sqrt{x^2 + 1}$', '√(x² + 1)'], ['$\\sqrt[n]{x}$', 'ⁿ√x'], ['$\\sqrt[3]{8}$', '³√8'], ['$\\sqrt{2}$', '√2'],
    // integrals, sums, products, limits
    ['$\\int_a^b f(x)\\,dx$', '∫ₐᵇ f(x) dx'], ['$\\int_0^{\\pi/2} \\sin x\\,dx$', '∫₀^(π/2) sin x dx'], ['$\\int f(x)\\,dx$', '∫ f(x) dx'],
    ['$\\iint$', '∬'], ['$\\sum_{i=1}^{n} x_i$', '∑ᵢ₌₁ⁿ xᵢ'], ['$\\prod_{i=1}^{n} a_i$', '∏ᵢ₌₁ⁿ aᵢ'],
    ['$\\lim_{x \\to a} f(x)$', 'lim(x→a) f(x)'], ['$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$', 'lim(x→0) (sin x)/x = 1'],
    ['$\\lim\\limits_{h \\to 0}$', 'lim(h→0)'],
    // fonts, words and accents
    ['$\\mathbf{R} - (-1, 1)$', 'R − (−1, 1)'], ['$\\mathbb{R}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}, \\mathbb{C}$', 'R, N, Z, Q, C'],
    ['$\\mathrm{d}x$', 'dx'], ['$x \\text{ if } x > 0$', 'x if x > 0'], ['$\\textrm{area}$', 'area'], ['$\\mathit{AB}$', 'AB'],
    ['$\\vec{a}$', 'a\u20D7'], ['$\\overrightarrow{AB}$', 'AB\u20D7'], ['$\\hat{i} + \\hat{j}$', 'i\u0302 + j\u0302'], ['$\\bar{x}$', 'x\u0304'],
    ['$\\overline{AB}$', 'A\u0305B\u0305'],
    // brackets and spacing
    ['$\\left( \\frac{a}{b} \\right)$', '(a/b)'], ['$\\left| x \\right|$', '|x|'], ['$\\left. f \\right|_a$', 'f |ₐ'], ['$\\big( x \\big)$', '(x)'],
    ['$\\displaystyle \\frac{1}{x}$', '1/x'], ['$a\\,b\\;c\\:d\\!e\\quad f\\qquad g~h$', 'a b c de f g h'], ['$\\{1, 2\\}$', '{1, 2}'],
    ['$\\lbrace a \\rbrace$', '{a}'], ['$\\langle a, b \\rangle$', '⟨ a, b ⟩'], ['$\\lvert x \\rvert$', '|x|'],
    ['$\\{ a, b \\}$', '{a, b}'], ['$\\left| \\frac{a}{b} \\right|$', '|a/b|'], ['$|x| - 1$', '|x| − 1'],
    // matrices and cases
    ['$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$', '[a, b; c, d]'], ['$\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$', '|1, 2; 3, 4|'],
    ['$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$', '[1, 0; 0, 1]'], ['$\\begin{matrix} x & y \\end{matrix}$', '[x, y]'],
    ['$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$', '[1, 2; 3, 4]'],
    // a cell with an operator is bracketed, as a fraction part is; an array adds no brackets of its own; row spacing never leaks
    ['$\\begin{bmatrix} x + 1 & 2 \\\\ 3 & y - 1 \\end{bmatrix}$', '[(x + 1), 2; 3, (y − 1)]'],
    ['$\\begin{array}{cc} 1 & -1 \\\\ 2 & 3 \\end{array}$', '1, −1; 2, 3'], ['$\\left[\\begin{array}{cc} 1 & 2 \\\\ 3 & 4 \\end{array}\\right]$', '[1, 2; 3, 4]'],
    ['$\\left|\\begin{array}{cc} a & b \\\\ c & d \\end{array}\\right|$', '|a, b; c, d|'],
    ['$\\begin{bmatrix} 1 & 2 \\\\[2pt] 3 & 4 \\end{bmatrix}$', '[1, 2; 3, 4]'], ['$\\begin{vmatrix} a_{11} & a_{12} \\\\[1em] a_{21} & a_{22} \\end{vmatrix}$', '|a₁₁, a₁₂; a₂₁, a₂₂|'],
    ['$\\begin{aligned} a &= b \\\\ &= c \\end{aligned}$', 'a = b; = c'],
    ['$f(x) = \\begin{cases} x, & \\text{if } x \\ge 0 \\\\ -x, & \\text{if } x < 0 \\end{cases}$', 'f(x) = { x, if x ≥ 0; −x, if x < 0'],
    ['$\\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}$', '{ 1, x > 0; 0, x ≤ 0'],
    // negation
    ['$x \\not\\in A$', 'x ∉ A'], ['$a \\not= b$', 'a ≠ b'],
  ];
  for (const [tex, plain] of rows) assert.equal(texToPlain(tex), plain, tex);
});

test('texToPlain: a fraction part stays bare only when it is one number, one letter or a differential; the whole fraction is bracketed beside a factor', () => {
  const rows = [
    // the parts
    ['$\\frac{-1}{2}$', '−1/2'], ['$\\frac{1}{2a}$', '1/(2a)'], ['$\\frac{\\sin x}{x}$', '(sin x)/x'], ['$\\frac{x^2}{2}$', '(x²)/2'],
    ['$\\frac{a_1}{\\theta\'}$', 'a₁/θ′'], ['$\\frac{\\vec{a}}{2}$', 'a⃗/2'], ['$\\frac{1.5}{x}$', '1.5/x'], ['$\\frac{dy}{dx} = 2$', 'dy/dx = 2'],
    ['$\\frac{x-a}{x+a}$', '(x − a)/(x + a)'], ['$(2n + 1)\\frac{\\pi}{2}, n$', '(2n + 1)π/2, n'],
    // the whole fraction: after a function (and its ^{-1} or power form), after a script, before a factor
    ['$\\tan^{-1} \\frac{x + y}{1 - xy}$', 'tan⁻¹((x + y)/(1 − xy))'], ['$\\tan\\frac{x}{2}$', 'tan(x/2)'], ['$\\sin^2\\frac{x}{2}$', 'sin²(x/2)'],
    ['$\\log_e \\frac{1}{x}$', 'logₑ(1/x)'], ['$\\int_0^1 \\frac{1}{x}\\,dx$', '∫₀¹ (1/x) dx'], ['$\\frac{1}{2}x$', '(1/2)x'], ['$\\frac{1}{2} x$', '(1/2) x'],
    ['$\\frac{1}{2}(x + 1)$', '(1/2)(x + 1)'], ['$\\frac{1}{2}\\left(x + 1\\right)$', '(1/2)(x + 1)'], ['$\\frac{1}{2}|x|$', '(1/2)|x|'],
    ['$\\frac{1}{2}\\sqrt{x}$', '(1/2)√x'], ['$\\frac{1}{2}\\pi$', '(1/2)π'], ['$\\frac{a}{b}^2$', '(a/b)²'],
    ['$\\frac{1}{2a}\\log\\left|\\frac{x-a}{x+a}\\right| + C$', '(1/(2a)) log |(x − a)/(x + a)| + C'],
    // not before an operator, a relation, a closer or the end
    ['$\\frac{1}{2} + x$', '1/2 + x'], ['$\\frac{1}{2} \\cdot x$', '1/2 · x'], ['$\\frac{1}{2} \\le x$', '1/2 ≤ x'], ['$\\left[0, \\frac{\\pi}{2}\\right]$', '[0, π/2]'],
    ['$|\\frac{a}{b}|$', '|a/b|'], ['$x = \\frac{\\pi}{2}$', 'x = π/2'],
    // a digit before a fraction is a mixed number
    ['$2\\frac{3}{4}$', '2 3/4'],
  ];
  for (const [tex, plain] of rows) assert.equal(texToPlain(tex), plain, tex);
});

test('texToPlain: smaller readings (\\sin{x}, capital superscripts, aligned, bars and braces, ∑ and ∏)', () => {
  const rows = [
    ['$\\sin{x}$', 'sin x'], ['$\\cos{\\theta}$', 'cos θ'], ['$2\\sin x$', '2 sin x'],
    ['$A^T$', 'Aᵀ'], ['$A^{T}B$', 'AᵀB'], ['$X^{ABDEGHIJKLMNOPRTUVW}$', 'Xᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ'], ['$A^{C}$', 'A^(C)'],
    ['$\\begin{aligned} a &= b \\end{aligned}$', 'a = b'],
    ['$\\{a, b\\}$', '{a, b}'], ['$\\left\\{ \\frac{\\pi}{2} \\right\\}$', '{π/2}'], ['$\\left| x - 1 \\right|$', '|x − 1|'],
    ['$\\sum x$', '∑ x'], ['$\\prod a$', '∏ a'],
    ['$f(x) = \\begin{cases} a, & \\text{if } x \\ge 0 \\\\ b, & \\text{if } x < 0 \\end{cases}$', 'f(x) = { a, if x ≥ 0; b, if x < 0'],
    ['$\\begin{cases} 1, & x \\in \\{0\\} \\\\[2pt] 0, & x \\ne 0 \\end{cases}$', '{ 1, x ∈ {0}; 0, x ≠ 0'],
  ];
  for (const [tex, plain] of rows) assert.equal(texToPlain(tex), plain, tex);
  // \binom is no longer read: an author writes NCERT's own {}^{n}C_{r}, and \binom falls to shape:tex_plain.
  assert.ok(texToPlain('$\\binom{n}{r}$').includes('\\binom'));
  assert.equal(texToPlain('${}^{n}C_{r}$'), 'ⁿCᵣ');
});

test('texToPlain: deterministic, no backslash for supported input, an unknown command kept with its backslash', () => {
  const s = 'If $f(x) = \\frac{\\sin x}{x}$ then $\\lim_{x \\to 0} f(x) = 1$';
  assert.equal(texToPlain(s), texToPlain(s));
  assert.ok(!texToPlain(s).includes('\\'));
  assert.equal(texToPlain('$\\foo x$'), '\\foo x');
  assert.equal(texToPlain('$\\overset{a}{b}$').includes('\\overset'), true);
});

// ---------------------------------------------------------------- alnumBag

test('alnumBag: diacritics and combining arrows dropped, order ignored, superscripts read as digits', () => {
  assert.equal(alnumBag('a\u20D7 · b\u20D7'), alnumBag('ab'));
  assert.equal(alnumBag('i\u0302 + j\u0302'), 'ij');
  assert.equal(alnumBag('Café'), alnumBag('cafe'));
  assert.equal(alnumBag('∫ₐᵇ f(x) dx'), alnumBag('f(x)dx b a'));
  assert.equal(alnumBag('sin⁻¹ x'), alnumBag('x sin-1'));
  assert.equal(alnumBag('x² + 1 = y'), '12xy');
  assert.equal(alnumBag(''), '');
});

test('alnumBag: real pdftotext strings match their tex (spacing hat, ∆, Symbol-font ∈ and prime)', () => {
  const rows = [
    ['xiˆ + yˆj + zkˆ', '$x\\hat{i} + y\\hat{j} + z\\hat{k}$'],
    ['∆ = 0', '$\\Delta = 0$'],
    ['x Î (a, b)', '$x \\in (a, b)$'],
    ['f ¢(x) > 0', "$f'(x) > 0$"],
    ['p Þ q', '$p \\Rightarrow q$'],
    ['∑ xi', '$\\sum x_i$'],
  ];
  for (const [pdf, tex] of rows) assert.equal(alnumBag(texToPlain(tex)), alnumBag(pdf), pdf);
  assert.equal(alnumBag('xiˆ'), 'ix');
  assert.equal(alnumBag('∆'), alnumBag('Δ'));
  assert.notEqual(alnumBag('x Î A'), alnumBag('x ∈ B'), 'a real letter still counts');
});

// ---------------------------------------------------------------- texCheck

test('texCheck: the passing card, and shapeCheck runs it', () => {
  assert.deepEqual(texCheck(math(), 'mathematics'), []);
  assert.deepEqual(shapeCheck(math(), 'mathematics'), []);
  const bad = shapeCheck(withTex({ back: '$x$' }), 'mathematics');
  assert.ok(bad.includes('shape:tex_mismatch'), 'shapeCheck carries texCheck reasons');
  const { tex: _tex, ...plain } = math();
  assert.deepEqual(shapeCheck(plain, 'mathematics'), [], 'a card without tex: unchanged');
});

test('texCheck: shape:tex_form', () => {
  for (const tex of ['$x$', null, [], {}, { front: '$a$', other: '$b$' }, { front: '' }, { front: '  ' }, { back: 3 }, { front: undefined }]) {
    assert.deepEqual(texCheck(withTex(tex), 'mathematics'), ['shape:tex_form'], JSON.stringify(tex));
  }
  assert.ok(!texCheck(withTex({ back: math().tex.back }), 'mathematics').includes('shape:tex_form'), 'back alone');
  assert.ok(!texCheck(withTex({ front: math().tex.front }), 'mathematics').includes('shape:tex_form'), 'front alone');
});

test('texCheck: shape:tex_subject', () => {
  assert.ok(texCheck(math({ subject: 'economics' }), 'economics').includes('shape:tex_subject'));
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_subject'));
  assert.ok(!texCheck(math({ subject: 'physics' }), 'physics').includes('shape:tex_subject'));
});

test('texCheck: shape:tex_kind', () => {
  assert.ok(texCheck(math({ kind: 'term' }), 'mathematics').includes('shape:tex_kind'));
  assert.ok(texCheck(math({ kind: 'key_line' }), 'mathematics').includes('shape:tex_kind'));
  assert.ok(texCheck(math({ kind: 'definition', blanks: ['branch'] }), 'mathematics').includes('shape:tex_kind'));
  assert.ok(!texCheck(math({ kind: 'definition' }), 'mathematics').includes('shape:tex_kind'));
});

test('texCheck: shape:tex_delims', () => {
  assert.ok(texCheck(withTex({ back: '$\\sin^{-1} x : [-1, 1] \\to [-\\pi/2, \\pi/2]' }), 'mathematics').includes('shape:tex_delims'));
  assert.ok(texCheck(withTex({ front: math().front }), 'mathematics').includes('shape:tex_delims'), 'no math part at all');
  assert.ok(texCheck(withTex({ back: `${BACK} $$x$$` }), 'mathematics').includes('shape:tex_delims'), 'display not alone on its line');
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_delims'));
});

test('texCheck: shape:tex_command, and a forbidden command never reaches KaTeX', () => {
  const real = katex.renderToString;
  const seen = [];
  katex.renderToString = (src, opts) => { seen.push(src); return real(src, opts); };
  try {
    const r = texCheck(withTex({ front: 'Formula: Principal value branch of $\\href{https://x.y}{\\sin^{-1} x}$' }), 'mathematics');
    assert.ok(r.includes('shape:tex_command'));
    assert.ok(!seen.some((s) => s.includes('\\href')), 'not rendered');
    for (const cmd of ['\\def\\a{b}\\a', '\\color{red}{x}', '\\htmlClass{a}{x}', '\\includegraphics{x}']) {
      assert.ok(texCheck(withTex({ back: `$${cmd}$` }), 'mathematics').includes('shape:tex_command'), cmd);
    }
  } finally {
    katex.renderToString = real;
  }
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_command'));
});

test('texCheck: shape:tex_parse (KaTeX strict)', () => {
  assert.ok(texCheck(withTex({ back: '$\\sin^{-1} x : [-1, 1] \\to [-\\frac{\\pi}{2, \\frac{\\pi}{2}]$' }), 'mathematics').includes('shape:tex_parse'), 'missing brace');
  assert.ok(texCheck(withTex({ back: '$\\sin^{-1} x : [-1, 1] \\to [-\\pi/2, \\pi/2]^$' }), 'mathematics').includes('shape:tex_parse'), 'empty script');
  assert.ok(texCheck(withTex({ back: '$é$' }), 'mathematics').includes('shape:tex_parse'), 'strict: accented text in math');
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_parse'));
});

test('texCheck: shape:tex_too_long', () => {
  const long = `Formula: Principal value branch of $\\sin^{-1} x$${' '.repeat(400)}`;
  assert.ok(texCheck(withTex({ front: long }), 'mathematics').includes('shape:tex_too_long'), 'tex.front over 400');
  const many = Array.from({ length: 160 }, () => 'x').join(' + ');
  const back = many.replace(/ \+ /g, '+');
  assert.ok(texCheck(math({ back, quote: back, tex: { back: `$$${many}$$` } }), 'mathematics').includes('shape:tex_too_long'), 'plain back over 450');
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_too_long'));
  // tex.back over 1,500 although its plain form is short (spacing is not read).
  const padded = `$$x${'\\,'.repeat(760)}$$`;
  assert.ok(padded.length > 1500 && texToPlain(padded).length < 450);
  assert.ok(texCheck(math({ back: 'x', quote: 'x', tex: { back: padded } }), 'mathematics').includes('shape:tex_too_long'), 'tex.back over 1,500');
  assert.ok(!texCheck(math({ back: 'x', quote: 'x', tex: { back: `$$x${'\\,'.repeat(700)}$$` } }), 'mathematics').includes('shape:tex_too_long'), 'tex.back at 1,406');
  // The plain front over 150 although tex.front is under 400.
  const words = Array.from({ length: 40 }, (_, k) => `a_${k % 10}`).join(' + ');
  const front = `Sum $${words}$`;
  assert.ok(front.length <= 400 && texToPlain(front).length > 150);
  assert.ok(texCheck(withTex({ front }, { front: texToPlain(front) }), 'mathematics').includes('shape:tex_too_long'), 'plain front over 150');
  // A list's plain back may run to 750; a formula's stops at 450.
  const listOf = (n, kind = 'list') => {
    const tex = Array.from({ length: n }, (_, k) => `(${k + 1}) $x_${k % 10} + y_${k % 10} + z_${k % 10}$`);
    const backText = tex.map(texToPlain).join('\n');
    return math({ kind, front: 'The rows', back: backText, quote: backText, tex: { back: tex.join('\n') } });
  };
  const mid = listOf(30);
  assert.ok(mid.back.length > 450 && mid.back.length <= 750, String(mid.back.length));
  assert.ok(!texCheck(mid, 'mathematics').includes('shape:tex_too_long'), 'a list between 450 and 750');
  assert.ok(texCheck(listOf(30, 'formula'), 'mathematics').includes('shape:tex_too_long'), 'a formula over 450');
  const over = listOf(45);
  assert.ok(over.back.length > 750, String(over.back.length));
  assert.ok(texCheck(over, 'mathematics').includes('shape:tex_too_long'), 'a list over 750');
});

test('texCheck: shape:tex_inline_long (a long inline formula, or an inline matrix, array, cases or aligned)', () => {
  const long = '$a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8 + a_9 + a_0 + b$';
  assert.ok([...texToPlain(long)].length > 40);
  const back = texToPlain(long);
  assert.ok(texCheck(math({ back, quote: back, tex: { back: long } }), 'mathematics').includes('shape:tex_inline_long'), 'inline over 40');
  assert.ok(!texCheck(math({ back, quote: back, tex: { back: `$${long}$` } }), 'mathematics').includes('shape:tex_inline_long'), 'the same on a display line');
  const short = '$a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8xyz$'; // 40 characters plain
  assert.equal([...texToPlain(short)].length, 40);
  assert.ok(!texCheck(math({ back: texToPlain(short), quote: texToPlain(short), tex: { back: short } }), 'mathematics').includes('shape:tex_inline_long'));
  for (const grid of ['\\begin{bmatrix} 1 & 2 \\end{bmatrix}', '\\begin{vmatrix} 1 & 2 \\end{vmatrix}', '\\left[\\begin{array}{cc} 1 & 2 \\end{array}\\right]',
    '\\begin{cases} 1, & x > 0 \\\\ 2, & x \\le 0 \\end{cases}', '\\begin{aligned} a &= 1 \\end{aligned}']) {
    const t = `So $${grid}$`;
    const b = texToPlain(t);
    assert.ok(texCheck(math({ kind: 'fact', back: b, quote: b, tex: { back: t } }), 'mathematics').includes('shape:tex_inline_long'), grid);
    const d = `So\n$$${grid}$$`;
    const db = `So\n${texToPlain(`$${grid}$`)}`;
    assert.ok(!texCheck(math({ kind: 'fact', back: db, quote: db, tex: { back: d } }), 'mathematics').includes('shape:tex_inline_long'), `${grid} on its own line`);
  }
  assert.ok(texCheck(withTex({ front: `Formula: Principal value branch of ${long}` }, { front: `Formula: Principal value branch of ${back}` }), 'mathematics').includes('shape:tex_inline_long'), 'in tex.front too');
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_inline_long'));
});

test('texCheck: shape:tex_plain', () => {
  assert.ok(texCheck(withTex({ back: '$\\overset{a}{b}$' }), 'mathematics').includes('shape:tex_plain'));
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_plain'));
});

test('texCheck: shape:tex_lines', () => {
  assert.ok(texCheck(withTex({ back: `${math().tex.back}\n$x$` }), 'mathematics').includes('shape:tex_lines'));
  assert.ok(!texCheck(withTex({ back: `${math().tex.back}\n\n` }), 'mathematics').includes('shape:tex_lines'), 'blank lines ignored');
});

test('texCheck: shape:tex_mismatch (back line and front)', () => {
  assert.ok(texCheck(withTex({ back: '$\\sin^{-1} y : [-1, 1] \\to [-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$' }), 'mathematics').includes('shape:tex_mismatch'), 'wrong letter');
  assert.ok(texCheck(withTex({ back: '$\\sin^{-1} x : [-1, 1] \\to [-\\frac{\\pi}{3}, \\frac{\\pi}{2}]$' }), 'mathematics').includes('shape:tex_mismatch'), 'wrong digit');
  assert.ok(texCheck(withTex({ front: 'Formula: Principal value branch of $\\cos^{-1} x$', back: math().tex.back }), 'mathematics').includes('shape:tex_mismatch'), 'front');
  // Order and signs are not the machine's to check: a reordered formula passes here (the image reviewer reads it).
  assert.ok(!texCheck(withTex({ back: '$\\sin^{-1} x : [1, -1] \\to [\\frac{\\pi}{2}, -\\frac{\\pi}{2}]$' }), 'mathematics').includes('shape:tex_mismatch'));
});

test('texCheck: shape:tex_prose', () => {
  const back = 'ab = c';
  assert.ok(texCheck(math({ back, quote: back, tex: { back: 'ba $= c$' } }), 'mathematics').includes('shape:tex_prose'), 'prose not in the back line');
  assert.ok(!texCheck(math({ back, quote: back, tex: { back: 'ab $= c$' } }), 'mathematics').includes('shape:tex_prose'));
});

// ---------------------------------------------------------------- servedTex

const LIST_BACK = '(i) sin-1 (-x) = - sin-1 x\n(ii) cos-1 (-x) = π - cos-1 x';
const listCard = (over = {}) => math({
  id: 'kc.mathematics.inverse-trigonometric-functions.list-odd', kind: 'list', front: 'Two identities for negative arguments', back: LIST_BACK, quote: LIST_BACK,
  tex: { back: '(i) $\\sin^{-1}(-x) = -\\sin^{-1} x$\n(ii) $\\cos^{-1}(-x) = \\pi - \\cos^{-1} x$' }, ...over,
});

test('servedTex: a card without tex is returned unchanged', () => {
  const { tex: _tex, ...plain } = math();
  assert.equal(servedTex(plain), plain);
  assert.equal(servedTex(null), null);
});

test('servedTex: plain back line by line, the front kept, the HTML with its MathML copy', () => {
  const out = servedTex(math());
  assert.equal(out.back, 'sin⁻¹ x : [−1, 1] → [−π/2, π/2]');
  assert.equal(out.front, math().front, 'the stored front stays');
  assert.equal(out.texHtml.back.length, 1);
  assert.equal(out.texHtml.back[0].text, out.back);
  assert.match(out.texHtml.back[0].html, /katex-mathml/);
  // The front's html after cardFace's kind-prefix strip ("Formula: ").
  assert.ok(out.texHtml.front.startsWith('Principal value branch of '), out.texHtml.front.slice(0, 40));
  assert.equal(cardFace(out).front, 'Principal value branch of sin-1 x');
});

test('servedTex: the payload is texHtml and the plain back only (no raw tex, no TeX source annotation; quotes printed)', () => {
  const out = servedTex(math());
  assert.equal(out.tex, undefined, 'the raw tex is not served');
  assert.ok(!('tex' in out));
  const html = [out.texHtml.front, ...out.texHtml.back.map((r) => r.html)].join('');
  assert.ok(!/<annotation\b/.test(html), 'no <annotation>');
  assert.ok(!html.includes('\\sin'), 'no TeX source anywhere');
  assert.match(html, /<math\b[\s\S]*<semantics>[\s\S]*<\/semantics><\/math>/, 'the rest of the MathML stays for screen readers');
  assert.match(html, /katex-html/);
  assert.equal(texHtml('$x$').match(/<annotation/g), null);
  // printQuotes (data/keycards.js) on the plain back and in the drawn prose, as printedCard prints a plain card.
  const back = 'the `principal value branch\' of sin-1 x';
  const q = servedTex(math({ kind: 'fact', back, quote: back, tex: { back: 'the `principal value branch\' of $\\sin^{-1} x$' } }));
  assert.equal(q.back, 'the ‘principal value branch’ of sin⁻¹ x');
  assert.equal(q.texHtml.back[0].text, q.back);
  assert.ok(q.texHtml.back[0].html.startsWith('the ‘principal value branch’ of '));
});

test('servedTex: list lines keep their count and their own NCERT marker', () => {
  const out = servedTex(listCard());
  assert.equal(out.back.split('\n').length, 2);
  assert.deepEqual(out.texHtml.back.map((r) => [r.text, r.marker]), [['(i) sin⁻¹(−x) = −sin⁻¹ x', '(i)'], ['(ii) cos⁻¹(−x) = π − cos⁻¹ x', '(ii)']]);
  assert.ok(!out.texHtml.back[0].html.includes('(i)'), 'the marker is not drawn twice');
  // A formula line is not a list: no marker split.
  const f = servedTex(math({ kind: 'formula', back: LIST_BACK, quote: LIST_BACK, tex: listCard().tex }));
  assert.ok(f.texHtml.back.every((r) => r.marker === undefined));
});

test('servedTex: prose is escaped', () => {
  const back = 'If <script>alert(1)</script> & "x" then y';
  const out = servedTex(math({ kind: 'fact', back, quote: back, tex: { back: 'If <script>alert(1)</script> & "x" then $y$' } }));
  assert.ok(!out.texHtml.back[0].html.includes('<script>'));
  assert.ok(out.texHtml.back[0].html.startsWith('If &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; then '));
});

test('servedTex: anything wrong serves the plain stored card, logged once, and a forbidden command never reaches KaTeX', () => {
  const real = katex.renderToString;
  const seen = [];
  katex.renderToString = (src, opts) => { seen.push(src); return real(src, opts); };
  const logs = [];
  const log = (line) => logs.push(line);
  try {
    const bad = math({ id: 'kc.mathematics.inverse-trigonometric-functions.formula-bad', tex: { back: '$\\href{javascript:alert(1)}{x}$' } });
    const out = servedTex(bad, { log });
    assert.equal(out.tex, undefined);
    assert.equal(out.texHtml, undefined);
    assert.equal(out.back, BACK, 'the plain stored back');
    assert.ok(!seen.some((s) => s.includes('\\href')));
    servedTex(bad, { log });
    assert.equal(logs.length, 1, 'logged once');
  } finally {
    katex.renderToString = real;
  }
  const lines = servedTex(math({ id: 'kc.mathematics.inverse-trigonometric-functions.formula-lines', tex: { back: '$x$\n$y$' } }), { log });
  assert.equal(lines.texHtml, undefined, 'a line count that differs');
  const subject = servedTex(math({ id: 'kc.economics.x.formula-y', subject: 'economics' }), { log });
  assert.equal(subject.texHtml, undefined, 'not a tex subject');
});

test('servedTex: a forbidden command in tex.front serves the plain card and never reaches KaTeX', () => {
  const real = katex.renderToString;
  const seen = [];
  katex.renderToString = (src, opts) => { seen.push(src); return real(src, opts); };
  try {
    for (const [k, cmd] of ['\\href{javascript:alert(1)}{x}', '\\htmlData{a=b}{x}', '\\char65'].entries()) {
      const bad = math({ id: `kc.mathematics.inverse-trigonometric-functions.formula-front-${k}`, tex: { front: `Formula: Principal value branch of $${cmd}$`, back: math().tex.back } });
      const out = servedTex(bad, { log: () => {} });
      assert.equal(out.texHtml, undefined, cmd);
      assert.equal(out.tex, undefined, cmd);
      assert.equal(out.back, BACK, `${cmd}: the plain stored back`);
      assert.equal(out.front, math().front);
    }
    assert.ok(!seen.some((s) => /\\(?:href|htmlData|char)/.test(s)), 'not rendered');
  } finally {
    katex.renderToString = real;
  }
});

test('loadDecks serves typeset cards through servedTex', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kc-tex-'));
  try {
    mkdirSync(path.join(dir, 'decks'), { recursive: true });
    const text = `${JSON.stringify({ subject: 'mathematics', version: 1, cards: [math(), listCard()] })}\n`;
    writeFileSync(path.join(dir, 'decks', 'mathematics.json'), text);
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ mathematics: { version: 1, sha256: createHash('sha256').update(text).digest('hex'), cards: 2 } }));
    const decks = loadDecks({ dir, log: () => {} });
    const served = decks.byId.get(math().id);
    assert.equal(served.back, 'sin⁻¹ x : [−1, 1] → [−π/2, π/2]');
    assert.match(served.texHtml.back[0].html, /katex-mathml/);
    assert.equal(decks.byId.get(listCard().id).texHtml.back.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- texBackRows (the web's row structure)

test('texBackRows: list, formula and paras shapes, as the plain path draws each kind', () => {
  assert.equal(texBackRows(math({ tex: undefined })), null);
  const list = texBackRows(servedTex(listCard()));
  assert.equal(list.shape, 'list');
  assert.equal(list.tag, 'ul');
  assert.equal(list.bare, true);
  assert.deepEqual(list.rows.map((r) => [r.marker, r.lead]), [['(i)', false], ['(ii)', false]]);
  const steps = texBackRows(servedTex(listCard({ kind: 'steps' })));
  assert.equal(steps.tag, 'ol');
  const formula = texBackRows(servedTex(math()));
  // "sin⁻¹ x …" starts with a lowercase letter, but with math: a formula, not a cut sentence, so no ellipsis.
  assert.deepEqual([formula.shape, formula.rows.length, formula.rows[0].lead], ['formula', 1, false]);
  const prose = texBackRows(servedTex(math({ back: `thus ${BACK}`, quote: `thus ${BACK}`, tex: { back: `thus ${math().tex.back}` } })));
  assert.equal(prose.rows[0].lead, true, 'a row that starts with prose mid-sentence keeps the ellipsis');
  const mathFirst = texBackRows(servedTex(math({ kind: 'fact', back: 'x is real', quote: 'x is real', tex: { back: '$x$ is real' } })));
  assert.equal(mathFirst.rows[0].lead, false, 'a paragraph that starts with math never gets it');
  const upper = texBackRows(servedTex(math({ back: 'A = πr2', quote: 'A = πr2', tex: { back: '$A = \\pi r^2$' } })));
  assert.equal(upper.rows[0].lead, false);
  const back = 'where x is real\nso y = 2';
  const paras = texBackRows(servedTex(math({ kind: 'fact', back, quote: back, tex: { back: 'where $x$ is real\nso $y = 2$' } })));
  assert.equal(paras.shape, 'paras');
  assert.deepEqual(paras.rows.map((r) => r.lead), [true, true], 'a line that starts mid-sentence reads with a leading ellipsis');
  // A list kind with one line is drawn as a paragraph (the plain path's single-line list), its html whole.
  const one = texBackRows(servedTex(listCard({ back: 'x = 1', quote: 'x = 1', tex: { back: '$x = 1$' } })));
  assert.equal(one.shape, 'paras');
});

// ---------------------------------------------------------------- tex-show

test('tex-show: bag difference and the report lines', () => {
  assert.equal(bagMinus(alnumBag('sin x'), alnumBag('sin y')), 'x');
  assert.equal(bagMinus(alnumBag('112'), alnumBag('12')), '1');
  const lines = showCard(withTex({ back: '$\\sin^{-1} y : [-1, 1] \\to [-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$' }), 'mathematics');
  assert.equal(lines[0], math().id);
  assert.ok(lines.some((l) => l.includes('mismatch: tex lacks "x", tex adds "y"')), lines.join('\n'));
  assert.ok(lines.at(-1).includes('shape:tex_mismatch'));
  assert.deepEqual(texLines('a\n\n b \n'), ['a', 'b']);
});

test('tex-show: "order differs" when the letters and digits match in another order (advisory, for the image reviewer)', () => {
  // pdftotext reads a fraction's denominator under its numerator: "π 2" for π/2, "2 π" in the PDF's own order here.
  const back = 'x : [-1, 1] → [-2 π, 2 π]';
  const card = math({ back, quote: back, tex: { back: '$x : [-1, 1] \\to \\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$' } });
  const lines = showCard(card, 'mathematics');
  assert.ok(lines.some((l) => l.includes('order differs: back reads "x : [-1, 1] → [-2 π, 2 π]"')), lines.join('\n'));
  assert.ok(!lines.at(-1).includes('shape:tex_mismatch'), 'the bags match: advisory only');
  assert.ok(!showCard(math(), 'mathematics').some((l) => l.includes('order differs')), 'same order: no line');
  assert.ok(!lines.some((l) => l.includes('mismatch:')));
});

// ---------------------------------------------------------------- the web reads texHtml

test('Prompt, NcertText, CardFace and CardList read the served texHtml', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
  const body = (src, name) => {
    const at = src.indexOf(`export function ${name}(`);
    assert.ok(at >= 0, name);
    return src.slice(at, src.indexOf('\n}\n', at));
  };
  const keyCard = read('src/components/keycards/KeyCard.jsx');
  assert.match(body(keyCard, 'Prompt'), /card\?\.texHtml\?\.front/);
  assert.match(body(keyCard, 'NcertText'), /texBackRows\(card\)/);
  assert.match(read('src/components/keycards/kinds.js'), /card\?\.texHtml\?\.back/);
  const face = read('src/components/learn2/stage/CardFace.jsx');
  assert.match(face, /<TexHtml html=\{html\} \/>/);
  assert.match(read('src/components/learn2/feed/ChapterFeed.jsx'), /<CardFace [^\n]*html=\{it\.card\?\.texHtml\?\.front\}/);
  const list = read('src/components/learn2/cards/CardList.jsx');
  assert.match(list, /card\.texHtml\?\.front/);
  assert.match(list, /!card\.texHtml && query && card\.quote/, 'the search line of a typeset card is its plain back, never the quote');
});
