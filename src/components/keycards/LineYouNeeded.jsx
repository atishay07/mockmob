"use client";
// "The line you needed" (KEYCARDS-BUILD-SPEC.md section 3): under a wrong answer on the paper result, the 1-2 Key cards that
// hold the NCERT line the question rests on, from GET /api/keycards/line. Compact: the book's words are the content, with
// their book, chapter and page; the front and the kind are not repeated. It says where the match came from ("Linked to this question" when the
// content stage linked it, "Matched by its words" when the server matched the text) and offers Add to Revise.
// Hidden when the source is 'none', when Key cards are off, when the read fails, and when Free has used today's lines (402):
// it is extra help, never a broken box, and the result screen keeps its own single Pro line. The Free count left is said once.
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CardSource, NcertText } from './KeyCard';
import { addToRevise, isProRequired, readLine, refreshHome } from './api';
import { plural } from './kinds';
import { ncertFont } from './ncertFont';
import './keycards.css';

const SOURCE_LABEL = { linked: 'Linked to this question', matched: 'Matched by its words' };

export default function LineYouNeeded({ questionId }) {
  const [read, setRead] = useState({ state: 'loading', body: null });
  const [add, setAdd] = useState('idle');
  useEffect(() => {
    if (!questionId) return undefined;
    let alive = true;
    readLine(questionId)
      .then((body) => { if (alive) setRead({ state: 'ready', body }); })
      .catch(() => { if (alive) setRead({ state: 'hidden', body: null }); });
    return () => { alive = false; };
  }, [questionId]);
  const body = read.body;
  if (read.state !== 'ready' || !body || body.source === 'none' || !SOURCE_LABEL[body.source] || !Array.isArray(body.cards) || !body.cards.length) return null;
  const cards = body.cards.slice(0, 2);
  async function addAll() {
    setAdd('adding');
    try {
      await addToRevise({ cardIds: cards.map((c) => c.id), from: 'mistake' });
      setAdd('added');
      refreshHome();
    } catch (e) {
      setAdd(isProRequired(e) ? 'pro' : 'failed');
    }
  }
  return (
    <section className={`kc-line ${ncertFont.variable}`} aria-label="The line you needed">
      <div className="kc-line__head">
        <h4 className="kc-line__title">The line you needed</h4>
        <span className="kc-line__src">{SOURCE_LABEL[body.source]}</span>
      </div>
      <ul className="kc-line__cards">
        {cards.map((c) => (
          <li key={c.id}>
            <NcertText card={c} className="kc-ncert--compact" />
            <CardSource card={c} />
          </li>
        ))}
      </ul>
      <div className="kc-line__foot">
        {add === 'added' ? (
          <p className="kc-inrevise" role="status"><Check size={16} strokeWidth={2.4} aria-hidden="true" />{cards.length > 1 ? 'Both are in Revise. They come back when due.' : 'In Revise. It comes back when due.'}</p>
        ) : add === 'pro' ? (
          <p className="kc-fine" role="status">Adding {cards.length > 1 ? 'these cards' : 'this card'} needs Pro. Pro opens every card in every chapter and keeps them on a schedule.</p>
        ) : (
          <button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={addAll} disabled={add === 'adding'}>{add === 'adding' ? 'Adding' : cards.length > 1 ? 'Add both to Revise' : 'Add to Revise'}</button>
        )}
        {add === 'failed' ? <p className="kc-err" role="alert">Not added. Try again.</p> : null}
        {Number.isFinite(body.left) ? <p className="kc-fine">{body.left ? `${plural(body.left, 'more line')} like this today on Free.` : 'That was the last line like this today on Free.'}</p> : null}
      </div>
    </section>
  );
}
