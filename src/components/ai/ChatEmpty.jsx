"use client";

// The start of a chat with Mobi (16 Nov 2026): why this is more than a chatbot, before a word is typed. Top to bottom:
// Mobi and his greeting, ONE line of real context from the student's own record (it opens Your record), four starters as
// big quiet tiles, each with its price said before the tap, then "From your practice": doubts about the chapters the
// student's own practice misses, and every question the record can answer.
//
// Kept from the two doors this replaces (ASK-MOBI-1019, v13): a starter is a doubt sent with its subject and chapter, so its
// 2 questions come from that chapter; a record question is marked Free and is answered from the record or not at all, never
// as a written reply; Pro questions stay visible with a quiet Pro tag and open the Upgrade sheet; a fresh account is told
// plainly that the record needs a paper, with the one first-set key.
import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ChevronUp, Lock } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { openUpgrade } from '@/components/pro';
import { creditCount, MOBI_JOB_CREDITS } from '@/lib/creditCopy.mjs';
import { FIRST_SET_HREF } from '@/lib/firstSet.mjs';
import { doubtStarters, standingView } from './mobiJobs.mjs';
import { DOOR_COPY, fewerIdeasLabel, greetName, moreIdeasLabel, priceWord, tonightOrToday } from './askDoors.mjs';
import { CHAT_COPY, contextLine, doubtBuys, hello, starterTiles } from './chatCopy.mjs';

const SHOWN_DOUBTS = 3;

function PriceTag({ price }) {
  if (price === 'pro') return <span className="ace-price ace-price--pro"><Lock size={13} aria-hidden="true" />{DOOR_COPY.pro}</span>;
  return <span className="ace-price" data-price={price}>{price === 'free' ? DOOR_COPY.free : creditCount(MOBI_JOB_CREDITS)}</span>;
}

function Row({ text, preview, price, onClick, locked = false, disabled = false }) {
  return (
    <button type="button" className="ace-row" data-locked={locked || undefined} disabled={disabled} onClick={onClick} aria-label={`Ask: ${text}. ${preview ? `${preview}. ` : ''}${price === 'credit' ? creditCount(MOBI_JOB_CREDITS) : priceWord(price)}`}>
      <span className="ace-row__text"><b>{text}</b>{preview ? <small>{preview}</small> : null}</span>
      <PriceTag price={price} />
    </button>
  );
}

/**
 * `record` is the page's read of the record ({ status, insights }); `standing` its read of Where you stand ({ phase, body });
 * `asks` the record questions (askDoors.mjs recordDoorAsks). `onAsk(ask)` runs one in the chat; `onDoubt()` puts the cursor in
 * the field; `onMistake()` opens "a question I got wrong" in the composer; `onRecord()` opens Your record.
 */
