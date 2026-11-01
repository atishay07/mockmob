// Science notation on the study stage (R4-SPEC R4-run, "Science notation"). PURE, so node --test holds it (pagerModel.test.mjs).
// sciText(text) splits a card's words into segments of plain, subscript and superscript text; the stage draws them with
// <sub> and <sup> for a chemistry card's front, back and quote. Display only: the stored text never changes.
//   1. A common ion sets its charge from a table: SO42− -> SO₄²⁻, NH4+ -> NH₄⁺, Cu2+ -> Cu²⁺, Cl− -> Cl⁻.
//   2. Otherwise a formula token (starts uppercase or with a bracket, made only of element symbols, digits and brackets, with at
//      least one digit) takes a digit after an element symbol or ")" as a subscript: CH3OH, (CH3)2NH, PbO2, H2SO4, C6H5OH.
//      A leading coefficient stays plain (2H2O -> 2H₂O).
//   3. "[X]0" gets a subscript 0 ([A]0 -> [A]₀), and "t1/2" becomes t₁/₂.
//   4. A complex ion's charge after its bracket is a superscript: [Co(NH3)6]3+ -> [Co(NH₃)₆]³⁺, [PtCl4]2– -> [PtCl₄]²⁻.
//   5. An electron count after an orbital is a superscript: 3d8 -> 3d⁸, 4s2 -> 4s², d4 -> d⁴ (s and p only with their shell).
//   NCERT often prints a minus as an en dash (NO2–); it reads as a charge sign wherever a minus or a word-final hyphen does.
// Plain numbers are never touched ("Table 2.4", "Unit 4", "p. 52", "step 1", "373 K"), nor reaction names (SN1, SN2, E1, E2) or vitamins (B12).

const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr '
  + 'Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi '
  + 'Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));

/** The common ions: [formula, charge]. Typed together ("SO42−", "NH4+", "Cu2+"), the charge is the end of the token. */
const IONS = [
  ['NH4', '+'], ['H3O', '+'], ['H', '+'], ['Li', '+'], ['Na', '+'], ['K', '+'], ['Ag', '+'], ['Cu', '+'], ['Cu', '2+'], ['Fe', '2+'],
  ['Fe', '3+'], ['Zn', '2+'], ['Ca', '2+'], ['Mg', '2+'], ['Ba', '2+'], ['Pb', '2+'], ['Hg', '2+'], ['Ni', '2+'], ['Co', '2+'],
  ['Mn', '2+'], ['Sn', '2+'], ['Sn', '4+'], ['Cr', '3+'], ['Al', '3+'],
  ['OH', '−'], ['NO3', '−'], ['NO2', '−'], ['HCO3', '−'], ['HSO4', '−'], ['MnO4', '−'], ['CN', '−'], ['Cl', '−'], ['Br', '−'],
  ['I', '−'], ['F', '−'], ['SCN', '−'], ['SO4', '2−'], ['SO3', '2−'], ['CO3', '2−'], ['CrO4', '2−'], ['Cr2O7', '2−'], ['PO4', '3−'], ['O', '2−'],
  ['S', '2−'],
];
const ION = new Map(IONS.map(([formula, charge]) => [`${formula}${charge}`, { formula, charge }]));

const STOP = /^(?:SN[12]|E[12]|B(?:1|2|3|6|7|9|12))$/; // reaction names and vitamins, never formulas
const SIGN = { '+': '+', '−': '−', '-': '−', '–': '−' };

/** The element/digit/bracket reading of a token, or null when it is not a formula. */
function formulaParts(body) {
  const s = String(body || '');
  if (!s || STOP.test(s) || !/\d/.test(s) || !/^[A-Z(]/.test(s)) return null;
  const out = [];
  let depth = 0;
  let afterAtom = false; // a digit here is a subscript (after an element or ")")
  let elements = 0;
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '(') { depth += 1; out.push({ kind: 'plain', text: c }); afterAtom = false; i += 1; continue; }
    if (c === ')') { if (!depth) return null; depth -= 1; out.push({ kind: 'plain', text: c }); afterAtom = true; i += 1; continue; }
    if (/\d/.test(c)) {
      if (!afterAtom) return null;
      let j = i; while (j < s.length && /\d/.test(s[j])) j += 1;
      out.push({ kind: 'sub', text: s.slice(i, j) });
      afterAtom = false;
      i = j;
      continue;
    }
    if (/[A-Z]/.test(c)) {
      const two = s.slice(i, i + 2);
      const sym = /^[A-Z][a-z]$/.test(two) && ELEMENTS.has(two) ? two : ELEMENTS.has(c) ? c : null;
      if (!sym) return null;
      out.push({ kind: 'plain', text: sym });
      elements += 1;
      afterAtom = true;
      i += sym.length;
      continue;
    }
    return null;
  }
  return depth === 0 && elements > 0 ? out : null;
}

