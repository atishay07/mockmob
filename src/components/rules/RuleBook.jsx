"use client";
// The Rule book (spec tmp/mistake-lab-v4/SPEC.md 4.10): one list, two kinds of rule, reached from the Lab's Repair step
// ("Your rules, 7") and from Review. Every sentence comes finished from the server (GET /api/me/rules, data/rule_book.js,
// contract_rules_v1.json); this page lays them out and keeps one rule for the next mock.
//   From your repairs           each repair's rule and memory hook, by chapter, newest first, with Copy
//   From how you take papers    the four habits, each with its evidence line, its Wilson interval and its gate
//   Traps you meet              (slice 4, 4.11) the named traps the student fell for, across mocks (result/TrapsMeet.jsx)
// "Use in my next mock" (outlined) posts { ruleId } to /api/me/playbook and shows the rule as chosen only after the
// server confirms it; until then the button says it is saving, and a failure says so with the server's words. The rule
// then shows on Practice's session card before a Full mock or NTA Mode starts, and the Lab checks it after that mock.
//
// Motion: the page's sections rise once on arrival (45 ms apart); the chosen rule's card settles in when it changes
// (260 ms); the in-use tag pops 0.95 to 1 (200 ms). Reduced motion: every change lands at once.
import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { BookMarked, Check, ChevronLeft, Copy, EyeOff, Flag, Hourglass, LoaderCircle, RefreshCw, Repeat2, Target, Timer } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import { StatusIcon } from '@/components/ui/Glyph';
import { useToast } from '@/components/ToastProvider';
import { apiPost } from '@/lib/fetcher';
import { withNumbers } from '@/components/result/MarksLedger';
import TrapsMeet from '@/components/result/TrapsMeet';
import { copyText, shortDate, withActiveRule } from '@/components/result/labLoop';
import { useRuleBook } from './useRuleBook';
import './rule-book.css';

const HABIT_ICON = { 'habit:changes': Repeat2, 'habit:long_stay': Timer, 'habit:never_opened': EyeOff, 'habit:marked': Flag };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const SAVE_FAILED = 'Your rule was not saved. Try again.';

/** A Wilson interval as a band on 0 to 100%: the range drawn, the share as a dot, and the same in words. */
function Band({ iv }) {
  if (!iv || !Number.isFinite(iv.pct) || !Number.isFinite(iv.low) || !Number.isFinite(iv.high)) return null;
  const width = Math.max(iv.high - iv.low, 1.5);
  return (
    <div className="rb-band">
      <span className="rb-band__track" aria-hidden="true">
        <i className="rb-band__range" style={{ '--l': `${iv.low}%`, '--w': `${width}%` }} />
        <b className="rb-band__dot" style={{ '--x': `${iv.pct}%` }} />
      </span>
      <span className="rb-band__text"><b>{iv.k} of {iv.n}</b> ({iv.pct}%). At this count, the 95% interval runs from {iv.low}% to {iv.high}%.</span>
    </div>
  );
}

function CopyButton({ rule, hookLabel }) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timer = useRef(0);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no_clipboard');
      await navigator.clipboard.writeText(copyText(rule, hookLabel));
      setState('copied');
    } catch { setState('failed'); }
    timer.current = setTimeout(() => setState('idle'), 1800);
  };
  return (
    <button type="button" className="rb-copy" data-state={state} onClick={copy} aria-label={state === 'idle' ? `Copy the rule: ${rule.text}` : undefined}>
      {state === 'copied' ? <Check size={16} strokeWidth={2.4} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy'}</span>
    </button>
  );
}

function UseButton({ rule, labels, sending, busy, onUse }) {
  if (rule.active) return <span className="rb-inuse"><Check size={15} strokeWidth={2.6} aria-hidden="true" />{labels.inUse}</span>;
  const mine = sending === rule.id;
  return (
    <button type="button" className="rb-use" disabled={busy} aria-busy={mine || undefined} onClick={() => onUse(rule)}>
      {mine ? <LoaderCircle className="rb-spin" size={16} strokeWidth={2.2} aria-hidden="true" /> : <Target size={16} strokeWidth={2.1} aria-hidden="true" />}
      {mine ? 'Saving…' : labels.use}
    </button>
  );
}

