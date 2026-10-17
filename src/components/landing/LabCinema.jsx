"use client";

// The landing's signature scene: the Mistake Lab, told as one held scroll story on every screen.
// The product screen holds still (ScrollStory: position sticky, IntersectionObserver beats) while the
// reader's scroll walks it through four scenes: time per question, every answer change on the clock,
// the repair, and the SWOT with the sets to do next. Phones get the same hold as desktop: step rail on
// top, the scene's words, then the screen, scaled once per resize to fit short and landscape windows.
// The screen is a Night device in both themes, like every product screen on the page.
// Each screen tells its story in order when its scene comes on (the pace line, then the bars past it;
// the first pick, the arrow, the final pick; the wrong option, then the key), and reduced motion shows
// the finished screen with the same marks. Only opacity and transform move. All numbers come from
// labStory.mjs (one sample Accountancy mock), so the scenes cannot disagree with each other or with
// the replay further down the page. Words on the screens are the product's own.
import { useEffect, useRef } from 'react';
import { Check, Minus, ShieldCheck, X } from 'lucide-react';
import { labStory, REPAIR, REPAIR_COST, SAMPLE_LABEL, repairRecordLine, signed } from './labStory.mjs';
import { SubjectObject } from '@/components/brand/SubjectObject';
import ScrollStory from './ScrollStory';

