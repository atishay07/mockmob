"use client";
// Review led by weak chapters, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md 4.1 to 4.7, packet P-RR1).
// The owner's own idea (D18): "rather than review, in the review section, we can integrate the weak chapters".
//
// Order, the same on both platforms: the title and one marks line; Where you lose marks (the top 5 chapters, the first
// open, one open at a time, then "See all"); Revise as one quiet row; Saved repairs; Your papers (scores by session, N14);
// Also: Your rules and Saved questions. At 1440 the chapters lead on the left and the rest sit in one sticky column.
//
// Every number comes from data/review_chapters.mjs through body.lose (chapterRows, savedRepairs, reviewLine). The open
// chapter's Practise is the page's one lime key (data-page-primary); it follows whichever chapter is open. Each mistake has
// one action (Repair / Check it held / See repair / Try it again, section 7); tapping a row opens the free answer sheet in
// place, Repair is the paid step inside it. Nothing from R4 or LR-1017 is deleted (section 4.6 maps each piece).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { PaperTrend } from '@/components/ai/RecordGlimpse';
import { useRuleBook } from '@/components/rules/useRuleBook';
import { bookRules } from '@/../data/rule_book';
import { aiRenewsLine, shortDate } from '@/../data/review_input.mjs';
import { NEXT_MOVE_RULES, chapterPracticeClause } from '@/../data/result_next_move.mjs';
import { useMyDailySet } from '@/components/useMyDailySet';
import AnswerSheet from './AnswerSheet';
import { LessonLink, subjectId } from './ChapterRows';
import { Pair } from './PapersView';
import MobEntry from '@/components/mob/MobEntry';
import './review-1018.css';

const SHOWN = 5;
const SAVED_SHOWN = 4;
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
  return `Each repair is 1 AI credit${have === null ? '' : `; you have ${have}`}.${renews} No charge if a repair cannot be written. Seeing the answer and trying again are free.`;
}