export default function ChatEmpty({ user, record, standing, asks = [], photoOn = false, busy = false, now = new Date(), onAsk, onDoubt, onMistake, onRecord, onRetry }) {
  const router = useRouter();
  const titleId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  // Mobi waves once when the start appears, and once more for a tap (each wave is a fresh element, so the six frames replay).
  const [wave, setWave] = useState(0);
  const status = record.status;
  const insights = record.insights;
  const ready = status === 'ready' && insights?.state === 'ready';
  const name = greetName(user);
  const subjects = user?.subjects || [];
  const view = ready ? standingView(standing) : null;
  const range = view && (view.kind === 'ready' || view.kind === 'partial') ? view.range : null;
  const doubts = doubtStarters({ insights: ready ? insights : null, subjects, limit: 6 });
  const shown = moreOpen ? doubts : doubts.slice(0, SHOWN_DOUBTS);
  const mine = doubts.some((d) => d.mine);
  const tiles = starterTiles({ when: tonightOrToday(now), photoOn });
  const losing = asks.find((a) => a.id === 'losing') || null;
  const tonight = asks.find((a) => a.id === 'revise') || null;

  function tile(id) {
    if (id === 'doubt') { onDoubt?.(); return; }
    if (id === 'mistake') { onMistake?.(); return; }
    // The two record tiles are the record's own asks, Free: answered from the record or not at all (startPlan.mjs).
    if (id === 'losing') onAsk?.({ text: losing?.text || 'Where am I losing marks?', free: true });
    if (id === 'tonight') onAsk?.({ text: tonight?.text || `What should I revise ${tonightOrToday(now)}?`, free: true });
  }

  function askRecord(ask, event) {
    if (ask.locked) {
      // Pro is sold on the web: the existing Upgrade sheet (D80), never a dead tap. Without a host (a Pro student) it is the plan page.
      if (!openUpgrade({ trigger: 'review', opener: event.currentTarget })) router.push('/pricing');
      return;
    }
    onAsk?.({ text: ask.text, answer: ask.id === 'last' ? ask.answer : null, free: ask.price === 'free' });
  }

  return (
    <section className="ace" aria-labelledby={titleId}>
      <div className="ace-hello">
        <button type="button" className="ace-hello__mobi" onClick={() => setWave((n) => n + 1)} aria-label="Mobi, waving hello">
          <span key={wave} className="ace-wave" aria-hidden="true" />
        </button>
        <div className="ace-hello__words">
          <p className="ace-hi">{hello(name)}</p>
          <h2 id={titleId} className="ace-q">{CHAT_COPY.headline}</h2>
        </div>
      </div>

      {/* One line of real context: the papers Mobi has read and the range they put the student at. It opens Your record. */}
      {ready ? (
        <button type="button" className="ace-context" onClick={onRecord}>
          <span>{contextLine({ sessions: insights.sessions, range })}</span>
          <ChevronRight size={18} aria-hidden="true" />
          <span className="sr-only">{CHAT_COPY.seeRecord}</span>
        </button>
      ) : null}
      {status === 'loading' ? <p className="ace-context ace-context--quiet" role="status">{DOOR_COPY.reading}</p> : null}
      {status === 'unavailable' ? (
        <p className="ace-context ace-context--line" role="status">
          <span>{typeof navigator !== 'undefined' && navigator.onLine === false ? DOOR_COPY.readOffline : DOOR_COPY.readFailed} <button type="button" className="ace-inline" onClick={onRetry}>{DOOR_COPY.tryAgain}</button></span>
        </p>
      ) : null}
      {/* A fresh account: the honest line and the one first-set key, on one line so the four starters stay in view. Your record
          says the rest. */}
      {status === 'empty' ? (
        <p className="ace-context ace-context--line">
          <span>{DOOR_COPY.emptySay} <Link href={FIRST_SET_HREF} className="ace-inline">{DOOR_COPY.emptyKey}</Link></span>
        </p>
      ) : null}

      <ul className="ace-tiles">
        {tiles.map((t) => (
          <li key={t.id}>
            <button type="button" className="ace-tile" data-tile={t.id} disabled={busy} onClick={() => tile(t.id)}>
              <span className="ace-tile__top">
                <BrandIcon name={t.icon} size={32} loading="eager" />
                <span className="ace-price" data-price={t.tone === 'free' ? 'free' : 'credit'}>{t.price}</span>
              </span>
              <b className="ace-tile__title">{t.title}</b>
              {t.sub ? <small className="ace-tile__sub">{t.sub}</small> : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="ace-more">
        <h3 className="ace-more__title">{mine ? CHAT_COPY.practiceTitle : CHAT_COPY.practiceTitleFresh}</h3>
        <p className="ace-more__tip">{doubtBuys()}</p>
        <ul className="ace-list">
          {shown.map((s) => (
            <li key={s.id}><Row text={s.text} preview={s.preview} price="credit" disabled={busy} onClick={() => onAsk?.({ text: s.text, doubt: { subject: s.subject, chapter: s.chapter } })} /></li>
          ))}
        </ul>
        {doubts.length > SHOWN_DOUBTS ? (
          <button type="button" className="ace-expand" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
            {moreOpen ? fewerIdeasLabel : moreIdeasLabel(subjects)}
            {moreOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </button>
        ) : null}

        {ready && asks.length ? (
          <>
            <button type="button" className="ace-expand ace-expand--record" aria-expanded={allOpen} onClick={() => setAllOpen((v) => !v)}>
              {allOpen ? CHAT_COPY.recordAllClose : CHAT_COPY.recordAll}
              {allOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            </button>
            {allOpen ? (
              <ul className="ace-list">
                {asks.map((a) => (
                  <li key={a.id}><Row text={a.text} preview={a.preview} price={a.price} locked={a.locked} disabled={busy && !a.locked} onClick={(event) => askRecord(a, event)} /></li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
