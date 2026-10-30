"use client";
// Review, 19 Oct 2026 (owner G25 and D106; PLAN-1019): "At the top, it's not showing the core statistics like it used to
// show ... Nothing left to repair, then so many questions ... then chapters ... I can't even access this properly."
//
// Order, top to bottom, the same as the app's D106:
//   1. the stats strip (restored from ad381711's receipt strip, shaped as D106): papers sat, the latest marks with their trend,
//      mistakes to repair, repaired. Numbers count from what the student saw last time (700 ms, ease-out cubic).
//   2. the subject filter: chips with a sideways-scroll cue (railCue.js); it scopes everything on the page, the strip included.
//   3. Your papers: newest first, each row the paper, its subject, its marks out of the maximum and its day and 12-hour time;
//      a tap opens that paper's result and answers. The newest five, then "Show all".
//   4. Mistakes to repair, by chapter (the pass 1018 "Where you lose marks" content, D18), most marks lost first. A chapter
//      opens on arrival only when it has a mistake to repair: never one whose header would read "Nothing left to repair".
// At 1440 the papers and the chapters lead on the left; Revise, Saved repairs and the rest sit in one sticky column.
//
// Every number comes from data/review_chapters.mjs through body.lose and from body.papers, so the strip, the rows and the
// chapters agree: "To repair" is the sum of the chapters' "N mistakes to repair", "Repaired" is the Saved repairs count,
// "Papers sat" is every paper the student sat (the server's count; the rows list the newest 40) and "Latest marks" is the
// first row. The open chapter's Practise is the
// page's one lime key (data-page-primary). Each mistake has one action (Repair / Check it held / See repair / Try it again,
// section 7); tapping a row opens the free answer sheet in place, Repair is the paid step inside it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { InlineNudge } from '@/components/pro';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { PaperTrend } from '@/components/ai/RecordGlimpse';
import { useRuleBook } from '@/components/rules/useRuleBook';
import { bookRules } from '@/../data/rule_book';
import { aiRenewsLine } from '@/../data/review_input.mjs';
import { NEXT_MOVE_RULES, chapterPracticeClause } from '@/../data/result_next_move.mjs';
import { useMyDailySet } from '@/components/useMyDailySet';
import AnswerSheet from './AnswerSheet';
import { LessonLink, subjectId } from './ChapterRows';
import { ChapterKeycardsLink } from '@/components/keycards/KeycardsLinks';
import MobEntry from '@/components/mob/MobEntry';
import { useAuth } from '@/components/AuthProvider';
import { useRailCue } from '@/components/start/railCue';
import { firstOpen, paperCountsOf, scopeOf, statsOf, subjectLabel, subjectsOf } from './reviewScope.mjs';
import './review-1018.css';

const SHOWN = 5;
const SAVED_SHOWN = 4;
const PAPERS_SHOWN = 5;
const SEEN_KEY = 'mm:review:stats:v1';
const MINUS = '−';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ended = (s) => /[.?!:…)]$/.test(String(s).trim());
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

function Chev({ dir = 'down' }) {
  return <svg className="rv8-chev" data-dir={dir} viewBox="0 0 24 24" aria-hidden="true"><path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'} /></svg>;
}

/** The URL holds the open chapter (?chapter=) and an opened question (?q=), so Back and a lesson link return to it. */
function setUrl(chapter, q) {
  try {
    const p = new URLSearchParams(window.location.search);
    if (chapter) p.set('chapter', chapter); else p.delete('chapter');
    p.delete('open');
    if (q) p.set('q', q); else p.delete('q');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
  } catch { /* the URL is a convenience only */ }
}