function RepairRule({ rule, labels, use }) {
  const meta = [Number.isInteger(rule.number) ? `Q${rule.number}` : null, rule.repairedAt ? `repaired ${shortDate(rule.repairedAt)}` : null].filter(Boolean).join(', ');
  return (
    <li className="rb-rule" data-active={rule.active || undefined}>
      {meta ? <p className="rb-rule__meta">{meta}</p> : null}
      <p className="rb-rule__text">{rule.text}</p>
      {rule.hook ? <p className="rb-rule__hook"><span>{labels.hook}</span> {rule.hook}</p> : null}
      <div className="rb-actions">
        <CopyButton rule={rule} hookLabel={labels.hook} />
        <UseButton rule={rule} labels={labels} {...use} />
      </div>
      {use.error?.id === rule.id ? <p className="rb-err" role="alert"><StatusIcon kind="error" size={14} />{use.error.message}</p> : null}
    </li>
  );
}

function HabitRule({ rule, labels, use }) {
  const Icon = HABIT_ICON[rule.id] || Target;
  return (
    <li className="rb-habit" data-active={rule.active || undefined} data-gated={rule.gated || undefined}>
      <span className="rb-habit__icon" aria-hidden="true"><Icon size={19} strokeWidth={2} /></span>
      <div className="rb-habit__main">
        <p className="rb-habit__text">{rule.text}</p>
        <p className="rb-habit__evidence">{rule.gated ? <><Hourglass size={14} strokeWidth={2} aria-hidden="true" />{rule.evidence}</> : withNumbers(rule.evidence)}</p>
        <Band iv={rule.interval} />
        <div className="rb-actions"><UseButton rule={rule} labels={labels} {...use} /></div>
        {use.error?.id === rule.id ? <p className="rb-err" role="alert"><StatusIcon kind="error" size={14} />{use.error.message}</p> : null}
      </div>
    </li>
  );
}

function NowCard({ active, labels, empty = false }) {
  return (
    <section className="rb-now" data-set={active ? '' : undefined} aria-labelledby="rb-now-title">
      <p className="rb-now__label" id="rb-now-title"><Target size={16} strokeWidth={2.2} aria-hidden="true" />{labels.inUse}</p>
      {active ? (
        <div className="rb-now__body" key={active.id}>
          <p className="rb-now__text">{active.text}</p>
          <p className="rb-now__meta">{active.since ? `Chosen ${shortDate(active.since)}. ` : ''}It shows on your session card before your next Full mock or NTA Mode starts, and the Lab checks it after that mock.</p>
        </div>
      ) : (
        <div className="rb-now__body" key="none">
          <p className="rb-now__text rb-now__text--empty">No rule chosen yet.</p>
          <p className="rb-now__meta">{empty ? 'When a rule is here, you can choose it for your next mock. It shows on your session card before a Full mock or NTA Mode starts.' : 'Choose one below. It shows on your session card before your next Full mock or NTA Mode starts.'}</p>
        </div>
      )}
    </section>
  );
}

function Loading() {
  return (
    <div className="rb-layout" role="status" aria-label="Loading your rules">
      <div className="rb-side"><span className="rb-skel rb-skel--now skeleton" /></div>
      <div className="rb-main"><span className="rb-skel skeleton" /><span className="rb-skel skeleton" /><span className="rb-skel skeleton" /></div>
    </div>
  );
}

