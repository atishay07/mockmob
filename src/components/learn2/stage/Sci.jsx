'use client';
// Science notation drawn (R4-SPEC R4-run): a chemistry card's front, back and quote with real subscripts and superscripts from
// sciText (sciText.mjs, pure). Display only; the stored words are unchanged, and a screen reader reads the same characters.
//   <Sci text />                    one run of words: <sub> and <sup> where the rules say
//   <SciFront text blankLabel />    a front with its blanks ("____" drawn as the gap) and the notation in the words
//   <SciNcert card className />     NCERT's line for a chemistry card: its lines as a list (list kinds) or as paragraphs, with
//                                   the blanks a term card marks; the same classes as KeyCard's NcertText, so it looks the same
import { Fragment } from 'react';
import { LIST_KINDS, backLines, markBlanks, splitBlanks } from '@/components/keycards/kinds';
import { sciText } from './sciText.mjs';

export function Sci({ text }) {
  const parts = sciText(text);
  return parts.map((p, i) => (p.kind === 'sub' ? <sub key={i} className="st-sub">{p.text}</sub>
    : p.kind === 'sup' ? <sup key={i} className="st-sup">{p.text}</sup> : <Fragment key={i}>{p.text}</Fragment>));
}

export function SciFront({ text, numbered = false }) {
  return splitBlanks(text).map((p, i) => (p.blank
    ? <span key={i} className="kc-gap" role="img" aria-label={numbered ? `blank ${p.n}` : 'blank'} />
    : <span key={i}><Sci text={p.text} /></span>));
}

export function SciNcert({ card, className = '' }) {
  const cls = `kc-ncert ${className}`.trim();
  const lines = backLines(card?.back);
  if (LIST_KINDS.includes(card?.kind) && lines.length > 1) {
    const Tag = card.kind === 'steps' ? 'ol' : 'ul';
    return <Tag className={`${cls} kc-ncert--list`}>{lines.map((l, i) => <li key={i}><Sci text={l} /></li>)}</Tag>;
  }
  const marked = ['term', 'key_line'].includes(card?.kind) ? markBlanks(card.back, card.blanks) : [{ text: card?.back || '' }];
  const draw = (parts) => parts.map((p, i) => (p.mark ? <mark key={i} className="kc-mark"><Sci text={p.mark} /></mark> : <span key={i}><Sci text={p.text} /></span>));
  // A line break in the book's words starts a new paragraph (as NcertText does).
  const paras = [];
  let cur = [];
  for (const part of marked) {
    if (part.mark) { cur.push(part); continue; }
    const pieces = String(part.text || '').split(/\n+/);
    pieces.forEach((t, i) => { if (i > 0) { paras.push(cur); cur = []; } if (t) cur.push({ text: t }); });
  }
  paras.push(cur);
  const kept = paras.filter((p) => p.length);
  if (kept.length < 2) return <p className={cls}>{draw(kept[0] || [])}</p>;
  return <div className={`${cls} kc-ncert--paras`}>{kept.map((parts, i) => <p key={i}>{draw(parts)}</p>)}</div>;
}