function useSavedCount() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let alive = true;
    apiGet('/api/bookmarks').then((b) => { if (alive) setCount(Number.isFinite(b?.count) ? b.count : null); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return count;
}

/** "D yours": the student's pick. The key stays hidden until the sheet asks (Try it again comes first, L13). */
function Pick({ letter }) {
  if (!letter) return null;
  return <span className="rv8-pick"><i>{letter}</i>yours</span>;
}

function practiseLine(wallet, allRepaired, dailySet) {
  const lead = allRepaired ? 'Practise to prove it on new questions. ' : '';
  const n = NEXT_MOVE_RULES.setSize;
  const base = `${n} new questions, about ${n} minutes.`;
  // The price follows today's included set: free names no number, an unread allowance names none (src/lib/dailySet.mjs).
  return `${lead}${base} ${chapterPracticeClause({ isPremium: Boolean(wallet?.isPremium), practiceCredits: wallet?.practiceCredits, dailySet })}`;
}

function costLine(wallet) {
  const have = Number.isFinite(wallet?.aiCredits) ? wallet.aiCredits : null;
  const renews = aiRenewsLine(wallet) ? ` ${aiRenewsLine(wallet)}` : '';
  return `Each repair is 1 credit${have === null ? '' : `; you have ${have}`}.${renews} No charge if a repair cannot be written. Seeing the answer and trying again are free.`;
}

/** One mistake under the open chapter: badge, the stem's first line, its paper and time, the pick, and Repair.
 *  Repair opens the same sealed sheet as the row (Try it again, Show the answer, Repair Qn for 1 credit): the paid step
 *  is only ever the student's tap inside it, as on the result page (W-032). */
function MistakeRow({ row, item, wallet, open, onOpen, onRepair, onChanged }) {
  return (
    <li className="rv8-mk" data-open={open || undefined} id={`rv8-q-${row.uid.replace(/[^A-Za-z0-9_-]/g, '-')}`}>
      <div className="rv8-mk__row">
        <button type="button" className="rv8-mk__main mk-press" aria-expanded={open} onClick={onOpen}>
          <span className="rv8-qb">{row.number}</span>
          <span className="rv8-mk__text">
            <b>{row.stem || `Question ${row.number}`}{row.stem && !ended(row.stem) ? '…' : ''}</b>
            <span className="rv8-when">{row.stamp}</span>
            <Pick letter={row.pick} />
          </span>
        </button>
        {/* One Repair entry at a time: the row's key opens the sheet, and once it is open the sheet's own "Repair Qn, 1 credit"
            is the entry, so the paid action is never offered twice (F11). */}
        {open ? null : <button type="button" className="rv8-act mk-press" onClick={onRepair} aria-label={`Repair question ${row.number}`}>Repair</button>}
      </div>
      {open && item ? <AnswerSheet key={item.uid} item={item} wallet={wallet} onChanged={onChanged} stemInRow /> : null}
    </li>
  );
}

function ChapterFoot({ row, byUid, wallet, openUid, setOpenUid, onChanged }) {
  const blank = row.blanks;
  const fixed = row.repaired;
  const slipped = fixed.filter((r) => r.state === 'slipped');
  const openBlank = blank.find((b) => b.uid === openUid);
  const first = row.open[0] || blank[0] || fixed[0];
  return (
    <div className="rv8-foot">
      {blank.length ? (
        <p>
          <b>{blank.length} left blank:</b>{' '}
          {blank.map((b, i) => (
            <span key={b.uid}>{i ? '; ' : ''}<button type="button" className="rv8-inline" aria-expanded={openUid === b.uid} onClick={() => setOpenUid(openUid === b.uid ? null : b.uid)}>Q{b.number}, {b.paperName}</button></span>
          ))}. Try {blank.length === 1 ? 'it' : 'them'} again, free.
        </p>
      ) : null}
      {openBlank && byUid.get(openBlank.uid) ? <AnswerSheet key={openBlank.uid} item={byUid.get(openBlank.uid)} wallet={wallet} onChanged={onChanged} /> : null}
      {fixed.length ? (
        <p>
          <b>{fixed.length} repaired:</b>{' '}
          {fixed.map((r) => `Q${r.number} from ${r.paperName}`).join(', ')}
          {slipped.length ? (fixed.length === 1 ? ', which slipped on a new question' : `; ${slipped.length} slipped on a new question`) : ''}.{' '}
          {fixed.length === 1 ? 'It is' : 'They are'} in Saved repairs.
        </p>
      ) : null}
      <p className="rv8-fine">{costLine(wallet)}</p>
      {first ? <LessonLink subject={subjectId(row.subject)} chapter={row.name} from={{ kind: 'q', attemptId: first.paper, number: first.number }} /> : null}
      <ChapterKeycardsLink subject={subjectId(row.subject)} chapter={row.name} />
    </div>
  );
}

function ChapterRow({ row, open, onToggle, wallet, byUid, openUid, setOpenUid, onChanged }) {
  const panel = `rv8-ch-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const href = `/dashboard?${new URLSearchParams({ subject: subjectId(row.subject), mode: 'quick', count: String(NEXT_MOVE_RULES.setSize), chapter: row.name })}`;
  const allRepaired = !row.open.length;
  const dailySet = useMyDailySet();
  return (
    <li className="rv8-ch" data-open={open || undefined} id={`rv8-row-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}`}>
      <button type="button" className="rv8-ch__bar mk-press" aria-expanded={open} aria-controls={open ? panel : undefined} onClick={onToggle}>
        <span className="rv8-ch__obj" aria-hidden="true"><SubjectObject id={subjectId(row.subject)} size={48} framed={false} /></span>
        <span className="rv8-ch__name">{row.name}</span>
        <span className="rv8-ch__lost"><span className="sr-only">Lost </span>{MINUS}{row.lost}<small>marks</small></span>
        <span className="rv8-ch__meta"><b>{row.line.lead}</b>{row.line.rest}</span>
        <span className="rv8-ch__track"><span className="rv8-track" aria-hidden="true"><i style={{ transform: `scaleX(${row.share})` }} /></span><Chev /></span>
      </button>
      {open ? (
        <div className="rv8-ch__body" id={panel}>
          <div className="rv8-practise">
            <Link className="btn-volt rv8-volt mk-press" data-page-primary="" href={href}>Practise {NEXT_MOVE_RULES.setSize} on this chapter</Link>
            <p>{practiseLine(wallet, allRepaired, dailySet)}</p>
            {/* Free only (D79): one quiet line under the chapter's practice key. */}
            {wallet?.isPremium ? null : <InlineNudge placement="review_chapter" facts={{ focusChapter: row.name }} />}
          </div>
          <div className="rv8-mkhead"><span>{row.open.length ? `${plural(row.open.length, 'mistake')} to repair` : 'Nothing left to repair'}</span>{row.open.length ? <small>Newest first</small> : null}</div>
          {row.open.length ? (
            <ul className="rv8-mks" aria-label={`Mistakes to repair in ${row.name}`}>
              {row.open.map((m) => (
                <MistakeRow key={m.uid} row={m} item={byUid.get(m.uid)} wallet={wallet} open={openUid === m.uid}
                  onOpen={() => setOpenUid(openUid === m.uid ? null : m.uid)}
                  onRepair={() => setOpenUid(m.uid)} onChanged={onChanged} />
              ))}
            </ul>
          ) : null}
          <ChapterFoot row={row} byUid={byUid} wallet={wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
        </div>
      ) : null}
    </li>
  );
}

function WeakChapters({ rows, line, scopeName, hasPapers, startHref, byUid, wallet, openId, setOpenId, openUid, setOpenUid, onChanged }) {
  const [all, setAll] = useState(() => rows.findIndex((r) => r.id === openId) >= SHOWN);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);
  return (
    <section className="rv8-wk" aria-labelledby="rv8-wk-h">
      <div className="rv8-sechead"><h2 id="rv8-wk-h">Mistakes to repair</h2><span>Most marks lost first</span></div>
      {rows.length ? (
        <>
          <p className="rv8-sub">{line.lost ? <>{line.who} lost <b>{line.lost} marks</b>: {line.what}.{line.fixed}</> : line.text} Practise a chapter, then repair its mistakes one at a time.</p>
          <ul className="rv8-chs">
            {shown.map((row) => (
              <ChapterRow key={row.id} row={row} open={openId === row.id} wallet={wallet} byUid={byUid} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged}
                onToggle={() => { setOpenUid(null); setOpenId(openId === row.id ? null : row.id); }} />
            ))}
          </ul>
        </>
      ) : hasPapers ? (
        <p className="rv8-sub">Every answer on your {scopeName ? `${scopeName} ` : ''}papers was right, so no chapter lost marks.</p>
      ) : (
        <p className="rv8-sub">After your first {scopeName ? `${scopeName} ` : ''}paper, every mistake lands here by chapter, with the marks it cost you.</p>
      )}
      {rest.length && !all ? (
        <button type="button" className="rv8-seeall mk-press" aria-expanded={false} onClick={() => setAll(true)}>
          <span><b>See all {rows.length} chapters</b> {rest.map((r) => `${r.name} ${MINUS}${r.lost}`).join(', ')}</span>
          <Chev />
        </button>
      ) : null}
    </section>
  );
}

function ReviseRow({ due, answeredToday }) {
  if (!due) return null;
  const done = !due.total && answeredToday > 0;
  const head = done ? 'Done for today' : due.head;
  const line = done ? 'Nothing else is due today. The next ones come back tomorrow.' : due.total ? due.row : 'Nothing is due today. Questions you get wrong come back after 1, 3, 7 and 21 days.';
  return (
    <Link className="rv8-revise mk-press" href="/review/revise">
      <b>Revise <span>{head.replace(/^(\d+) due today$/, '$1 due today')}</span></b>
      <span>{line}</span>
      <Chev dir="right" />
    </Link>
  );
}

function SavedRepairs({ saved, savedLine, byUid, wallet, openUid, setOpenUid, onChanged }) {
  const [all, setAll] = useState(false);
  if (!saved.length) return null;
  const shown = all ? saved : saved.slice(0, SAVED_SHOWN);
  return (
    <section className="rv8-sec rv8-saved" aria-labelledby="rv8-sv-h">
      <div className="rv8-sechead"><h2 id="rv8-sv-h">Saved repairs</h2><span>{saved.length}, each opens free</span></div>
      {savedLine ? <p className="rv8-sub">{savedLine}</p> : null}
      <ul className="rv8-svs">
        {shown.map((s) => {
          const item = byUid.get(s.uid);
          const open = openUid === s.uid;
          return (
            <li key={s.uid} className="rv8-sv" data-open={open || undefined}>
              <div className="rv8-sv__row">
                <span className="rv8-qb" data-k={s.kind}>{s.number}</span>
                <span className="rv8-sv__text">
                  <b>{s.chapter}</b>
                  <span className="rv8-when">{s.stamp}</span>
                  <span className="rv8-st" data-k={s.kind}>{s.line}</span>
                </span>
                <button type="button" className="rv8-act mk-press" aria-expanded={open} onClick={() => setOpenUid(open ? null : s.uid)}>{s.action}</button>
              </div>
              {open && item ? <AnswerSheet key={s.uid} item={item} wallet={wallet} onChanged={onChanged} /> : null}
            </li>
          );
        })}
      </ul>
      {saved.length > SAVED_SHOWN && !all ? <button type="button" className="rv8-seeall mk-press" onClick={() => setAll(true)}><span><b>Show all {saved.length}</b></span><Chev /></button> : null}
    </section>
  );
}

/** Your papers (D106): newest first, the newest five and then all of them. A row is the paper, its subject, its marks out of
 *  the maximum and its day and 12-hour time; the whole row opens that paper's result and answers. ?paper= marks one row. */
function PapersList({ papers, total = papers.length, stamps, scopeName, startHref, current, showTrend }) {
  const at = current ? papers.findIndex((p) => p.id === current) : -1;
  const [all, setAll] = useState(() => at >= PAPERS_SHOWN);
  const shown = all ? papers : papers.slice(0, PAPERS_SHOWN);
  return (
    <section className="rv8-sec rv8-papers" aria-labelledby="rv8-pp-h">
      <div className="rv8-sechead"><h2 id="rv8-pp-h">Recent papers</h2><span>Newest first</span></div>
      {papers.length ? (
        <ul className="rv8-pps">
          {shown.map((p) => (
            <li key={p.id}>
              <Link className="rv8-pp mk-press" id={`rv8-pp-${String(p.id).replace(/[^A-Za-z0-9_-]/g, '-')}`} href={`/result/${encodeURIComponent(p.id)}`} aria-current={p.id === current ? 'true' : undefined}>
                <span className="rv8-pp__obj" aria-hidden="true"><SubjectObject id={subjectId(p.subject)} size={44} framed={false} /></span>
                <b>{p.name}, {p.subjectName || subjectLabel(p.subject)}</b>
                <span className="rv8-pp__meta">{stamps.get(p.id) || p.when}. {Number(p.wrong) || 0} wrong, {Number(p.blank) || 0} blank.</span>
                <span className="rv8-pp__sc">{p.score}<small>of {p.of}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rv8-none">
          <p>No {scopeName ? `${scopeName} ` : ''}papers yet. Sit your first set and it lands here with its marks; tap it to see every answer.</p>
          <Link className="btn-volt rv8-volt mk-press" data-page-primary="" href={startHref}>Start 10 questions{scopeName ? ` in ${scopeName}` : ''}</Link>
        </div>
      )}
      {papers.length > PAPERS_SHOWN && !all ? (
        <button type="button" className="rv8-seeall mk-press" aria-expanded={false} onClick={() => setAll(true)}>
          <span><b>{total > papers.length ? `Show the newest ${papers.length} papers` : `Show all ${papers.length} papers`}</b></span>
          <Chev />
        </button>
      ) : null}
      {showTrend ? <div className="rv8-trend"><PaperTrend /></div> : null}
      {papers.length ? <Link className="rv8-link" href="/mentor?tab=record">See your full record</Link> : null}
    </section>
  );
}

function Also() {
  const rules = useRuleBook();
  const saved = useSavedCount();
  const book = rules.state === 'ready' ? rules.data?.book : null;
  const ruleCount = book ? bookRules(book).length : null;
  return (
    <section className="rv8-sec rv8-also" aria-label="Also in Your papers">
      <Link className="rv8-qrow mk-press" href="/review/rules">
        <b>Your rules{Number.isFinite(ruleCount) ? ` (${ruleCount})` : ''}</b>
        <span>{book?.active?.text ? `For your next mock: ${book.active.text}` : 'Rules from your repairs and from how you take papers. Choose one for your next mock.'}</span>
        <Chev dir="right" />
      </Link>
      <MobEntry where="review" />
      <Link className="rv8-qrow mk-press" href="/saved">
        <b>Saved questions{Number.isFinite(saved) ? ` (${saved})` : ''}</b>
        <span>Questions you marked to look at again.</span>
        <Chev dir="right" />
      </Link>
    </section>
  );
}

// ---------- The stats strip, the subject filter and the scope (owner G25, D106) ----------

const motionOff = () => { try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

/** A figure that counts from the number shown before to the new one (700 ms, ease-out cubic), as the 17 Oct receipt
 *  strip did. Reduced motion shows the new number at once. */
function Roll({ value, from = value }) {
  const start0 = Number.isFinite(from) ? from : value;
  const last = useRef(start0);
  const [shown, setShown] = useState(() => (motionOff() ? value : start0));
  useEffect(() => {
    const start = last.current;
    last.current = value;
    const instant = start === value || motionOff();
    let raf = 0;
    let t0 = 0;
    const step = (t) => {
      t0 ||= t;
      const p = instant ? 1 : Math.min((t - t0) / 700, 1);
      setShown(Math.round(start + (value - start) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

function StatsStrip({ stats, seen, scopeName }) {
  const from = (k) => (seen && Number.isFinite(seen[k]) ? seen[k] : undefined);
  return (
    <section className="rv8-stats" aria-label={scopeName ? `Your record in ${scopeName}` : 'Your record'}>
      {/* The figures rise in order, 45 ms apart (mk-stagger, owner G31): the lit build's stat strip entrance. */}
      <dl className="rv8-stats__row mk-stagger">
        <div data-k="papers">
          <dt>Papers sat</dt>
          <dd><b className="rv8-stats__fig"><Roll value={stats.papers} from={from('papers')} /></b><span className="rv8-stats__note">{stats.papersNote}</span></dd>
        </div>
        <div data-k="latest">
          <dt>Latest marks</dt>
          <dd>
            <b className="rv8-stats__fig">{stats.latest === null ? <span className="rv8-stats__none">None yet</span> : <><Roll value={stats.latest} from={from('latest')} /><small>of {stats.latestOf}</small></>}</b>
            <span className="rv8-stats__note">{stats.latestNote}</span>
            {stats.trend ? <span className="rv8-stats__trend" data-dir={stats.trend.dir}>{stats.trend.text}</span> : null}
          </dd>
        </div>
        <div data-k="open" data-zero={stats.toRepair ? undefined : ''}>
          <dt>To repair</dt>
          <dd><b className="rv8-stats__fig"><Roll value={stats.toRepair} from={from('toRepair')} /></b><span className="rv8-stats__note">{stats.toRepairNote}</span></dd>
        </div>
        <div data-k="repaired" data-zero={stats.repaired ? undefined : ''}>
          <dt>Repaired</dt>
          <dd><b className="rv8-stats__fig"><Roll value={stats.repaired} from={from('repaired')} /></b><span className="rv8-stats__note">{stats.repairedNote}</span></dd>
        </div>
      </dl>
    </section>
  );
}

/** The subject filter: chips in one sideways row, with the scroll cue (fade, chevron, a one-time nudge; railCue.js). */
function SubjectFilter({ subjects, value, total, onChange }) {
  const rowRef = useRef(null);
  const hintRef = useRef(null);
  const { edges } = useRailCue(rowRef, { items: '.rv8-chip', uniform: false, nudgeKey: 'mm:cue:review-subjects:v1', hintRef, count: subjects.length + 1 });
  const step = () => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: Math.round(el.clientWidth * 0.6), behavior: motionOff() ? 'auto' : 'smooth' });
  };
  const chip = (id, name, n) => (
    <button key={id} type="button" className="rv8-chip mk-press" aria-pressed={value === id} data-empty={n ? undefined : ''} onClick={() => onChange(id)}>
      {name}<small><span className="sr-only">, </span>{n}<span className="sr-only"> {n === 1 ? 'paper' : 'papers'}</span></small>
    </button>
  );
  return (
    <div className="rv8-filter" data-overflow={edges.overflow || undefined} data-at-start={edges.start || undefined} data-at-end={edges.end || undefined}>
      <div className="rv8-chips" ref={rowRef} role="group" aria-label="Show papers and mistakes for">
        {chip('all', 'All subjects', total)}
        {subjects.map((x) => chip(x.id, x.name, x.n))}
      </div>
      <button ref={hintRef} type="button" className="rv8-filter__hint" tabIndex={-1} aria-hidden="true" onClick={step}>
        <span className="rv8-filter__disc"><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
      </button>
    </div>
  );
}

function urlParam(name) { try { return new URLSearchParams(window.location.search).get(name); } catch { return null; } }
function setSubjectParam(subject) {
  try {
    const p = new URLSearchParams(window.location.search);
    if (subject && subject !== 'all') p.set('subject', subject); else p.delete('subject');
    p.delete('chapter'); p.delete('open'); p.delete('q');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
  } catch { /* the URL is a convenience only */ }
}
export default function ReviewChapters({ body, onChanged }) {
  const { user } = useAuth();
  const lose = body.lose;
  const items = useMemo(() => body.items || [], [body.items]);
  const byUid = useMemo(() => new Map(items.map((i) => [i.uid, i])), [items]);
  const stamps = useMemo(() => new Map((lose.paperStamps || []).map((p) => [p.id, p.stamp])), [lose.paperStamps]);
  const counts = useMemo(() => paperCountsOf(body), [body]);
  const subjects = useMemo(() => subjectsOf(body.papers || [], user?.subjects, counts), [body.papers, user?.subjects, counts]);
  const [subject, setSubjectState] = useState(() => {
    const want = urlParam('subject');
    return want && subjects.some((x) => x.id === subjectId(want)) ? subjectId(want) : 'all';
  });
  const scopeName = subject === 'all' ? '' : subjects.find((x) => x.id === subject)?.name || subjectLabel(subject);
  const scope = useMemo(() => scopeOf(body, subject, scopeName), [body, subject, scopeName]);
  const stats = useMemo(() => statsOf(scope, scopeName), [scope, scopeName]);
  // What the student saw last time (all subjects), read once; the new figures are kept for the next visit.
  const [seen] = useState(() => { try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || 'null'); } catch { return null; } });
  useEffect(() => {
    if (subject !== 'all') return;
    try { window.localStorage.setItem(SEEN_KEY, JSON.stringify({ papers: stats.papers, latest: stats.latest, toRepair: stats.toRepair, repaired: stats.repaired })); } catch { /* fine without storage */ }
  }, [subject, stats]);
  // ?chapter= (or the lesson's ?open=) opens a chapter, ?q= a question in it; otherwise the first chapter with a mistake to
  // repair opens, and none when every chapter is repaired.
  const asked = useRef(Boolean(urlParam('chapter') || urlParam('open') || urlParam('q') || urlParam('paper')));
  const [openId, setOpenIdState] = useState(() => {
    const want = urlParam('chapter') || urlParam('open');
    if (want && scope.rows.some((r) => r.id === want)) return want;
    const q = urlParam('q');
    const ch = q ? byUid.get(q)?.chapterId : null;
    if (ch && scope.rows.some((r) => r.id === ch)) return ch;
    return firstOpen(scope.rows);
  });
  const [openUid, setOpenUidState] = useState(() => urlParam('q'));
  const setOpenId = useCallback((id) => { setOpenIdState(id); setUrl(id, null); }, []);
  const setOpenUid = useCallback((uid) => { setOpenUidState(uid); setUrl(openId, uid); }, [openId]);
  const pickSubject = useCallback((next) => {
    if (next === subject) return;
    setSubjectState(next);
    setSubjectParam(next);
    const rows = next === 'all' ? lose.rows : lose.rows.filter((r) => subjectId(r.subject) === next);
    setOpenUidState(null);
    setOpenIdState(firstOpen(rows));
  }, [subject, lose.rows]);
  const [current] = useState(() => urlParam('paper'));
  // A question, a chapter or a paper asked for in the URL is brought into view once.
  useEffect(() => {
    if (!asked.current) return undefined;
    const clean = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, '-');
    const target = openUid ? `rv8-q-${clean(openUid)}` : current ? `rv8-pp-${clean(current)}` : openId ? `rv8-row-${clean(openId)}` : null;
    if (!target) return undefined;
    const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }), 240);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lead = subjects.find((x) => x.id === subject) || subjects[0];
  const startHref = `/dashboard?${new URLSearchParams({ subject: (subject === 'all' ? lead?.id : subject) || '', mode: 'quick', count: '10' })}`;
  return (
    <>
      <h1 className="display-md rvw-title rv8-title">Your papers</h1>
      <StatsStrip stats={stats} seen={subject === 'all' ? seen : null} scopeName={scopeName} />
      {subjects.length > 1 ? <SubjectFilter subjects={subjects} value={subject} total={scopeOf(body, 'all').total ?? (body.papers || []).length} onChange={pickSubject} /> : null}
      <div className="rv8-board">
        <div className="rv8-main">
          <PapersList key={`papers-${subject}`} papers={scope.papers} total={stats.papers} stamps={stamps} scopeName={scopeName} startHref={startHref} current={current} showTrend={subject === 'all'} />
          <WeakChapters key={`chapters-${subject}`} rows={scope.rows} line={scope.line} scopeName={scopeName} hasPapers={scope.papers.length > 0} startHref={startHref} byUid={byUid} wallet={body.wallet} openId={openId} setOpenId={setOpenId} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
        </div>
        <div className="rv8-side">
          <ReviseRow due={body.reviseDue} answeredToday={body.revise?.answeredToday || 0} />
          <SavedRepairs key={`saved-${subject}`} saved={scope.saved} savedLine={scope.savedLine} byUid={byUid} wallet={body.wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
          <Also />
        </div>
      </div>
    </>
  );
}
