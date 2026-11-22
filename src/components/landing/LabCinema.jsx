"use client";

// The landing's signature scene: the Mistake Lab, told as one held scroll story on every screen.
// The product screen holds still (ScrollStory: position sticky, IntersectionObserver beats) while the
// reader's scroll walks it through five scenes: the chapters the marks went to, time per question, every
// answer change on the clock, the repair, and the SWOT with the sets to do next (round 11, 10 Nov 2026: the
// Score Recovery Lab told the same feature again, so it is one Lab now). Phones get the same hold as desktop: step rail on
// top, the scene's words, then the screen, scaled once per resize to fit short and landscape windows.
// The screen is a Night device in both themes, like every product screen on the page.
// Each screen tells its story in order when its scene comes on (the chapters' bars, worst first; the pace
// line, then the bars past it; the first pick, the arrow, the final pick; the wrong option, then the key), and reduced motion shows
// the finished screen with the same marks. Only opacity and transform move. All numbers come from
// labStory.mjs (one sample Accountancy mock), so the scenes cannot disagree with each other or with
// the replay further down the page. Words on the screens are the product's own.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeftRight, BookOpen, Check, LayoutGrid, Minus, ShieldCheck, Timer, Wrench, X } from 'lucide-react';
import { labStory, REPAIR, repairRecordLine, signed } from './labStory.mjs';
import { LAB_SCENES } from './homeCopy.mjs';
import { LAB_BEATS } from './LabBeats.mjs';
import { SubjectObject } from '@/components/brand/SubjectObject';
import ScrollStory from './ScrollStory';
import { useLabAutoplay } from './useLabAutoplay';
import Doodle from '@/components/doodle/Doodle';

// The pen on the Lab's screens (18 Nov 2026, owner LK308): one mark a scene, drawn after the screen's own rows have come in,
// on the figure the scene is about. The screens are dark in both themes, so the pen is the dark screen's red and its volt.
const PEN_AFTER = 1100;
/** The next look plays while held: the track crosses this strip along the window's top edge (0.4 % of its height, 3 px). */
const HELD_STRIP = '0px 0px -99.6% 0px';
/** A page still this long, no finger down, has come to rest (a swipe's momentum and the story's own settle are over). */
const SETTLE_STILL_MS = 120;
/**
 * A reader who stops on the way in with the Lab's heading (its section's top) in the top half of the window is reading the
 * Lab: they are carried in. Lower than that, they may still be reading the section before it, and are left where they are.
 */
const GLIDE_REACH = 0.5;

// look="next" (21 Nov 2026): the same story, words and figures, with each screen redone as the result page's own UI worked by
// a cursor (LabNextScreens.jsx, its styles in lab-next.css under [data-look='next']). Loaded only when that look is asked
// for, so the default look's page carries none of its code or styles.
// The screens' own code waits further: LabNextGate.jsx keeps the server's drawing and loads LabNextScreens only as the Lab
// nears the window (21 Nov 2026, load weight on /home-next). The gate draws the screen's fit box itself.
const LabNextScreen = dynamic(() => import('./LabNextGate'));

