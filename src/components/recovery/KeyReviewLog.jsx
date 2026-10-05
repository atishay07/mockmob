"use client";
// Result-page ledger of every answer key we are re-checking from this session. Our mistakes, listed.
import { ShieldAlert } from 'lucide-react';
import './key-review.css';

export default function KeyReviewLog({ items, onJump }) {
  if (!items.length) return null;
  return (
    <section className="kr-log" aria-labelledby="kr-log-title">
      <header className="kr-log__head">
        <span className="kr-icon" aria-hidden="true"><ShieldAlert size={18} strokeWidth={2.3} /></span>
        <div>
          <h2 id="kr-log-title">Answer keys we are re-checking</h2>
          <p>{items.length === 1 ? 'One recorded answer needs attention.' : `${items.length} recorded answers need attention.`} Open a question to see what changed or why its explanation was withheld.</p>
        </div>
      </header>
      <ul>
        {items.map(({ number, chapter }) => (
          <li key={number}>
            <button type="button" onClick={() => onJump(number)}><b>Q{number}</b><span>{chapter}</span><em>Under review</em></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
