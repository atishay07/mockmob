// Key cards: typeset formulas (handoff-1102/MATHTEX-SPEC.md sections 2, 3, 4, 5 and 7). The tex module (data/keycards_tex.js),
// the validator's texCheck (scripts/keycards/lib.mjs), the server's servedTex and loadDecks, the tex-show bag difference, and
// the row shapes the web draws a typeset back with (src/components/keycards/kinds.js texBackRows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import katex from 'katex';
import { FORBIDDEN_TEX, KATEX_OPTIONS, TEX_SUBJECTS, alnumBag, servedTex, splitTex, texLines, texToPlain } from '../keycards_tex.js';
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
  for (const cmd of ['href', 'url', 'includegraphics', 'htmlClass', 'htmlData', 'def', 'gdef', 'edef', 'xdef', 'let', 'newcommand', 'renewcommand',
    'providecommand', 'color', 'textcolor', 'colorbox', 'fcolorbox', 'raisebox', 'rule', 'class', 'style', 'data']) {
    assert.ok(FORBIDDEN_TEX.test(`$\\${cmd}{x}$`), cmd);
  }
  for (const ok of ['\\left(', '\\leq', '\\le', '\\lambda', '\\cdot', '\\dagger', '\\colon', '\\urcorner']) assert.ok(!FORBIDDEN_TEX.test(`$${ok}$`), ok);
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
    ['$\\forall x \\exists y$', '∀ x ∃ y'], ['$\\emptyset = \\varnothing$', '∅ = ∅'], ['$\\{x \\mid x > 0\\}$', '{x | x > 0}'], ['$\\vert x \\vert$', '| x |'],
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
    ['$\\iint$', '∬'], ['$\\sum_{i=1}^{n} x_i$', 'Σᵢ₌₁ⁿ xᵢ'], ['$\\prod_{i=1}^{n} a_i$', 'Πᵢ₌₁ⁿ aᵢ'],
    ['$\\lim_{x \\to a} f(x)$', 'lim(x→a) f(x)'], ['$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$', 'lim(x→0) (sin x)/x = 1'],
    ['$\\lim\\limits_{h \\to 0}$', 'lim(h→0)'],
    // fonts, words and accents
    ['$\\mathbf{R} - (-1, 1)$', 'R − (−1, 1)'], ['$\\mathbb{R}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}, \\mathbb{C}$', 'R, N, Z, Q, C'],
    ['$\\mathrm{d}x$', 'dx'], ['$x \\text{ if } x > 0$', 'x if x > 0'], ['$\\textrm{area}$', 'area'], ['$\\mathit{AB}$', 'AB'],
    ['$\\vec{a}$', 'a\u20D7'], ['$\\overrightarrow{AB}$', 'AB\u20D7'], ['$\\hat{i} + \\hat{j}$', 'i\u0302 + j\u0302'], ['$\\bar{x}$', 'x\u0304'],
    ['$\\overline{AB}$', 'A\u0305B\u0305'],
    // brackets and spacing
    ['$\\left( \\frac{a}{b} \\right)$', '(a/b)'], ['$\\left| x \\right|$', '| x |'], ['$\\left. f \\right|_a$', 'f |ₐ'], ['$\\big( x \\big)$', '(x)'],
    ['$\\displaystyle \\frac{1}{x}$', '1/x'], ['$a\\,b\\;c\\:d\\!e\\quad f\\qquad g~h$', 'a b c de f g h'], ['$\\{1, 2\\}$', '{1, 2}'],
    ['$\\lbrace a \\rbrace$', '{ a }'], ['$\\langle a, b \\rangle$', '⟨ a, b ⟩'], ['$\\lvert x \\rvert$', '| x |'],
    // matrices and cases
    ['$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$', '[a b; c d]'], ['$\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$', '|1 2; 3 4|'],
    ['$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$', '[1 0; 0 1]'], ['$\\begin{matrix} x & y \\end{matrix}$', '[x y]'],
    ['$\\begin{array}{cc} 1 & -1 \\\\ 2 & 3 \\end{array}$', '[1 −1; 2 3]'],
    ['$f(x) = \\begin{cases} x, & \\text{if } x \\ge 0 \\\\ -x, & \\text{if } x < 0 \\end{cases}$', 'f(x) = { x, if x ≥ 0; −x, if x < 0'],
    ['$\\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}$', '{ 1, x > 0; 0, x ≤ 0'],
    // negation
    ['$x \\not\\in A$', 'x ∉ A'], ['$a \\not= b$', 'a ≠ b'],
  ];
  for (const [tex, plain] of rows) assert.equal(texToPlain(tex), plain, tex);
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
  assert.ok(texCheck(math({ back, quote: back, tex: { back: `$${many}$` } }), 'mathematics').includes('shape:tex_too_long'), 'plain back over 450');
  assert.ok(!texCheck(math(), 'mathematics').includes('shape:tex_too_long'));
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
  // "sin⁻¹ x …" starts with a lowercase letter: the ellipsis the plain path's withLead gives the same back.
  assert.deepEqual([formula.shape, formula.rows.length, formula.rows[0].lead], ['formula', 1, true]);
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
