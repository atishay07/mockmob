"use client";
/* eslint-disable react-hooks/set-state-in-effect */

// Help: the app's common questions as an accordion, one open at a time. Each question is a real
// heading holding a button, so a screen reader can list them. ?q=<id> (or #<id>) opens one. The open
// answer eases its height; under reduced motion it changes at once. "Write to us" is a mailto row.
// A search box over the questions and answers (W-083) narrows the list as the student types; with no match it says so and
// points at the write-to-us row, so a question the list does not hold still has an answer path.
import { useEffect, useMemo, useState } from 'react';
import ArenaHead from '@/components/arena/ArenaHead';
import { AppIcon } from '@/components/ui/Glyph';
import { FAQ_ITEMS, HELP_HEADING, HELP_LEDE, SUPPORT_ROW, faqIdFrom } from '@/lib/helpFaq.mjs';
import './help.css';

const fold = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export default function HelpPageClient() {
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((item) => { const hay = fold(`${item.question} ${item.answer.join(' ')}`); return words.every((w) => hay.includes(w)); });
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = faqIdFrom(params.get('q')) || faqIdFrom(window.location.hash);
    if (!id) return;
    setOpen(id);
    window.requestAnimationFrame(() => document.getElementById(`faq-q-${id}`)?.scrollIntoView({ block: 'center' }));
  }, []);

  return (
    <div className="student-page help">
      <ArenaHead title="Help" lede={HELP_LEDE} />
      <section aria-labelledby="help-h">
        <h2 className="help__h" id="help-h">{HELP_HEADING}</h2>
        <label className="help-find">
          <AppIcon name="search" size={18} />
          <span className="sr-only">Search the questions</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search, for example credits or sign in" autoComplete="off" enterKeyHint="search" />
        </label>
        <p className="help-find__count" role="status" aria-live="polite">{query.trim() ? (shown.length ? `${shown.length} of ${FAQ_ITEMS.length} questions match.` : `No question matches “${query.trim()}”. Write to us below and we will answer it.`) : ''}</p>
        <div className="help__list">
          {shown.map((item) => {
            const isOpen = open === item.id;
            return (
              <div key={item.id} className="help-q" data-open={isOpen ? 'true' : 'false'}>
                <h3 className="help-q__h">
                  <button
                    type="button"
                    id={`faq-q-${item.id}`}
                    className="help-q__btn"
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${item.id}`}
                    onClick={() => setOpen(isOpen ? null : item.id)}
                  >
                    <span>{item.question}</span>
                    <AppIcon name="expand" size={18} className="help-q__chev" />
                  </button>
                </h3>
                <div className="help-q__panel" id={`faq-a-${item.id}`} role="region" aria-labelledby={`faq-q-${item.id}`} inert={isOpen ? undefined : true}>
                  <div className="help-q__inner">
                    {item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <a className="help-write" href={SUPPORT_ROW.href}>
        <AppIcon name="mail" size={20} />
        <span className="help-write__text">
          <b>{SUPPORT_ROW.label}</b>
          <span>{SUPPORT_ROW.note}</span>
        </span>
      </a>
    </div>
  );
}
