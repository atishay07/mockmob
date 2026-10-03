// One-off codemod: turns the literal dark colours in prepos.css into CSS variables that keep the
// same dark values by default. A host (e.g. the Radar page) overrides the --pp-* variables to
// follow the Arena theme. Safe to re-run: already-converted values are skipped.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/components/ai/prepos.css';
let css = readFileSync(path, 'utf8');
const map = [
  [/#f2f4ec/gi, 'var(--pp-ink, #f2f4ec)'], [/#e6ebe0/gi, 'var(--pp-ink, #e6ebe0)'], [/#d4dacd/gi, 'var(--pp-ink-2, #d4dacd)'],
  [/#b4bdae/gi, 'var(--pp-ink-2, #b4bdae)'], [/#9aa795/gi, 'var(--pp-ink-3, #9aa795)'], [/#8f9a8b/gi, 'var(--pp-ink-3, #8f9a8b)'],
  [/#d2f000/gi, 'var(--pp-accent, #d2f000)'], [/#ffb6a9/gi, 'var(--pp-bad, #ffb6a9)'], [/#ff9d92/gi, 'var(--pp-bad, #ff9d92)'],
  [/rgba\(244, 245, 240, 0\.(1[0-9]?|2[0-9]?|3[0-9]?)\)/g, 'var(--pp-line-strong, rgba(244, 245, 240, 0.$1))'],
  [/rgba\(244, 245, 240, 0\.(0[5-9])\)/g, 'var(--pp-line, rgba(244, 245, 240, 0.$1))'],
  [/rgba\(244, 245, 240, 0\.0[2-4]\)/g, 'var(--pp-wash, rgba(244, 245, 240, 0.03))'],
];
for (const [pattern, replacement] of map) {
  css = css.replace(pattern, (match, ...rest) => {
    // Do not re-wrap values already inside var(--pp-...).
    const offset = rest.at(-2);
    const before = css.slice(Math.max(0, offset - 40), offset);
    return /var\(--pp-[a-z-]*,\s*$/.test(before) ? match : replacement.replace(/\$1/g, rest[0]);
  });
}
writeFileSync(path, css);
console.log('themeable');