const S = labStory();
const VERDICT = { right: 'right', wrong: 'wrong', blank: 'left blank' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The scenes' words (title, body and take) live in homeCopy.mjs, held to their word budget by landingCopy.test.mjs; only the
// icon each tab wears is chosen here.
const ICON = { chapters: BookOpen, time: Timer, changes: ArrowLeftRight, repair: Wrench, swot: LayoutGrid };
const SCENES = LAB_SCENES.map((scene) => ({ ...scene, Icon: ICON[scene.key] }));

const verdictIcon = (v, size = 12) => (v === 'right' ? <Check size={size} aria-hidden="true" /> : v === 'wrong' ? <X size={size} aria-hidden="true" /> : <Minus size={size} aria-hidden="true" />);

// ---------- 0. Chapters: where the marks went, chapter by chapter ----------
// One row per chapter, worst first: its name, how many it got right, a bar as long as its share of every lost mark, and
// the marks it lost. The bar is drawn question by question (a wrong answer's 6 solid, a blank's 5 dashed, the way the Time
// screen draws a blank), each labelled with its question. The worst chapter wears the tag the tour's Chapter review used,
// "Fix first"; the foot is that chapter's record in the mocks before this one (labStory earlierLostLine). Wide screens,
// where the device has the room (as Changes draws its clock there), also draw that record as columns, oldest first, this
// mock last: the marks the chapter lost in each (labStory swotRead partnershipLost, the SWOT's own threat figures).
function chapterWords(c, i) {
  const lost = c.lost ? `${c.lost} marks lost` : 'no marks lost';
  return `${c.chapter}: ${c.right} of ${c.of} right, ${lost}${i === 0 && c.lost ? ', fix this first' : ''}.`;
}

const HISTORY = S.earlierLine ? S.swot.partnershipLost.map((lost, i, all) => {
  const ago = all.length - 1 - i;
  return { lost, now: ago === 0, label: ago === 0 ? 'This mock' : ago === 1 ? 'Last mock' : `${ago} mocks ago` };
}) : [];
const HISTORY_MAX = Math.max(1, ...HISTORY.map((h) => h.lost));

function ChaptersPanel({ on = true }) {
  const foot = S.earlierLine ? S.earlierLine.split(/(\d+)/) : null;
  const blanks = S.chapters.some((c) => c.misses.some((m) => m.verdict === 'blank'));
  return (
    <div className="lcp lcp--chapters">
      <p className="lcp__h">Where your marks went</p>
      <p className="lcp__lead">You lost {S.lostMarks} marks in this mock. Here is where, by chapter.</p>
      <ol className="lcp-ch">
        {S.chapters.map((c, i) => (
          <li key={c.chapter} className="lcp-ch__row" data-worst={i === 0 && c.lost ? 'true' : undefined} data-clear={c.lost ? undefined : 'true'} style={{ '--i': i, '--share': c.share }}>
            <span className="lcp-ch__name" aria-hidden="true">
              <b>{c.chapter}</b>
              <small>{c.right} of {c.of} right</small>
              {i === 0 && c.lost ? <em className="lcp-ch__flag">Fix first</em> : null}
            </span>
            <b className="lcp-ch__lost" aria-hidden="true">{i === 0 && c.lost ? <Doodle mark="circle" tone="pen-dark" when={on} delay={PEN_AFTER}>{signed(-c.lost)}</Doodle> : signed(-c.lost)}</b>
            <span className="lcp-ch__track" aria-hidden="true">
              <span className="lcp-ch__bar">{c.misses.map((m) => <i key={m.n} data-verdict={m.verdict} style={{ flexGrow: m.marks }} />)}</span>
              <span className="lcp-ch__qs">{c.misses.map((m) => <small key={m.n} data-verdict={m.verdict} style={{ flexGrow: m.marks }}>Q{m.n}</small>)}</span>
            </span>
            <span className="sr-only">{chapterWords(c, i)}</span>
          </li>
        ))}
      </ol>
      <ul className="lct__key lcp-ch__key" aria-hidden="true">
        <li><i data-k="wrong" />Wrong answer</li>
        {blanks ? <li><i data-k="blank" />Left blank</li> : null}
      </ul>
      {foot ? (
        <div className="lcp-ch__was">
          <p className="lcp__foot lcp-ch__foot">{foot.map((part, i) => (i % 2 ? <b key={i} data-tone="bad">{part}</b> : part))}</p>
          <ol className="lcp-ch__mocks" aria-hidden="true">
            {HISTORY.map((h, j) => (
              <li key={h.label} data-now={h.now ? 'true' : undefined} style={{ '--v': h.lost / HISTORY_MAX, '--j': j }}>
                <b>{signed(-h.lost)}</b>
                <span className="lcp-ch__col"><i /></span>
                <small>{h.label}</small>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

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
        {t.wrongAllOver ? <>All {S.facts.wrong} wrong answers ran over pace, <b data-tone="bad">{t.overWrongTime} past it</b> between them. </> : null}
        {t.underAllRight ? <>Every answer under pace was <b data-tone="good">right</b>.</> : null}
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

function ChangesPanel({ on = true }) {
  const lostCount = S.lostQuestions.length;
  return (
    <div className="lcp lcp--changes">
      <p className="lcp__h">Every answer you changed</p>
      <p className="lcp__lead">You changed answers {S.changes.length} times across {plural(S.changes.length, 'question')}. Net effect on your marks: <b data-tone={S.net < 0 ? 'bad' : 'good'}>{signed(S.net)}</b>.</p>
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
        <p data-tone={S.net < 0 ? 'bad' : 'good'} data-net="true" style={{ '--j': 2 }}><b><Doodle mark="circle" tone={S.net < 0 ? 'pen-dark' : 'volt-pen'} when={on} delay={PEN_AFTER + 500}>{signed(S.net)}</Doodle></b>Net effect</p>
      </div>
      <NetStrip />
      <p className="lcp__fine">Clock times count from the start of the paper.</p>
    </div>
  );
}

// The paper's clock with each change on its own lane, the first pick and the final pick in their
// verdict colours. Wide screens only, where the device has the room: each change is a second thought inside
// its own question, and the clock shows where in the paper those seconds fell (two in its last three minutes).
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
function RepairPanel() {
  const record = repairRecordLine();
  return (
    <div className="lcp lcp--repair">
      <div className="lcr-head">
        <p className="lcr-head__q">Q{REPAIR.n}. Your pick {REPAIR.picked}. Key {REPAIR.key}.</p>
        <p className="lcr-head__trap">{REPAIR.trap}</p>
      </div>
      <p className="lcp-check"><ShieldCheck size={15} aria-hidden="true" />Explained from the answer key ({REPAIR.key}).</p>
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
            <p className="lcp-block__label"><i aria-hidden="true" />{b.label}</p>
            <p>{b.text}</p>
          </div>
        ))}
      </div>
      {record ? <p className="lcr-record"><b>From your record</b>{record}</p> : null}
    </div>
  );
}

// ---------- 4. SWOT: Do these next, then the four groups ----------
function SwotPanel({ on = true }) {
  return (
    <div className="lcp lcp--swot">
      <p className="lcp__h">After this mock</p>
      <div className="lcs-block">
        <p className="lcs-h">Do these next</p>
        <ol className="lcs-plan">
          {S.swot.plan.map((p, i) => (
            <li key={p.label} className="lcp-plan" data-first={i === 0 ? 'true' : undefined} style={{ '--i': i }}>
              <span className="lcp-plan__n" aria-hidden="true">{i + 1}</span>
              <div><p className="lcp-plan__label">{i === 0 ? <Doodle mark="underline" tone="volt-pen" when={on} delay={PEN_AFTER}>{p.label}</Doodle> : p.label}</p><p className="lcp-plan__why">{p.reason}</p></div>
              <span className="lcp-plan__go" aria-hidden="true">Set up</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="lcs-block">
        <p className="lcs-h">SWOT for this mock</p>
        <div className="lcp-swot">
          {S.swot.quadrants.map((q, i) => (
            <div key={q.id} className="lcp-swot__q" data-q={q.id} style={{ '--i': i }}>
              <p className="lcp-swot__label"><i aria-hidden="true" />{q.label}</p>
              <p className="lcp-swot__title">{q.title}</p>
              <p className="lcp-swot__detail">{q.detail}</p>
              {q.qs.length ? <p className="lcp-swot__see"><span>See</span>{q.qs.map((n) => <b key={n}>Q{n}</b>)}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PANELS = { chapters: ChaptersPanel, time: TimePanel, changes: ChangesPanel, repair: RepairPanel, swot: SwotPanel };

function ScreenBar({ label }) {
  return (
    <div className="lcd-bar">
      <div className="lcd-bar__title">
        <span className="lcd-bar__subject">
          <span>Accountancy<small>Sample mock</small></span>
        </span>
        <b>{S.facts.marks}<small> / {S.facts.outOf}</small></b>
      </div>
      {label ? <p className="lcd-bar__tab">{label}</p> : null}
    </div>
  );
}

function Stage({ step, pinned, reduced, live, goTo, look }) {
  const ready = pinned && !reduced;
  const next = look === 'next';
  // The next look plays itself (useLabAutoplay.js, owner LK364 and LK365): each scene's cursor, then at once the next scene,
  // pausing only while the reader acts. Its scenes are cards that stack (lab-next.css). The default look never starts it.
  const gridRef = useRef(null);
  // Where is the page: inside the held stretch (the stage stuck to the window), a little short of it (the Lab in view, its
  // top within 15 % of the window's height), or out? Read once, at the moment the autoplay would move.
  const where = useCallback(() => {
    const track = gridRef.current?.closest('.ss__track');
    if (!track) return 'in';
    const box = track.getBoundingClientRect();
    const vh = window.innerHeight;
    if (box.bottom < vh - 2) return 'out';
    return box.top <= 2 ? 'in' : box.top <= vh * 0.15 ? 'near' : 'out';
  }, []);
  // A wheel arrival that may still be put back on the first scene (useLabAutoplay ENTRY_MS): the cards' slide waits a moment.
  const arriving = useCallback((on) => { gridRef.current?.toggleAttribute('data-lnx-arriving', on); }, []);
  const auto = useLabAutoplay({ enabled: next && pinned && !reduced, live, step, steps: SCENES.length, goTo, where, arriving });
  // The first scene opens on step one, so its screen was already "on" while the lab was still far below
  // the reader and its story played unseen: the first screen (Time until round 11, Chapters now) met the
  // reader finished and still. It waits in its first frame (data-armed) while the lab is out of the window
  // and plays when half of it is in, each time the lab comes back; the scenes after it play when they come
  // on stage. It resets only once the lab is wholly out of view, so nothing visibly rewinds. Without
  // script, or before hydration, the screen is shown finished.
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    const node = gridRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry.intersectionRatio >= 0.5) setArmed(true);
      else if (!entry.isIntersecting) setArmed(false);
    }, { threshold: [0, 0.5] });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  // The next look plays only while the Lab is whole (owner LK366, 22 Nov 2026: "especially on the phone, it's getting cut
  // off"; the orchestrator's film: a reader who stopped with the Lab's heading at the top saw its device cut by the phone's
  // position band, its first scene played there unseen, then sat 34 s). The stage stands whole in the window only once it is
  // held (the track's top has reached the window's top: the sticky stage keeps clear of the site bar and the band). `held`
  // says so, from an IntersectionObserver on the track against a strip along the window's top edge (no layout read). Until
  // then a scene waits calm in its start state, and none plays.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const track = gridRef.current?.closest('.ss__track');
    if (!next || !track || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => setHeld(entries[entries.length - 1].isIntersecting), { rootMargin: HELD_STRIP, threshold: 0 });
    io.observe(track);
    return () => io.disconnect();
  }, [next]);
  // ... and a reader who stops on the way in, the Lab's heading and rail in view but its stage not yet held, is carried the
  // rest of the way: once the page has been still SETTLE_STILL_MS with no finger down, if the last move went down the page
  // and the Lab's heading is in the top half of the window (GLIDE_REACH), the page glides (the browser's own smooth scroll)
  // to the Lab's first resting place, where the story holds it and the first scene starts. A reader on the way out (moving
  // up) or with the Lab still low in the window is left where they are. Two reads (the heading's and the track's boxes) when
  // the page has come to rest, never per scroll event; a finger on the glass stops the glide (the browser's rule).
  useEffect(() => {
    const track = gridRef.current?.closest('.ss__track');
    const head = track?.closest('section') ?? track;
    if (!next || !pinned || reduced || !track || typeof IntersectionObserver === 'undefined') return undefined;
    let near = false;
    let fingers = 0;
    let timer = 0;
    let lastY = null;
    const settle = () => {
      timer = 0;
      if (!near || fingers > 0 || document.hidden) return;
      const y = window.scrollY;
      const down = lastY !== null && y > lastY + 1;
      lastY = y;
      if (!down) return;
      if (head.getBoundingClientRect().top > window.innerHeight * GLIDE_REACH) return;
      const top = track.getBoundingClientRect().top;
      if (top <= 2) return;
      window.scrollTo({ top: Math.round(y + top), behavior: 'smooth' });
    };
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(settle, SETTLE_STILL_MS); };
    const onTouch = (event) => {
      fingers = event.touches ? event.touches.length : 0;
      if (fingers > 0) { window.clearTimeout(timer); timer = 0; } else if (near) later();
    };
    const onScroll = () => { if (near) later(); };
    const io = new IntersectionObserver((entries) => {
      near = entries[entries.length - 1].isIntersecting;
      if (near && lastY === null) lastY = window.scrollY;
      if (!near) { lastY = null; window.clearTimeout(timer); timer = 0; }
    }, { threshold: 0 });
    io.observe(track);
    const opts = { capture: true, passive: true };
    for (const kind of ['touchstart', 'touchend', 'touchcancel']) window.addEventListener(kind, onTouch, opts);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      for (const kind of ['touchstart', 'touchend', 'touchcancel']) window.removeEventListener(kind, onTouch, opts);
      window.removeEventListener('scroll', onScroll, { passive: true });
      window.clearTimeout(timer);
    };
  }, [next, pinned, reduced]);
  // The first scene waits for the Lab to be half in view (armed) and, in the next look, held.
  const firstReady = next ? armed && held : armed;
  // The next look: the rail's tab and the device's tab change in the same frame as the card (critic round, 21 Nov 2026
  // evening: the old tab stayed marked for 520 to 800 ms while the new card slid in). ScrollStory writes the story's
  // data-step the moment a step is decided and React's step catches up later, in a transition; this writes the tabs' marks
  // from that attribute at once, and React's own render then writes the same values. Attributes only, no layout read.
  useEffect(() => {
    const grid = gridRef.current;
    const root = grid?.closest('.ss');
    if (!next || !root || typeof MutationObserver === 'undefined') return undefined;
    const rail = [...grid.querySelectorAll('.lc__rail button')];
    const tabs = [...grid.querySelectorAll('.lcd__tabs > span')];
    const sync = () => {
      const k = root.dataset.step;
      rail.forEach((button, i) => {
        const on = String(i) === k;
        button.dataset.on = on ? 'true' : 'false';
        if (on) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      });
      tabs.forEach((tab, i) => { tab.dataset.on = String(i) === k ? 'true' : 'false'; });
    };
    const watch = new MutationObserver(sync);
    watch.observe(root, { attributes: true, attributeFilter: ['data-step'] });
    return () => watch.disconnect();
  }, [next]);
  return (
    <div className="mm-wrap lc__grid" ref={gridRef} data-ready={ready ? 'true' : 'false'} data-look={next ? 'next' : undefined}>
      <ol className="lc__rail" aria-label="Mistake Lab, scene by scene">
        {SCENES.map(({ key, tab, Icon }, i) => {
          const state = i < step ? 'done' : i === step ? 'on' : 'off';
          return (
            <li key={key}>
              <button type="button" data-on={step === i ? 'true' : 'false'} aria-current={step === i ? 'step' : undefined} onClick={(event) => { if (next) auto.pick(); goTo(i, { instant: event.detail === 0 }); }}>
                <span className="lc__rail-ico" aria-hidden="true"><Icon size={16} /></span>
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
          <div className="lcd__tabs"><i className="lcd__tab-ink" />{SCENES.map(({ key, tab }, i) => <span key={key} data-on={step === i ? 'true' : 'false'}>{tab}</span>)}</div>
        </div>
      </div>

      {/* The mock's subject, the lamp-lit Accountancy object, sits in the screen's header beside the score
          on every screen size, inside the bezel, and drifts a little with the story. */}
      {/* Owner LK367 (22 Nov 2026), of the next look on his phone: "remove this accountancy sticker floating on the top". */}
      {next ? null : (
        <div className="lc__prop" aria-hidden="true">
          <SubjectObject id="accountancy" size={160} lit className="lc__obj" style={{ '--obj-size': 'var(--lc-obj, 160px)' }} />
        </div>
      )}

      {SCENES.map((scene, i) => {
        // The next look may say what its screen shows in its own words (LAB_SCENES `next`); the default look never reads them.
        const { key, tab, title, body, short, take, link } = next && scene.next ? { ...scene, ...scene.next } : scene;
        const Panel = PANELS[key];
        const on = pinned ? step === i : true;
        return (
          <article key={key} className="lc-scene" data-ss-step={i} data-on={on ? 'true' : 'false'} data-armed={i === 0 && !firstReady ? 'false' : 'true'} data-past={pinned && i < step ? 'true' : undefined} data-link={link ? '' : undefined} aria-labelledby={`lc-scene-${key}`}>
            <div className="lc-scene__copy">
              <p className="lc-scene__step"><span>{String(i + 1).padStart(2, '0')}</span>{tab}</p>
              <h3 className="lc-scene__title" id={`lc-scene-${key}`}>{title}</h3>
              <p className="lc-scene__body">{body}</p>
              {/* The next look's short line follows the cursor's taps (LabBeats.mjs, one plain line a beat). */}
              {next && LAB_BEATS[key] ? (
                <p className="lc-scene__body lc-scene__body--short lc-beats" aria-hidden="true">{LAB_BEATS[key].map((line, k) => <span key={k} data-k={k}>{line}</span>)}</p>
              ) : short ? <p className="lc-scene__body lc-scene__body--short" aria-hidden="true">{short}</p> : null}
              <p className="lc-scene__take">{take}</p>
              {/* The last scene's one quiet way in (round 11): only that scene carries it, and it takes taps only while
                  its scene is on stage (lab-cinema.css). */}
              {link ? <Link href={link.href} className="lp-link lc-scene__cta">{link.label}</Link> : null}
            </div>
            <figure className="lc-scene__screen" aria-label={`${tab} screen from a sample Accountancy mock`}>
              <div className="lc-scene__mini" aria-hidden="true"><ScreenBar label={tab} /></div>
              {next ? <LabNextScreen fit="0.62" scene={key} index={i} ready={pinned && held && (i !== 0 || armed)} live={pinned && held && on && (i !== 0 || armed)} still={reduced || !pinned} onDone={() => auto.done(i)} onTakeover={() => auto.take(i)} /> : <div className="lc-scene__fit" data-ss-fit="0.62"><Panel on={on && (i !== 0 || armed)} /></div>}
            </figure>
          </article>
        );
      })}
    </div>
  );
}

export default function LabCinema({ look } = {}) {
  return (
    <ScrollStory steps={SCENES.length} className="lc" label="Mistake Lab, five scenes" Content={Stage} look={look === 'next' ? 'next' : undefined} />
  );
}