/** One mistake under the open chapter: badge, the stem's first line, its paper and time, the pick, and Repair.
 *  Repair opens the same sealed sheet as the row (Try it again, Show the answer, Repair Qn for 1 AI credit): the paid step
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
        {/* One Repair entry at a time: the row's key opens the sheet, and once it is open the sheet's own "Repair Qn, 1 AI credit"
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

function WeakChapters({ lose, byUid, wallet, openId, setOpenId, openUid, setOpenUid, onChanged }) {
  const rows = lose.rows;
  const [all, setAll] = useState(() => rows.findIndex((r) => r.id === openId) >= SHOWN);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);
  return (
    <section className="rv8-wk" aria-labelledby="rv8-wk-h">
      <div className="rv8-sechead"><h2 id="rv8-wk-h">Where you lose marks</h2><span>Most marks first</span></div>
      <p className="rv8-sub">{lose.across} Practise the chapter, then repair its mistakes one at a time.</p>
      {rows.length ? (
        <ul className="rv8-chs">
          {shown.map((row) => (
            <ChapterRow key={row.id} row={row} open={openId === row.id} wallet={wallet} byUid={byUid} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged}
              onToggle={() => { setOpenUid(null); setOpenId(openId === row.id ? null : row.id); }} />
          ))}
        </ul>
      ) : <p className="rv8-sub">Every answer on your papers was right, so no chapter lost marks.</p>}
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

function SavedRepairs({ lose, byUid, wallet, openUid, setOpenUid, onChanged }) {
  const saved = lose.saved;
  const [all, setAll] = useState(false);
  if (!saved.length) return null;
  const shown = all ? saved : saved.slice(0, SAVED_SHOWN);
  return (
    <section className="rv8-sec rv8-saved" aria-labelledby="rv8-sv-h">
      <div className="rv8-sechead"><h2 id="rv8-sv-h">Saved repairs</h2><span>{saved.length}, each opens free</span></div>
      {lose.savedLine ? <p className="rv8-sub">{lose.savedLine}</p> : null}
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

function PapersList({ body, stamps }) {
  const papers = body.papers || [];
  if (!papers.length) return null;
  return (
    <section className="rv8-sec rv8-papers" aria-labelledby="rv8-pp-h">
      <div className="rv8-sechead"><h2 id="rv8-pp-h">Your papers</h2><span>Newest first</span></div>
      <Pair papers={papers} bare />
      <div className="rv8-trend"><PaperTrend /></div>
      <ul className="rv8-pps">
        {papers.map((p) => (
          <li key={p.id}>
            <Link className="rv8-pp mk-press" href={`/result/${encodeURIComponent(p.id)}`}>
              <span className="rv8-pp__obj" aria-hidden="true"><SubjectObject id={subjectId(p.subject)} size={44} framed={false} /></span>
              <b>{p.name}, {p.subjectName || p.subject}</b>
              <span className="rv8-pp__meta">{stamps.get(p.id) || p.when}. {Number(p.wrong) || 0} wrong, {Number(p.blank) || 0} blank.</span>
              <span className="rv8-pp__sc">{p.score}<small>of {p.of}</small></span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="rv8-link" href="/mentor?tab=record">See your full record</Link>
    </section>
  );
}

function Also() {
  const rules = useRuleBook();
  const saved = useSavedCount();
  const book = rules.state === 'ready' ? rules.data?.book : null;
  const ruleCount = book ? bookRules(book).length : null;
  return (
    <section className="rv8-sec rv8-also" aria-label="Also in Review">
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

export default function ReviewChapters({ body, onChanged }) {
  const lose = body.lose;
  const items = useMemo(() => body.items || [], [body.items]);
  const byUid = useMemo(() => new Map(items.map((i) => [i.uid, i])), [items]);
  const stamps = useMemo(() => new Map((lose.paperStamps || []).map((p) => [p.id, p.stamp])), [lose.paperStamps]);
  // The first chapter is open on arrival; ?chapter= (or the lesson's ?open=) opens another, ?q= opens a question in it.
  const [openId, setOpenIdState] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const want = p.get('chapter') || p.get('open');
      if (want && lose.rows.some((r) => r.id === want)) return want;
      const q = p.get('q');
      const ch = q ? byUid.get(q)?.chapterId : null;
      if (ch && lose.rows.some((r) => r.id === ch)) return ch;
    } catch { /* first chapter */ }
    return lose.rows[0]?.id || null;
  });
  const [openUid, setOpenUidState] = useState(() => { try { return new URLSearchParams(window.location.search).get('q'); } catch { return null; } });
  const setOpenId = useCallback((id) => { setOpenIdState(id); setUrl(id, null); }, []);
  const setOpenUid = useCallback((uid) => { setOpenUidState(uid); setUrl(openId, uid); }, [openId]);
  // A question, or a chapter other than the first, asked for in the URL is brought into view once.
  useEffect(() => {
    const target = openUid ? `rv8-q-${openUid.replace(/[^A-Za-z0-9_-]/g, '-')}` : openId && openId !== lose.rows[0]?.id ? `rv8-row-${openId.replace(/[^A-Za-z0-9_-]/g, '-')}` : null;
    if (!target) return undefined;
    const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }), 240);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const line = lose.line;
  return (
    <>
      <h1 className="display-md rvw-title rv8-title">Review</h1>
      <p className="rv8-lede">
        {line.lost ? <>{line.who} lost <b>{line.lost} marks</b>: {line.what}.{line.fixed}</> : line.text}
      </p>
      <div className="rv8-board">
        <WeakChapters lose={lose} byUid={byUid} wallet={body.wallet} openId={openId} setOpenId={setOpenId} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
        <div className="rv8-side">
          <ReviseRow due={body.reviseDue} answeredToday={body.revise?.answeredToday || 0} />
          <SavedRepairs lose={lose} byUid={byUid} wallet={body.wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
          <PapersList body={body} stamps={stamps} />
          <Also />
        </div>
      </div>
    </>
  );
}
