"use client";

// The landing's signature scene: the Mistake Lab, told as one pinned scroll story.
// Desktop (wide and tall enough, motion allowed): the product screen pins in place and the reader's
// scroll walks it through four scenes (time per question, every answer change with its clock, the
// repair, the SWOT). Scene changes come from IntersectionObserver beats, never a scroll handler, so
// the main thread does no work while scrolling; everything that moves is opacity and transform.
// Phones, reduced motion and no-JS get the same four scenes as a stacked story with one screen each.
// All numbers come from labStory.mjs: one illustrative session, labelled as such on screen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, LayoutGrid, Minus, ShieldCheck, Timer, Wrench, X } from 'lucide-react';
import { labStory, REPAIR, signed } from './labStory.mjs';
import { SubjectObject } from '@/components/brand/SubjectObject';

const S = labStory();
const VERDICT = { right: 'Right', wrong: 'Wrong', blank: 'Blank' };

const SCENES = [
  { key: 'time', tab: 'Time', Icon: Timer, title: 'See where every minute went.',
    body: `Each question keeps its own clock. The slow ones stand out against the paper’s pace of ${S.pace} a question, so you know which minutes cost you.`,
    take: `${S.facts.wrong} wrong answers took ${S.wrongTime}. ${S.facts.right} right ones took ${S.rightTime}.` },
  { key: 'changes', tab: 'Changes', Icon: ArrowLeftRight, title: 'Every answer you changed, on the clock.',
    body: 'Your first pick, the switch and the minute it happened. Then the marks each change won or cost you.',
    take: `${S.changes.length} changes. Net ${signed(S.net)} marks.` },
  { key: 'repair', tab: 'Repair', Icon: Wrench, title: 'Repair the reason, not just the answer.',
    body: 'The AI solves the question itself first. Only when it lands on the official key does it explain why your pick looked right and where it breaks.',
    take: 'If the AI and the key disagree, the question is held back.' },
  { key: 'swot', tab: 'SWOT', Icon: LayoutGrid, title: 'Leave every mock with a plan.',
    body: 'A SWOT for each mock, built from your own answers and times, with the sets to do next. Free, no credits.',
    take: `Partnership: ${S.partnership.right} of ${S.partnership.of} right. That is the next set.` },
];

const verdictIcon = (v) => (v === 'right' ? <Check size={12} aria-hidden="true" /> : v === 'wrong' ? <X size={12} aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />);

function TimePanel() {
  const paceAt = S.paceShare * 100;
  return (
    <div className="lcp lcp--time">
      <p className="lcp__h">Where your time went</p>
      <p className="lcp__lead">Paper pace {S.pace} a question. Your median {S.median}.</p>
      <ol className="lcp-bars">
        {S.longest.map((l, i) => (
          <li key={l.n} style={{ '--i': i }}>
            <span className="lcp-bars__q">Q{l.n}</span>
            <span className="lcp-bars__track">
              <i className="lcp-bars__fill" data-verdict={l.verdict} style={{ '--w': l.share }} />
              <i className="lcp-bars__pace" style={{ left: `${paceAt}%` }}>{i === 0 ? <b>Pace</b> : null}</i>
            </span>
            <span className="lcp-bars__time">{l.time}</span>
            <span className="lcp-bars__tag" data-verdict={l.verdict}>{verdictIcon(l.verdict)}{VERDICT[l.verdict]}<em>{l.pace}× pace</em></span>
          </li>
        ))}
      </ol>
      <p className="lcp__foot">{S.facts.wrong} wrong answers took {S.wrongTime}, close to the {S.rightTime} spent on {S.facts.right} right ones.</p>
    </div>
  );
}

function ChangesPanel() {
  const total = S.facts.totalSec;
  return (
    <div className="lcp lcp--changes">
      <p className="lcp__h">Every answer you changed</p>
      <div className="lcp-clock" aria-hidden="true">
        <span className="lcp-clock__line" />
        <span className="lcp-clock__sweep"><i /></span>
        {S.changes.map((c, lane) => {
          const a = c.atSec / total;
          const b = c.toAtSec / total;
          return (
            <span key={c.n} className="lcp-clock__change" data-tone={c.net < 0 ? 'bad' : 'good'} style={{ '--a': a, '--b': b, '--lane': lane }}>
              <i className="lcp-clock__span" />
              <i className="lcp-clock__dot" data-end="from"><b>{c.from}</b></i>
              <i className="lcp-clock__dot" data-end="to"><b>{c.to}</b></i>
              <em className="lcp-clock__q">Q{c.n}</em>
            </span>
          );
        })}
        <span className="lcp-clock__ends"><b>0:00</b><b>{S.total}</b></span>
      </div>
      <ol className="lcp-changes">
        {S.changes.map((c, i) => (
          <li key={c.n} style={{ '--i': i }}>
            <span className="lcp-changes__q">Q{c.n}</span>
            <span className="lcp-changes__text">{c.from} at {c.at}, changed to {c.to} at {c.toAt}</span>
            <b className="lcp-changes__net" data-tone={c.net < 0 ? 'bad' : 'good'}>{signed(c.net)}</b>
          </li>
        ))}
      </ol>
      <p className="lcp__foot">Clock times count from the start of the paper. Net effect: <b>{signed(S.net)} marks</b>.</p>
    </div>
  );
}

