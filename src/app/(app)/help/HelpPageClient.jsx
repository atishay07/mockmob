"use client";
/* eslint-disable react-hooks/set-state-in-effect */

// Help: the app's common questions as an accordion, one open at a time. Each question is a real
// heading holding a button, so a screen reader can list them. ?q=<id> (or #<id>) opens one. The open
// answer eases its height; under reduced motion it changes at once. "Write to us" is a mailto row.
import { useEffect, useState } from 'react';
import ArenaHead from '@/components/arena/ArenaHead';
import { AppIcon } from '@/components/ui/Glyph';
import Link from 'next/link';
import { FAQ_ITEMS, HELP_HEADING, HELP_LEDE, SUPPORT_ROW, faqIdFrom } from '@/lib/helpFaq.mjs';
import { HELP_DOOR_ROWS } from '@/lib/helpDoor.mjs';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { isPlainClick, openAskMobi } from '@/components/ai/askMobi.mjs';
import { GUIDE_EVENT } from '@/components/profile/accountModel.mjs';
import './help.css';

export default function HelpPageClient() {
  const [open, setOpen] = useState(null);

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
      {/* The two quickest ways first (N17): Mobi answers about any page in place, and the tour shows the arena once. */}
      <div className="help-ways">
        {HELP_DOOR_ROWS.filter((row) => row.action).map((row) => {
          const body = (
            <>
              <span className="help-ways__icon" aria-hidden="true">{row.id === 'ask' ? <PrepOSOrb size={30} /> : <AppIcon name="guide" size={20} />}</span>
              <span className="help-write__text"><b>{row.label}</b><span>{row.note}</span></span>
            </>
          );
          return row.action === 'ask' ? (
            <Link key={row.id} className="help-ways__row" href="/mentor?tab=ask" onClick={(event) => { if (isPlainClick(event) && openAskMobi({ tab: 'ask', from: event.currentTarget })) event.preventDefault(); }}>{body}</Link>
          ) : (
            <button key={row.id} type="button" className="help-ways__row" onClick={() => window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { cancelable: true }))}>{body}</button>
          );
        })}
      </div>
      <section aria-labelledby="help-h">
        <h2 className="help__h" id="help-h">{HELP_HEADING}</h2>
        <div className="help__list">
          {FAQ_ITEMS.map((item) => {
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