export default function RuleBook() {
  const read = useRuleBook();
  const toast = useToast();
  const [sending, setSending] = useState(null);
  const [error, setError] = useState(null); // { id, message }
  const [said, setSaid] = useState('');
  const book = read.data?.book || null;
  const labels = book?.labels || {};

  const use = useCallback(async (rule) => {
    if (sending) return;
    setError(null);
    setSending(rule.id);
    try {
      const out = await apiPost('/api/me/playbook', { ruleId: rule.id });
      if (out?.active?.id !== rule.id) throw new Error('unconfirmed');
      read.setBook((b) => withActiveRule(b, out.active));
      setSaid(`${labels.inUse || 'Your rule for your next mock'}: ${out.active.text}`);
      toast.success(`Saved for your next mock: ${out.active.text}`);
    } catch (e) {
      // The server's own words when it refused the choice (422); otherwise a plain "not saved".
      setError({ id: rule.id, message: e?.status === 422 && e.body?.message ? e.body.message : SAVE_FAILED });
    } finally {
      setSending(null);
    }
  }, [sending, read, labels.inUse, toast]);

  const head = <ArenaHead title={book?.title || 'Your rules'} lede="Rules from your repairs and from how you take papers. Choose one to carry into your next mock." />;
  const back = <Link className="rb-back" href="/review"><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Review</Link>;

  if (read.state === 'error' && !book) {
    return (
      <section className="pr rb">
        {back}{head}
        <div className="rb-fail" role="alert">
          <StatusIcon kind="error" />
          <p>{read.message}</p>
          <button type="button" className="rb-use" onClick={read.retry}><RefreshCw size={16} strokeWidth={2.1} aria-hidden="true" />Try again</button>
        </div>
      </section>
    );
  }
  if (!book) return <section className="pr rb">{back}{head}<Loading /></section>;

  const repairCount = (book.repairs?.chapters || []).reduce((s, ch) => s + (ch.rules?.length || 0), 0);
  const habitCount = book.habits?.rules?.length || 0;
  const useProps = { sending, busy: Boolean(sending), onUse: use, error };

  return (
    <section className="pr rb">
      {back}{head}
      <p className="sr-only" aria-live="polite">{said}</p>
      <div className="rb-layout">
        <aside className="rb-side">
          <NowCard active={book.active} labels={labels} empty={!repairCount && !habitCount} />
          <nav className="rb-jump" aria-label="Sections">
            <a href="#rb-repairs"><BookMarked size={16} strokeWidth={2.1} aria-hidden="true" /><span>{labels.repairsTitle}</span><b>{repairCount}</b></a>
            <a href="#rb-habits"><Target size={16} strokeWidth={2.1} aria-hidden="true" /><span>{labels.habitsTitle}</span><b>{habitCount}</b></a>
          </nav>
          {book.basis ? <p className="rb-basis">{book.basis}</p> : null}
        </aside>

        <div className="rb-main">
          <section className="rb-section" id="rb-repairs" aria-labelledby="rb-repairs-h">
            <div className="rb-section__head"><h2 id="rb-repairs-h">{labels.repairsTitle}</h2><span>{plural(repairCount, 'rule')}</span></div>
            {book.repairs?.chapters?.length ? book.repairs.chapters.map((ch) => (
              <div className="rb-chapter" key={ch.chapter}>
                <h3>{ch.chapter}<span>{plural(ch.rules.length, 'rule')}</span></h3>
                <ul className="rb-rules">{ch.rules.map((r) => <RepairRule key={r.id} rule={r} labels={labels} use={useProps} />)}</ul>
              </div>
            )) : <p className="rb-empty"><BookMarked size={18} strokeWidth={2} aria-hidden="true" />{book.repairs?.empty}</p>}
          </section>

          <section className="rb-section" id="rb-habits" aria-labelledby="rb-habits-h">
            <div className="rb-section__head"><h2 id="rb-habits-h">{labels.habitsTitle}</h2>{habitCount ? <span>{plural(habitCount, 'rule')}</span> : null}</div>
            {book.habits?.state === 'ready' && habitCount ? (
              <ul className="rb-habits">{book.habits.rules.map((r) => <HabitRule key={r.id} rule={r} labels={labels} use={useProps} />)}</ul>
            ) : <p className="rb-empty"><Hourglass size={18} strokeWidth={2} aria-hidden="true" />{book.habits?.gateLine}</p>}
          </section>

          <section className="rb-section" id="rb-traps" aria-labelledby="rb-traps-h">
            <div className="rb-section__head"><h2 id="rb-traps-h">Traps you meet</h2></div>
            <TrapsMeet surface="inset" />
          </section>
        </div>
      </div>
    </section>
  );
}