function RepairPanel() {
  return (
    <div className="lcp lcp--repair">
      <div className="lcp-q">
        <p className="lcp-q__n">Q{REPAIR.n} <span>Partnership</span></p>
        <p className="lcp-q__stem">{REPAIR.stem}</p>
        <ul className="lcp-q__opts">
          {REPAIR.options.map(([letter, text]) => (
            <li key={letter} data-state={letter === REPAIR.picked ? 'picked' : letter === REPAIR.key ? 'key' : undefined}>
              <b>{letter}</b><span>{text}</span>
              {letter === REPAIR.picked ? <em>Your answer</em> : letter === REPAIR.key ? <em>Key</em> : null}
            </li>
          ))}
        </ul>
      </div>
      <p className="lcp-check"><ShieldCheck size={15} aria-hidden="true" />Solved by the AI first. It matched the official key.</p>
      <div className="lcp-blocks">
        {REPAIR.blocks.map((b, i) => (
          <div key={b.kind} className="lcp-block" data-kind={b.kind} style={{ '--i': i }}>
            <p className="lcp-block__label">{b.label}</p>
            <p>{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwotPanel() {
  const quads = [
    { id: 'strength', label: 'Strengths', title: `Ratios, ${S.ratios.right} of ${S.ratios.of} right`, detail: 'Quick and sure. Keep them in the mix.' },
    { id: 'weakness', label: 'Weaknesses', title: `Partnership, ${S.partnership.right} of ${S.partnership.of} right`, detail: 'Three misses, and the slowest minutes.' },
    { id: 'opportunity', label: 'Opportunities', title: `${S.facts.blank} blanks, ${S.blankMarks} marks open`, detail: `${S.blanks.map((b) => `Q${b.n}`).join(' and ')}, both in ${S.blanks[0]?.chapter.toLowerCase()}.` },
    { id: 'threat', label: 'Threats', title: 'Second thoughts', detail: `Q${S.lostQuestions.join(' and Q')} went from right to wrong, ${signed(S.lostToChanges)} marks.` },
  ];
  return (
    <div className="lcp lcp--swot">
      <p className="lcp__h">After this mock</p>
      <div className="lcp-plan">
        <span className="lcp-plan__n" aria-hidden="true">1</span>
        <div><p className="lcp-plan__label">Practise 10 on partnership, timed</p><p className="lcp-plan__why">{S.partnership.right} of {S.partnership.of} right in this mock.</p></div>
        <span className="lcp-plan__go" aria-hidden="true">Set up</span>
      </div>
      <div className="lcp-swot">
        {quads.map((q, i) => (
          <div key={q.id} className="lcp-swot__q" data-q={q.id} style={{ '--i': i }}>
            <p className="lcp-swot__label"><i aria-hidden="true" />{q.label}</p>
            <p className="lcp-swot__title">{q.title}</p>
            <p className="lcp-swot__detail">{q.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PANELS = { time: TimePanel, changes: ChangesPanel, repair: RepairPanel, swot: SwotPanel };

function ScreenBar({ label }) {
  return (
    <div className="lcd-bar">
      <div className="lcd-bar__title"><span>Accountancy mock</span><b>{S.facts.marks}<small> / {S.facts.outOf}</small></b></div>
      {label ? <p className="lcd-bar__tab">{label}</p> : null}
    </div>
  );
}

export default function LabCinema() {
  const rootRef = useRef(null);
  const deviceRef = useRef(null);
  const beatsRef = useRef([]);
  const scenesRef = useRef([]);
  const [mode, setMode] = useState('flow');
  const [scene, setScene] = useState(0);
  const [seen, setSeen] = useState(() => SCENES.map(() => false));
  const [ready, setReady] = useState(false);

  // Pinned only where it reads well: a wide, tall window with motion allowed.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 960px) and (min-height: 680px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const reduced = calm.matches || document.documentElement.dataset.motion === 'reduced';
      setMode(wide.matches && !reduced && typeof IntersectionObserver !== 'undefined' ? 'pinned' : 'flow');
      setReady(!reduced && typeof IntersectionObserver !== 'undefined');
    };
    sync();
    wide.addEventListener?.('change', sync);
    calm.addEventListener?.('change', sync);
    return () => { wide.removeEventListener?.('change', sync); calm.removeEventListener?.('change', sync); };
  }, []);

  // Pinned: the beat crossing the middle of the window owns the scene.
  useEffect(() => {
    if (mode !== 'pinned') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setScene(Number(entry.target.dataset.beat));
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    beatsRef.current.forEach((node) => node && io.observe(node));
    return () => io.disconnect();
  }, [mode]);

  // Flow: each scene plays its screen once, the first time it is well in view.
  useEffect(() => {
    if (mode !== 'flow' || !ready) return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const i = Number(entry.target.dataset.scene);
        setSeen((list) => (list[i] ? list : list.map((v, j) => v || j === i)));
        io.unobserve(entry.target);
      }
    }, { threshold: 0.35 });
    scenesRef.current.forEach((node) => node && io.observe(node));
    return () => io.disconnect();
  }, [mode, ready]);

  // Pinned: each screen is scaled once per resize to fit the device, so a short window never clips it.
  useEffect(() => {
    const device = deviceRef.current;
    if (mode !== 'pinned' || !device || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      for (const node of scenes) {
        const screen = node?.querySelector('.lc-scene__screen');
        const panel = screen?.querySelector(':scope > .lcp');
        if (!screen || !panel) continue;
        const style = getComputedStyle(screen);
        const room = device.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        panel.style.removeProperty('--fit');
        const need = panel.offsetHeight;
        if (room > 0 && need > room) panel.style.setProperty('--fit', Math.max(0.72, room / need).toFixed(3));
      }
    };
    const scenes = scenesRef.current.slice();
    const observer = new ResizeObserver(fit);
    observer.observe(device);
    return () => {
      observer.disconnect();
      scenes.forEach((node) => node?.querySelector('.lc-scene__screen > .lcp')?.style.removeProperty('--fit'));
    };
  }, [mode]);

  const jump = useCallback((i, keyboard) => {
    const beat = beatsRef.current[i];
    if (!beat) return;
    const rect = beat.getBoundingClientRect();
    const top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2 + 1;
    window.scrollTo({ top, behavior: keyboard ? 'auto' : 'smooth' });
    setScene(i);
  }, []);

  const on = (i) => (mode === 'pinned' ? scene === i : !ready || seen[i]);

  return (
    <div className="lc" ref={rootRef} data-mode={mode} data-ready={ready ? 'true' : 'false'} style={{ '--scene': scene }}>
      <div className="lc__track">
        <div className="lc__stage">
          <div className="mm-wrap lc__grid">
            <ol className="lc__rail" aria-label="Mistake Lab, scene by scene">
              {SCENES.map(({ key, tab, Icon }, i) => (
                <li key={key}>
                  <button type="button" data-on={scene === i ? 'true' : 'false'} aria-current={scene === i ? 'step' : undefined} onClick={(event) => jump(i, event.detail === 0)}>
                    <span className="lc__rail-ico" aria-hidden="true"><Icon size={16} /></span>{tab}
                  </button>
                </li>
              ))}
            </ol>

            <div className="lcd" aria-hidden="true" ref={deviceRef}>
              <span className="lcd__glow" />
              <SubjectObject id="accountancy" size={216} lit className="lcd__object" style={{ '--obj-size': 'clamp(9.5rem, 15vw, 13.5rem)' }} />
              <div className="lcd__frame">
                <ScreenBar />
                <div className="lcd__tabs"><i className="lcd__tab-ink" />{SCENES.map(({ key, tab }, i) => <span key={key} data-on={scene === i ? 'true' : 'false'}>{tab}</span>)}</div>
              </div>
              <span className="lcd__tag">Illustrative example</span>
            </div>

            {SCENES.map(({ key, tab, title, body, take }, i) => {
              const Panel = PANELS[key];
              return (
                <article key={key} className="lc-scene" data-scene={i} data-on={on(i) ? 'true' : 'false'} data-past={mode === 'pinned' && i < scene ? 'true' : undefined} ref={(node) => { scenesRef.current[i] = node; }} aria-labelledby={`lc-scene-${key}`}>
                  <div className="lc-scene__copy">
                    <p className="lc-scene__step"><span>{tab}</span></p>
                    <h3 className="lc-scene__title" id={`lc-scene-${key}`}>{title}</h3>
                    <p className="lc-scene__body">{body}</p>
                    <p className="lc-scene__take">{take}</p>
                  </div>
                  <figure className="lc-scene__screen" aria-label={`${tab} screen, illustrative example`}>
                    <div className="lc-scene__mini" aria-hidden="true"><ScreenBar label={tab} /></div>
                    <Panel />
                  </figure>
                </article>
              );
            })}
          </div>
        </div>
        {SCENES.map(({ key }, i) => <span key={key} className="lc__beat" data-beat={i} style={{ '--i': i }} ref={(node) => { beatsRef.current[i] = node; }} aria-hidden="true" />)}
      </div>
      <p className="mm-wrap lc__fine">Illustrative example: one 10-question Accountancy session, not your score and not a prediction.</p>
    </div>
  );
}