const S = labStory();
const VERDICT = { right: 'right', wrong: 'wrong', blank: 'left blank' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const timeTake = S.time.wrongAllOver && S.time.underAllRight
  ? `All ${S.facts.wrong} wrong answers ran over pace. Every answer you gave under pace was right.`
  : `${S.time.overCount} questions ran over pace.`;

const SCENES = [
  { key: 'time', tab: 'Time', title: 'See where every minute went.',
    body: `Each question runs against CUET’s pace of ${S.pace}. The minutes past the line stand out, and so does what they bought.`,
    bodyPhone: `Every question against CUET’s pace of ${S.pace}, and what the extra minutes bought.`,
    take: timeTake },
  { key: 'changes', tab: 'Changes', title: 'Every answer you changed, on the clock.',
    body: 'Your first pick, what you changed it to and when, and the marks each change won or cost.',
    take: `${S.changes.length} changes. Net ${signed(S.net)} marks.` },
  { key: 'repair', tab: 'Repair', title: 'Repair the reason behind the miss.',
    body: `Written from the answer key. If the AI’s own working disagrees with the key, you get no repair and no charge. A repair uses ${REPAIR_COST.credits} AI credit; Free has ${REPAIR_COST.freeMonthly} a month.`,
    bodyPhone: `Written from the answer key. A repair uses ${REPAIR_COST.credits} AI credit; Free has ${REPAIR_COST.freeMonthly} a month.`,
    take: `Your pick ${REPAIR.picked}, the key ${REPAIR.key}, and the rule that tells them apart.` },
  { key: 'swot', tab: 'SWOT', title: 'Leave every mock with a plan.',
    body: 'A SWOT after every mock, built from your own answers, times and earlier mocks, with the sets to do next. The SWOT is free and uses no credits.',
    bodyPhone: 'A SWOT after every mock, from your own answers and times. It is free and uses no credits.',
    take: `Partnership cost marks in each of your last ${S.swot.partnershipLost.length} mocks. That is the first set.` },
];

const verdictIcon = (v, size = 12) => (v === 'right' ? <Check size={size} aria-hidden="true" /> : v === 'wrong' ? <X size={size} aria-hidden="true" /> : <Minus size={size} aria-hidden="true" />);

// ---------- 1. Time: every question against the pace line ----------
function timeWords(r) {
  if (r.band === 'blank') return `Question ${r.n}: left blank after ${r.time}.`;
  const side = r.band === 'over' ? `${r.delta} over the pace` : `${r.delta} under the pace`;
  return `Question ${r.n}: ${r.time}, ${side}, ${VERDICT[r.verdict]}.`;
}

function TimePanel() {
  const t = S.time;
  return (
    <div className="lcp lcp--time">
      <p className="lcp__h">Where your time went</p>
      {t.wrongAllOver ? <p className="lcp-fig" data-tone="bad"><b>{t.overWrongTime}</b><span>past the pace, added up across your {S.facts.wrong} wrong answers</span></p> : null}
      <p className="lcp__lead">CUET gives you {S.pace} a question. Your median was {S.median}.</p>
      <div className="lct" style={{ '--pace': S.paceShare }}>
        <i className="lct__pace" aria-hidden="true" />
        <b className="lct__pace-label" aria-hidden="true">Pace {S.pace}</b>
        <ol className="lct__rows">
          {S.rows.map((r, i) => (
            <li key={r.n} className="lct__row" data-band={r.band} data-verdict={r.verdict} style={{ '--i': i, '--base': r.base, '--over': r.over }}>
              <span className="lct__q" aria-hidden="true">Q{r.n}</span>
              <span className="lct__mark" data-verdict={r.verdict} aria-hidden="true">{verdictIcon(r.verdict, 10)}</span>
              <span className="lct__track" aria-hidden="true">
                <i className="lct__base" />
                {r.band === 'over' ? <i className="lct__over" /> : null}
              </span>
              <span className="lct__time" aria-hidden="true">{r.time}</span>
              <span className="lct__delta" aria-hidden="true">
                {r.band === 'blank' ? 'Blank' : r.band === 'over' ? <>+{r.delta} over<span className="lct__wide"> pace</span></> : <>{r.delta} under</>}
              </span>
              <span className="sr-only">{timeWords(r)}</span>
            </li>
          ))}
        </ol>
      </div>
      <ul className="lct__key" aria-hidden="true">
        <li><i />Under pace</li>
        <li><i data-k="over-right" />Over pace, right</li>
        <li><i data-k="over-wrong" />Over pace, wrong</li>
        <li><i data-k="blank" />Blank</li>
      </ul>
      <p className="lcp__foot lct__sum">
        {t.underAllRight ? <>Every answer you gave under pace was <b data-tone="good">right</b>. The {S.facts.blank} blanks were quick skips.</> : null}
      </p>
    </div>
  );
}

// ---------- 2. Changes: each change as a small story ----------
function Pick({ letter, verdict, at, end }) {
  return (
    <span className="lcc__end" data-end={end} aria-hidden="true">
      <span className="lcc__chip" data-verdict={verdict}>
        <b>{letter}</b>
        <i className="lcc__badge">{verdictIcon(verdict, 10)}</i>
      </span>
      <small>{at}</small>
    </span>
  );
}

function changeWords(c) {
  const effect = c.net < 0 ? `That change cost ${-c.net} marks.` : `That change gained ${c.net} marks.`;
  return `Question ${c.n}: picked ${c.from} at ${c.at}, ${c.fromVerdict}. Changed to ${c.to} at ${c.toAt}, ${c.gap} later, ${c.toVerdict}. ${effect}`;
}

function ChangesPanel() {
  const lostCount = S.lostQuestions.length;
  return (
    <div className="lcp lcp--changes">
      <p className="lcp__h">Every answer you changed</p>
      <p className="lcp-fig" data-tone={S.net < 0 ? 'bad' : 'good'}><b>{signed(S.net)}</b><span>marks, net, from the {S.changes.length} answers you changed</span></p>
      <ChangeClock />
      <ol className="lcc">
        {S.changes.map((c, i) => (
          <li key={c.n} className="lcc__row" data-tone={c.net < 0 ? 'bad' : 'good'} style={{ '--i': i }}>
            <span className="lcc__q" aria-hidden="true">Q{c.n}</span>
            <Pick end="from" letter={c.from} verdict={c.fromVerdict} at={c.at} />
            <span className="lcc__arrow" aria-hidden="true">
              <i className="lcc__line" />
              <i className="lcc__head" />
              {c.net < 0 ? <i className="lcc__cross"><X size={10} strokeWidth={3} /></i> : null}
              <small>{c.gap} later</small>
            </span>
            <Pick end="to" letter={c.to} verdict={c.toVerdict} at={c.toAt} />
            <b className="lcc__net" aria-hidden="true">{signed(c.net)}</b>
            <span className="sr-only">{changeWords(c)}</span>
          </li>
        ))}
      </ol>
      <div className="lcc-sum">
        <p data-tone="good" style={{ '--j': 0 }}><b>{signed(S.gainedMarks)}</b>Gained by {plural(S.gainedCount, 'change')}</p>
        <p data-tone="bad" style={{ '--j': 1 }}><b>{signed(S.lostToChanges)}</b>Lost to {plural(lostCount, 'change')}</p>
        <p data-tone={S.net < 0 ? 'bad' : 'good'} data-net="true" style={{ '--j': 2 }}><b>{signed(S.net)}</b>Net effect</p>
      </div>
      <NetStrip />
      <p className="lcp__fine">Clock times count from the start of the paper.</p>
    </div>
  );
}

// The paper's clock with each change on its own lane, the first pick and the final pick in their
// verdict colours. Wide screens only, where the device has the room: two of the three changes land in
// the paper's last minute, which only a clock can show.
function ChangeClock() {
  const total = S.facts.totalSec;
  return (
    <div className="lcp-clock" aria-hidden="true">
      <span className="lcp-clock__line" />
      <span className="lcp-clock__sweep"><i /></span>
      {S.changes.map((c, lane) => (
        <span key={c.n} className="lcp-clock__change" data-tone={c.net < 0 ? 'bad' : 'good'} style={{ '--a': c.atSec / total, '--b': c.toAtSec / total, '--lane': lane }}>
          <i className="lcp-clock__span" />
          <i className="lcp-clock__dot" data-end="from" data-verdict={c.fromVerdict}><b>{c.from}</b></i>
          <i className="lcp-clock__dot" data-end="to" data-verdict={c.toVerdict}><b>{c.to}</b></i>
          <em className="lcp-clock__q">Q{c.n}</em>
        </span>
      ))}
      <span className="lcp-clock__ends"><b>0:00</b><b>{S.total}</b></span>
    </div>
  );
}

// What the changes did to the score: the first answers' total against the final one on a 0 to 50 line.
// Wide screens only.
function NetStrip() {
  const { marks, outOf } = S.facts;
  const first = S.firstAnswers;
  const lo = Math.min(marks, first) / outOf;
  const hi = Math.max(marks, first) / outOf;
  return (
    <div className="lcp-net" data-tone={S.net < 0 ? 'bad' : 'good'}>
      <p className="lcp-net__h">Your first answers would have scored <b>{first}</b>. You finished on <b>{marks}</b>.</p>
      <div className="lcp-net__track" aria-hidden="true">
        <i className="lcp-net__fill" style={{ '--x': lo }} />
        <i className="lcp-net__gap" style={{ '--a': lo, '--b': hi }} />
        <i className="lcp-net__mark" data-k="final" style={{ '--x': marks / outOf }}><small>Final</small><b>{marks}</b></i>
        <i className="lcp-net__mark" data-k="first" style={{ '--x': first / outOf }}><small>First answers</small><b>{first}</b></i>
        <span className="lcp-net__ends"><b>0</b><b>{outOf}</b></span>
      </div>
    </div>
  );
}

// ---------- 3. Repair: the pick crossed out, the key checked, then the four blocks ----------
// Wide screens show the whole repair at once (the question, the four blocks). Phones show it short, so it
// reads at full size: the trap's name as the headline, the pick crossed and the key checked, one line each
// for why the pick tempted, why the key is right and the rule. The rest (where it breaks, the full
// sentences, the student's record) opens in a sheet over the page, in the same words: the sheet has its own
// scroll and its own Close at the top, it sits above the phone dock, and the held story underneath stays put.
// Nothing scrolls inside the held screen.
const optionText = (letter) => REPAIR.options.find(([l]) => l === letter)?.[1];
const BRIEF = REPAIR.blocks.filter((b) => b.short);
// On a phone that is short of room, the short form sets rows aside in this order (ScrollStory data-ss-drop) rather
// than shrinking its words: why the key is right (the rule says it in fewer words), the shortened stem, why the pick
// tempted, and last the rule. The trap's name and the pick against the key always stay; the sheet has every word.
const BRIEF_DROP = { right: 1, trap: 3, rule: 4 };

function RepairHead() {
  return (
    <div className="lcr-head">
      <p className="lcr-head__q">Q{REPAIR.n}. Your pick {REPAIR.picked}. Key {REPAIR.key}.</p>
      <p className="lcr-head__trap">{REPAIR.trap}</p>
    </div>
  );
}

// The full repair: the question with every option, the four sections and the student's record.
function RepairFull({ record }) {
  return (
    <>
      <div className="lcp-q">
        <p className="lcp-q__stem">{REPAIR.stem}</p>
        <ul className="lcp-q__opts">
          {REPAIR.options.map(([letter, text]) => {
            const state = letter === REPAIR.picked ? 'picked' : letter === REPAIR.key ? 'key' : undefined;
            return (
              <li key={letter} data-state={state}>
                <b className="lcp-q__letter">{letter}{state ? <i className="lcp-q__badge" aria-hidden="true">{state === 'key' ? <Check size={9} strokeWidth={3.2} /> : <X size={9} strokeWidth={3.2} />}</i> : null}</b>
                <span>{text}</span>
                {state ? <em>{state === 'picked' ? 'Your pick' : 'Key'}</em> : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="lcp-blocks">
        {REPAIR.blocks.map((b, i) => (
          <div key={b.kind} className="lcp-block" data-kind={b.kind} style={{ '--i': i }}>
            <p className="lcp-block__label">{b.label}</p>
            <p>{b.text}</p>
          </div>
        ))}
      </div>
      {record ? <p className="lcr-record"><b>From your record</b>{record}</p> : null}
    </>
  );
}

function RepairPanel() {
  const record = repairRecordLine();
  return (
    <div className="lcp lcp--repair">
      <RepairHead />
      <p className="lcr-stem" data-ss-drop="2">{REPAIR.stemShort}</p>
      <ul className="lcp-q__opts lcr-pair">
        <li data-state="picked">
          <b className="lcp-q__letter">{REPAIR.picked}<i className="lcp-q__badge" aria-hidden="true"><X size={10} strokeWidth={3.2} /></i></b>
          <span>{optionText(REPAIR.picked)}</span>
          <em>Your pick</em>
        </li>
        <li className="lcr-pair__arrow" aria-hidden="true"><i className="lcr-pair__line" /><i className="lcr-pair__head" /></li>
        <li data-state="key">
          <b className="lcp-q__letter">{REPAIR.key}<i className="lcp-q__badge" aria-hidden="true"><Check size={10} strokeWidth={3.2} /></i></b>
          <span>{optionText(REPAIR.key)}</span>
          <em>Key</em>
        </li>
      </ul>
      <p className="lcp-check"><ShieldCheck size={15} aria-hidden="true" />Explained from the answer key ({REPAIR.key}).</p>
      <ul className="lcr-brief">
        {BRIEF.map((b, i) => (
          <li key={b.kind} className="lcp-block" data-kind={b.kind} data-ss-drop={BRIEF_DROP[b.kind]} style={{ '--i': i }}>
            <p className="lcp-block__label">{b.label}</p>
            <p>{b.short}</p>
          </li>
        ))}
      </ul>
      <div className="lcr-full"><RepairFull record={record} /></div>
    </div>
  );
}

// Phones: the key that opens the full repair, and its sheet. It sits at the foot of the screen, outside the
// scaled panel (the screen keeps room for it, lab-cinema.css), so however short the window it is never clipped
// by the screen's edge or covered by the phone dock.
function RepairSheet({ on }) {
  const record = repairRecordLine();
  const sheet = useRef(null);
  // A scene that goes off stage (the reader scrolled on, or picked another scene) takes its sheet with it.
  useEffect(() => { if (!on && sheet.current?.open) sheet.current.close(); }, [on]);
  const close = () => sheet.current?.close();
  return (
    <>
      <button type="button" className="lcr-more" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
        Read the full repair
      </button>
      {/* A tap on the dimmed page around the sheet closes it, as Escape and Close do. */}
      <dialog ref={sheet} className="lcr-sheet" aria-labelledby="lcr-sheet-title" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="lcr-sheet__inner">
          <div className="lcr-sheet__bar">
            <p className="lcr-sheet__title" id="lcr-sheet-title">The full repair</p>
            <button type="button" className="lcr-sheet__close" onClick={close} autoFocus>Close</button>
          </div>
          <div className="lcp lcr-sheet__body">
            <RepairHead />
            <RepairFull record={record} />
          </div>
        </div>
      </dialog>
    </>
  );
}

// ---------- 4. SWOT: Do this next, then, then the four groups ----------
// On a phone short of room the SWOT sets rows aside in this order (ScrollStory data-ss-drop) rather than shrinking its
// words: its heading (the scene's title says it), the second set (the Opportunities group names it), the groups'
// heading, the plan's heading, the groups' units, and only on the shortest windows the four groups.
function SwotPanel() {
  return (
    <div className="lcp lcp--swot">
      <p className="lcp__h" data-ss-drop="1">After this mock</p>
      {/* One move first, then what follows it: the page promises a single next move, so the plan says which one. */}
      <div className="lcs-block">
        {S.swot.plan.map((p, i) => (
          <div key={p.label} className="lcs-step" data-ss-drop={i === 0 ? undefined : 2}>
            <p className="lcs-h" data-ss-drop={i === 0 ? 4 : undefined}>{i === 0 ? 'Do this next' : 'Then'}</p>
            <ol className="lcs-plan" start={i + 1}>
              <li className="lcp-plan" data-first={i === 0 ? 'true' : undefined} style={{ '--i': i }}>
                <span className="lcp-plan__n" aria-hidden="true">{i + 1}</span>
                <div><p className="lcp-plan__label">{p.label}</p><p className="lcp-plan__why">{p.reason}</p></div>
                <span className="lcp-plan__go" aria-hidden="true">Set up</span>
              </li>
            </ol>
          </div>
        ))}
      </div>
      <div className="lcs-block" data-ss-drop="6">
        <p className="lcs-h" data-ss-drop="3">SWOT for this mock</p>
        <div className="lcp-swot">
          {S.swot.quadrants.map((q, i) => (
            <div key={q.id} className="lcp-swot__q" data-q={q.id} style={{ '--i': i }}>
              <p className="lcp-swot__label">{q.label}</p>
              <div className="lcp-swot__full">
                <p className="lcp-swot__title">{q.title}</p>
                <p className="lcp-swot__detail">{q.detail}</p>
                {q.qs.length ? <p className="lcp-swot__see"><span>See</span>{q.qs.map((n) => <b key={n}>Q{n}</b>)}</p> : null}
              </div>
              <div className="lcp-swot__brief">
                <p className="lcp-swot__line">{q.line}</p>
                <p className="lcp-swot__figure">{q.figure}</p>
                <p className="lcp-swot__unit" data-ss-drop="5">{q.unit}</p>
              </div>
            </div>
          ))}
        </div>
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
          <span>Accountancy<small>{SAMPLE_LABEL}</small></span>
        </span>
        <b>{S.facts.marks}<small> / {S.facts.outOf} marks</small></b>
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
        {SCENES.map(({ key, tab }, i) => {
          const state = i < step ? 'done' : i === step ? 'on' : 'off';
          return (
            <li key={key}>
              <button type="button" data-on={step === i ? 'true' : 'false'} aria-current={step === i ? 'step' : undefined} onClick={(event) => goTo(i, { instant: event.detail === 0 })}>
                <span className="lc__rail-tab">{tab}</span>
                <i className="lc__rail-meter" aria-hidden="true"><i className="ss-fill" data-state={state} style={{ '--ss-i': i }} /></i>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lcd" aria-hidden="true">
        <div className="lcd__frame">
          <ScreenBar />
          {/* The rail beside the device is the one scene control. The device only names the scene it shows, as a
              still caption over a hairline (it turns with the scene, it is not a second set of tabs). */}
          <p className="lcd__now"><span key={step}>{SCENES[step]?.tab}</span></p>
        </div>
      </div>

      {/* The mock's subject, the lamp-lit Accountancy object, sits in the screen's header beside the score
          on every screen size, inside the bezel, and drifts a little with the story. */}
      <div className="lc__prop" aria-hidden="true">
        <SubjectObject id="accountancy" size={160} lit className="lc__obj" style={{ '--obj-size': 'var(--lc-obj, 160px)' }} />
      </div>

      {SCENES.map(({ key, tab, title, body, bodyPhone, take }, i) => {
        const Panel = PANELS[key];
        const on = pinned ? step === i : true;
        return (
          <article key={key} className="lc-scene" data-scene={key} data-ss-step={i} data-on={on ? 'true' : 'false'} data-past={pinned && i < step ? 'true' : undefined} aria-labelledby={`lc-scene-${key}`}>
            <div className="lc-scene__copy">
              <h3 className="lc-scene__title" id={`lc-scene-${key}`}>{title}</h3>
              {/* Wide windows lead the words with the scene's finding, in ink, then the explanation. */}
              <p className="lc-scene__body"><b className="lc-scene__take">{take} </b>{bodyPhone ? <><span className="lc-scene__long">{body}</span><span className="lc-scene__short">{bodyPhone}</span></> : body}</p>
            </div>
            <figure className="lc-scene__screen" aria-label={`${tab} screen from a sample Accountancy mock`}>
              <div className="lc-scene__mini" aria-hidden="true"><ScreenBar label={tab} /></div>
              <div className="lc-scene__fit" data-ss-fit="0.62"><Panel on={on} /></div>
              {key === 'repair' ? <RepairSheet on={on} /> : null}
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