// t1/2 | [X]0 | a token with an optional leading coefficient and an optional charge sign (a hyphen or an en dash only at a
// word's end) | a charge right after "]" | an electron count after an orbital (groups 6-9).
const MASTER = /(?<![A-Za-z0-9])t1\/2(?![0-9A-Za-z])|\[([^\]\s]{1,16})\]0(?![0-9])|(?<![A-Za-z0-9])(\d*)([A-Z(][A-Za-z0-9()]*)([+−]|[-–](?![A-Za-z0-9]))?|(?<=\])(\d{0,2}(?:[+−]|[-–](?![A-Za-z0-9])))|(?<![A-Za-z0-9])(?:([1-7])([spdf])|([df]))(\d{1,2})(?![A-Za-z0-9])/g;

/** A formula's segments, else the token as plain text. */
const formulaOrPlain = (body) => formulaParts(body) || [{ kind: 'plain', text: body }];

/**
 * The segments of `text`: [{ kind: 'plain' | 'sub' | 'sup', text }], adjacent ones of one kind merged. Joining every
 * segment's text gives back the input, except that a hyphen used as a charge sign is drawn as a minus sign.
 */
export function sciText(text) {
  const s = String(text ?? '');
  const out = [];
  const push = (kind, t) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += t; else out.push({ kind, text: t });
  };
  let at = 0;
  MASTER.lastIndex = 0;
  for (let m = MASTER.exec(s); m; m = MASTER.exec(s)) {
    if (m[0] === '') { MASTER.lastIndex += 1; continue; }
    push('plain', s.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[0].startsWith('t1/2')) { push('plain', 't'); push('sub', '1'); push('plain', '/'); push('sub', '2'); continue; }
    if (m[5] !== undefined) { push('sup', m[5].replace(/[-–]/g, '−')); continue; }
    if (m[9] !== undefined) { push('plain', `${m[6] || ''}${m[7] || m[8]}`); push('sup', m[9]); continue; }
    if (m[1] !== undefined) {
      push('plain', '[');
      for (const p of formulaOrPlain(m[1])) push(p.kind, p.text);
      push('plain', ']'); push('sub', '0');
      continue;
    }
    const [, , coef = '', whole, sign] = m;
    // "(Cr2+, Mn3+)": an opening bracket that belongs to the sentence, not to a formula, stays plain before the token.
    const lead = whole.length > 1 && whole.startsWith('(') && !formulaParts(whole) ? '(' : '';
    const body = lead ? whole.slice(1) : whole;
    if (sign) {
      const ion = ION.get(`${body}${SIGN[sign]}`);
      const wordSign = sign === '-' || sign === '–';
      // A hyphen or en dash reads as a charge only for a two-character ion or longer ("Cl-", "SO42–"), never "I-" or "F-".
      if (ion && (!wordSign || body.length >= 2)) {
        push('plain', coef + lead);
        for (const p of formulaOrPlain(ion.formula)) push(p.kind, p.text);
        push('sup', ion.charge);
        continue;
      }
      // One element, a number and a sign is a monatomic ion: Mn3+ -> Mn³⁺, Co3+ -> Co³⁺ (never Mn₃+).
      const one = /^([A-Z][a-z]?)(\d{1,2})$/.exec(body);
      if (one && ELEMENTS.has(one[1])) {
        push('plain', coef + lead + one[1]);
        push('sup', `${one[2]}${SIGN[sign]}`);
        continue;
      }
    }
    const parts = formulaParts(body);
    if (!parts) { push('plain', m[0]); continue; }
    push('plain', coef + lead);
    for (const p of parts) push(p.kind, p.text);
    if (sign) push('plain', sign);
  }
  push('plain', s.slice(at));
  return out;
}

/** True when some segment is a subscript or a superscript (the stage then draws segments, else the plain string). */
export const hasSci = (segments) => (segments || []).some((p) => p.kind !== 'plain');

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻' };

/** The segments as one Unicode string ("SO₄²⁻"): for tests and for a label that cannot hold markup. */
export const sciPlain = (segments) => (segments || []).map((p) => (p.kind === 'sub' ? [...p.text].map((c) => SUB[c] || c).join('')
  : p.kind === 'sup' ? [...p.text].map((c) => SUP[c] || c).join('') : p.text)).join('');

/** Whether a card (or a chapter key) is chemistry: the subject the notation is drawn for. */
export const isChemistry = (card, chapterKey = null) => {
  const subject = String(card?.subject || card?.chapterKey || card?.chapter_key || chapterKey || '').split('.')[0].toLowerCase();
  return subject === 'chemistry';
};
