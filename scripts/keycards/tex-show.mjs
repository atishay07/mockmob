#!/usr/bin/env node
// Typeset formulas for authors and reviewers (handoff-1102/MATHTEX-SPEC.md section 6).
//
//   node scripts/keycards/tex-show.mjs <draft.json> [cardId ...]
//
// For each card with tex (or each card named): its id, the plain form of tex.front and of every tex.back line (what the app,
// search and screen readers read), the texCheck reasons, and for a shape:tex_mismatch line the letters and digits missing
// on each side. Plain output, no colours. Reads only; writes nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { alnumBag, texLines, texToPlain } from '../../data/keycards_tex.js';
import { texCheck } from './lib.mjs';

/** What `a` has that `b` lacks, as a multiset of letters and digits (both sorted bags, alnumBag). */
export function bagMinus(a, b) {
  const left = new Map();
  for (const c of b) left.set(c, (left.get(c) || 0) + 1);
  let out = '';
  for (const c of a) {
    if (left.get(c)) left.set(c, left.get(c) - 1);
    else out += c;
  }
  return out;
}

/** The report lines for one card. */
export function showCard(card, subject) {
  const out = [card.id];
  const tex = card.tex && typeof card.tex === 'object' ? card.tex : {};
  const differ = (plain, stored) => {
    const want = alnumBag(stored);
    const got = alnumBag(plain);
    if (want === got) return null;
    return `      mismatch: tex lacks "${bagMinus(want, got)}", tex adds "${bagMinus(got, want)}"`;
  };
  if (typeof tex.front === 'string') {
    const plain = texToPlain(tex.front);
    out.push(`  front: ${plain}`);
    const d = differ(plain, card.front);
    if (d) out.push(d);
  }
  if (typeof tex.back === 'string') {
    const backRows = texLines(card.back);
    texLines(tex.back).forEach((line, i) => {
      const plain = texToPlain(line);
      out.push(`  back ${i + 1}: ${plain}`);
      const d = i < backRows.length ? differ(plain, backRows[i]) : '      (no back line to match)';
      if (d) out.push(d);
    });
  }
  const reasons = card.tex === undefined ? [] : texCheck(card, subject);
  out.push(`  reasons: ${reasons.length ? reasons.join(', ') : 'none'}`);
  return out;
}

function main(argv) {
  const [file, ...ids] = argv;
  if (!file) {
    console.error('usage: node scripts/keycards/tex-show.mjs <draft.json> [cardId ...]');
    process.exit(1);
  }
  const draft = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  const cards = Array.isArray(draft?.cards) ? draft.cards : [];
  const shown = ids.length ? cards.filter((c) => ids.includes(c?.id)) : cards.filter((c) => c?.tex !== undefined);
  for (const id of ids.filter((x) => !cards.some((c) => c?.id === x))) console.log(`${id}\n  not in ${path.basename(file)}`);
  for (const card of shown) console.log(showCard(card, draft.subject || card.subject).join('\n'));
  console.log(`${shown.length} card${shown.length === 1 ? '' : 's'} shown`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
