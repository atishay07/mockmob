// Authoring helpers. Every number shown to a student is computed here, then recomputed
// independently by scripts/learning/validate-study-content.mjs before release.
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
export const sub = ([a, b], [c, d]) => frac(a * d - c * b, b * d);
export const fmt = ([n, d]) => d === 1 ? `${n}` : `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`;
export const shares = ratio => { const total = ratio.reduce((s, x) => s + x, 0); return ratio.map(x => frac(x, total)); };
export const ratioText = parts => { const g = parts.reduce((a, b) => gcd(a, b)); return parts.map(x => x / g).join(':'); };
// Express fractions over their least common denominator so a student can see the subtraction.
export const lcd = fractions => fractions.reduce((m, [, d]) => m / gcd(m, d) * d, 1);
export const over = ([n, d], den) => `${n * (den / d)}/${den}`;
export const rupees = n => `₹${n.toLocaleString('en-IN')}`;

export function unitBase({ subject, chapter, conceptId, id, version, order, title, summary, minutes, skill, objectives, examLink, sourceRefs }) {
  return { id, version, subject, chapter, conceptId, order, title, summary, estimatedMinutes: minutes, skill, objectives, examLink, sourceRefs, state: 'candidate' };
}
export function makeCard(unit, { id, version = 1, objective, title, variants, ...rest }) {
  const card = { id, version, unitId: unit.id, subject: unit.subject, chapter: unit.chapter, conceptId: unit.conceptId, familyId: `study:${unit.subject}:${id}:v${version}`, objective, title, ...rest, sourceRefs: unit.sourceRefs };
  if (variants) card.variants = variants.map((v, i) => ({ variantId: `${id}-v${i + 1}`, ...v }));
  return card;
}
export const choice = (prompt, options, answer, explanation, extra = {}) => ({ type: 'choice', prompt, options, answer, explanation, ...extra });
