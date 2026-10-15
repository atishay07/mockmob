"use client";

// The landing's signature scene: the Mistake Lab, told as one held scroll story on every screen.
// The product screen holds still (ScrollStory: position sticky, IntersectionObserver beats) while the
// reader's scroll walks it through four scenes: time per question, every answer change on the clock,
// the repair, and the SWOT with the set to do next. Phones get the same hold as desktop: step rail on
// top, the scene's words, then the screen, scaled once per resize to fit short and landscape windows.
// Only opacity and transform move. All numbers come from labStory.mjs (one sample Accountancy mock),
// so the scenes cannot disagree with each other or with the replay further down the page.
import { ArrowLeftRight, Check, LayoutGrid, Minus, ShieldCheck, Timer, Wrench, X } from 'lucide-react';
import { labStory, REPAIR, signed } from './labStory.mjs';
import { SubjectObject } from '@/components/brand/SubjectObject';
import ScrollStory from './ScrollStory';

const S = labStory();
const VERDICT = { right: 'Right', wrong: 'Wrong', blank: 'Blank' };

const SCENES = [
  { key: 'time', tab: 'Time', Icon: Timer, title: 'See where every minute went.',
    body: `Every question keeps its own clock. The slow ones stand out against the paper’s pace of ${S.pace} a question, so you can see which minutes cost marks.`,
    take: `${S.facts.wrong} wrong answers took ${S.wrongTime}. ${S.facts.right} right ones took ${S.rightTime}.` },
  { key: 'changes', tab: 'Changes', Icon: ArrowLeftRight, title: 'Every answer you changed, on the clock.',
    body: 'Your first pick, the switch and the minute it happened, with the marks each change won or cost.',
    take: `${S.changes.length} changes. Net ${signed(S.net)} marks.` },
  { key: 'repair', tab: 'Repair', Icon: Wrench, title: 'Repair the reason, not just the answer.',
    body: 'The AI solves the question on its own first. Only when it matches the official key does it explain why your pick looked right and where it breaks.',
    take: 'If the two disagree, the question waits. You never get a guess.' },
  { key: 'swot', tab: 'SWOT', Icon: LayoutGrid, title: 'Leave every mock with a plan.',
    body: 'A SWOT after every mock, built from your own answers and times, with the set to do next. Free, no credits.',
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
      <p className="lcp__foot">Times run from the start of the paper. Net effect: <b>{signed(S.net)} marks</b>.</p>
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
      <div className="lcd-bar__title">
        <span className="lcd-bar__subject">
          {label ? null : <SubjectObject id="accountancy" size={44} className="lcd-bar__obj" style={{ '--obj-size': '2.5rem' }} />}
          <span>Accountancy<small>Sample mock</small></span>
        </span>
        <b>{S.facts.marks}<small> / {S.facts.outOf}</small></b>
      </div>
      {label ? <p className="lcd-bar__tab">{label}</p> : null}
    </div>
  );
}

function Stage({ step, pinned, reduced, goTo }) {
  const ready = pinned && !reduced;
  return (
    <div className="mm-wrap lc__grid" data-ready={ready ? 'true' : 'false'}>
      <ol className="lc__rail" aria-label="Mistake Lab, scene by scene">
        {SCENES.map(({ key, tab, Icon }, i) => {
          const state = i < step ? 'done' : i === step ? 'on' : 'off';
          return (
            <li key={key}>
              <button type="button" data-on={step === i ? 'true' : 'false'} aria-current={step === i ? 'step' : undefined} onClick={(event) => goTo(i, { instant: event.detail === 0 })}>
                <span className="lc__rail-ico" aria-hidden="true"><Icon size={16} /></span>
                <span className="lc__rail-tab">{tab}</span>
                <i className="lc__rail-meter" aria-hidden="true"><i className="ss-fill" data-state={state} style={{ '--ss-i': i }} /></i>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lcd" aria-hidden="true">
        <span className="lcd__glow" />
        <SubjectObject id="accountancy" size={216} lit className="lcd__object" style={{ '--obj-size': 'clamp(9.5rem, 15vw, 13.5rem)' }} />
        <div className="lcd__frame">
          <ScreenBar />
          <div className="lcd__tabs"><i className="lcd__tab-ink" />{SCENES.map(({ key, tab }, i) => <span key={key} data-on={step === i ? 'true' : 'false'}>{tab}</span>)}</div>
        </div>
      </div>

      {SCENES.map(({ key, tab, title, body, take }, i) => {
        const Panel = PANELS[key];
        const on = pinned ? step === i : true;
        return (
          <article key={key} className="lc-scene" data-ss-step={i} data-on={on ? 'true' : 'false'} data-past={pinned && i < step ? 'true' : undefined} aria-labelledby={`lc-scene-${key}`}>
            <div className="lc-scene__copy">
              <p className="lc-scene__step"><span>{String(i + 1).padStart(2, '0')}</span>{tab}</p>
              <h3 className="lc-scene__title" id={`lc-scene-${key}`}>{title}</h3>
              <p className="lc-scene__body">{body}</p>
              <p className="lc-scene__take">{take}</p>
            </div>
            <figure className="lc-scene__screen" aria-label={`${tab} screen from a sample Accountancy mock`}>
              <div className="lc-scene__mini" aria-hidden="true"><ScreenBar label={tab} /></div>
              <div className="lc-scene__fit" data-ss-fit="0.62"><Panel /></div>
            </figure>
          </article>
        );
      })}
    </div>
  );
}

export default function LabCinema() {
  return (
    <ScrollStory steps={SCENES.length} className="lc" label="Mistake Lab, four scenes" Content={Stage} />
  );
}
