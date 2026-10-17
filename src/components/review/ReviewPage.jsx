"use client";
// Review, pass 1017 (docs/design-decisions/pass-1017/LEARN-REVIEW-1017.md 5.2 to 5.7, packet P-LR1). One read
// (GET /api/me/review), two views: Mistakes (the one next move, the receipt, Revise, the open mistakes by chapter priced
// in marks, Also in Review) and Papers (no next-move panel). The move is the shared nextMove() through reviewMove(): no
// rule lives in this file. A failed read is the failure state with its own room, never the empty state (L12).
//
// The view is in the URL (?view=papers; the preview passes another name because its own `view` picks the page).
// ?open={chapterId}&q={attemptId}:{n} opens a chapter at one question (the lesson's "Back to Question 42" lands there).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import SceneVignette from '@/components/scenes/SceneVignette';
import { useRuleBook } from '@/components/rules/useRuleBook';
import { bookRules } from '@/../data/rule_book';
import { reviewMove } from '@/../data/review_input.mjs';
import { clockTime, practiceCostLine } from '@/../data/result_next_move.mjs';
import { SUBJECTS } from '@/../data/subjects';
import { recordFromBody } from './reviewRecord.mjs';
import ReviewNextMove from './ReviewNextMove';
import ReceiptStrip from './ReceiptStrip';
import ChapterRows, { ItemList } from './ChapterRows';
import PapersView from './PapersView';
import './review-1017.css';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinNames = (list) => (list.length <= 1 ? list[0] || '' : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/** The cause a failed read names, in the student's words. */
function causeOf(error) {
  if (error?.kind === 'network') return 'Your connection dropped';
  if (error?.status === 401) return 'You are signed out';
  if (error?.status === 429) return 'Too many tries in a row';
  if (error?.status >= 500 || error?.body?.state === 'unavailable') return 'Our server did not answer in time';
  return 'Something went wrong on our side';
}

function Loading() {
  // The control, the panel, the strip and three rows: no figure and no sentence that could turn out wrong.
  return (
    <div className="rvw-skel" role="status" aria-label="Loading your mistakes">
      <i className="rvw-skel__seg" />
      <div className="rvw-skel__board">
        <i className="rvw-skel__panel" />
        <div><i className="rvw-skel__strip" /><i className="rvw-skel__row" /><i className="rvw-skel__row" /><i className="rvw-skel__row" /></div>
      </div>
    </div>
  );
}

function Failed({ cause, at, onRetry, retrying }) {
  return (
    <section className="rvw-state" aria-labelledby="rvw-fail-h">
      <SceneVignette scene="unreachable" entrance="oops" />
      <h2 id="rvw-fail-h">Your mistakes did not load</h2>
      <p>{cause}. Your papers and repairs are safe.</p>
      <button type="button" className="btn-volt rvw-state__key mk-press" data-page-primary="" onClick={onRetry} disabled={retrying}>{retrying ? 'Trying again' : 'Try again'}</button>
      {at ? <p className="rvw-state__fine">Tried at {clockTime(at)}.</p> : null}
      <Link className="rvw-textkey" href="/dashboard">Practise anyway</Link>
    </section>
  );
}

function Empty({ wallet }) {
  const { user } = useAuth();
  const first = SUBJECTS.find((s) => s.id === (user?.subjects || [])[0]) || SUBJECTS.find((s) => s.id === 'accountancy');
  const href = `/dashboard?${new URLSearchParams({ subject: first?.id || '', mode: 'quick', count: '10' })}`;
  return (
    <section className="rvw-state" aria-labelledby="rvw-empty-h">
      <SceneVignette scene="nothingYet" interactive />
      <h2 id="rvw-empty-h">Your mistakes gather here</h2>
      <p>Every wrong answer lands here with its paper and time, priced in marks.</p>
      <div className="rvw-sample" aria-label="An example of a row">
        <span className="rvw-badge" data-k="open">4</span>
        <b>Admission of a partner</b>
        <em>Example</em>
        <span>Mock 1, 12 Oct, 8:40 PM. Cost you 6 marks</span>
      </div>
      <Link className="btn-volt rvw-state__key mk-press" data-page-primary="" href={href}>Start 10 questions</Link>
      <p className="rvw-state__fine">About 10 minutes, {first?.name || 'your subject'}. {practiceCostLine({ isPremium: Boolean(wallet?.isPremium), practiceCredits: wallet?.practiceCredits ?? null })}</p>
    </section>
  );
}

/** The daily keep row under the receipt: quiet, the whole row is the link. Never the volt (5.3). */
function ReviseRow({ due, answeredToday }) {
  if (!due) return null;
  const done = !due.total && answeredToday > 0;
  const head = done ? 'Done for today' : due.head;
  const line = done ? 'Nothing else is due today. The next ones come back tomorrow.' : due.total ? due.row : 'Nothing is due today. Questions you get wrong come back after 1, 3, 7 and 21 days.';
  return (
    <Link className="rvw-row rvw-revise mk-press" href="/review/revise">
      <b>Revise <small>{head}</small></b>
      <span>{line}</span>
      <i className="rvw-chev" aria-hidden="true" />
    </Link>
  );
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

function AlsoInReview({ body, items, wallet, openUid, setOpenUid, onChanged }) {
  const rules = useRuleBook();
  const saved = useSavedCount();
  const [fold, setFold] = useState(null);
  const book = rules.state === 'ready' ? rules.data?.book : null;
  const ruleCount = book ? bookRules(book).length : null;
  const wrong = items.filter((i) => i.state !== 'blank');
  const repaired = wrong.filter((i) => ['repaired', 'held', 'slipped'].includes(i.state));
  const held = repaired.filter((i) => i.state === 'held').length;
  const slipped = repaired.filter((i) => i.state === 'slipped').length;
  const pending = repaired.filter((i) => i.state === 'repaired').length;
  const blanks = items.filter((i) => i.state === 'blank' && !i.keyState);
  const blankPapers = [...new Set(blanks.map((i) => i.paperName))];
  const rotation = body.revise?.rotation;
  const toggle = (name) => setFold((f) => (f === name ? null : name));
  return (
    <section className="rvw-also" aria-labelledby="rvw-also-h">
      <h2 id="rvw-also-h" className="rvw-h2">Also in Review</h2>
      {repaired.length ? (
        <>
          <button type="button" className="rvw-row mk-press" aria-expanded={fold === 'repaired'} onClick={() => toggle('repaired')}>
            <b>{repaired.length} repaired</b>
            <span>Each opens its saved repair, free. {[held ? `${held} held` : null, slipped ? `${slipped} slipped` : null, pending ? `${pending} waiting for Check it held` : null].filter(Boolean).join(', ')}.</span>
            <i className="rvw-chev" data-dir="down" aria-hidden="true" />
          </button>
          {fold === 'repaired' ? <ItemList items={repaired} wallet={wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} label="Your repaired mistakes" /> : null}
        </>
      ) : null}
      <Link className="rvw-row mk-press" href="/review/revise">
        <b>Revise schedule</b>
        <span>{Number.isFinite(rotation) ? `${plural(rotation, 'question')} in rotation. ` : ''}They come back after 1, 3, 7 and 21 days.</span>
        <i className="rvw-chev" aria-hidden="true" />
      </Link>
      <Link className="rvw-row mk-press" href="/review/rules">
        <b>Your rules</b>
        <span>{ruleCount ? `${plural(ruleCount, 'rule')} from your repairs.` : 'Rules from your repairs and from how you take papers.'}{book?.active?.text ? ` For your next mock: ${book.active.text}` : ' Choose one for your next mock.'}</span>
        <i className="rvw-chev" aria-hidden="true" />
      </Link>
      <Link className="rvw-row mk-press" href="/saved">
        <b>Saved questions</b>
        <span>{Number.isFinite(saved) ? `${saved} saved` : 'Questions you saved while practising'}</span>
        <i className="rvw-chev" aria-hidden="true" />
      </Link>
      {blanks.length ? (
        <>
          <button type="button" className="rvw-row mk-press" aria-expanded={fold === 'blank'} onClick={() => toggle('blank')}>
            <b>Not attempted</b>
            <span>{blanks.length} left blank in {joinNames(blankPapers)}, {blanks.length * 5} marks not earned. Try any of them again, free.</span>
            <i className="rvw-chev" data-dir="down" aria-hidden="true" />
          </button>
          {fold === 'blank' ? <ItemList items={blanks} wallet={wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} label="Questions left blank" /> : null}
        </>
      ) : null}
    </section>
  );
}

function Segments({ tab, onTab, open, papers }) {
  return (
    <div className="rvw-seg" role="tablist" aria-label="Review" data-tab={tab}>
      <i className="rvw-seg__lens" aria-hidden="true" />
      <button type="button" role="tab" id="rvw-tab-mistakes" aria-controls="rvw-panel" aria-selected={tab === 'mistakes'} onClick={() => onTab('mistakes')}>Mistakes <small>{open} open</small></button>
      <button type="button" role="tab" id="rvw-tab-papers" aria-controls="rvw-panel" aria-selected={tab === 'papers'} onClick={() => onTab('papers')}>Papers <small>{papers}</small></button>
    </div>
  );
}

function ReviewInner({ tabParam }) {
  const params = useSearchParams();
  const tab = params.get(tabParam) === 'papers' ? 'papers' : 'mistakes';
  const [read, setRead] = useState({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [openUid, setOpenUid] = useState(null);
  // A move the student asked for: open its chapter at its question (and start the repair when it is the panel's key).
  const [focus, setFocus] = useState(() => {
    const q = params.get('q');
    const open = params.get('open');
    return open ? { chapter: open, uid: q || null, repair: false, n: 0 } : null;
  });
  const seq = useRef(0);

  const load = useCallback(({ quiet = false } = {}) => {
    const mine = ++seq.current;
    return apiGet('/api/me/review')
      .then((body) => {
        if (mine !== seq.current) return;
        setRead(body?.state === 'unavailable' ? { status: 'down', cause: causeOf({ status: 503 }), at: Date.now() } : { status: 'ready', body });
      })
      .catch((error) => {
        if (mine !== seq.current) return;
        // A quiet refresh after a repair keeps the page it has; only a first read shows the failure state.
        setRead((r) => (quiet && r.status === 'ready' ? r : { status: 'down', cause: causeOf(error), at: Date.now() }));
      })
      .finally(() => { if (mine === seq.current) setRetrying(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const body = read.status === 'ready' ? read.body : null;
  const record = useMemo(() => (body ? recordFromBody(body) : null), [body]);
  const move = useMemo(() => (record && body.state === 'ready' ? reviewMove(record) : null), [record, body]);
  const items = useMemo(() => body?.items || [], [body]);
  const byUid = useMemo(() => new Map(items.map((i) => [i.uid, i])), [items]);
  const chapterOf = useCallback((uid) => byUid.get(uid)?.chapterId || null, [byUid]);

  const onTab = (next) => {
    const p = new URLSearchParams(window.location.search);
    if (next === 'papers') p.set(tabParam, 'papers'); else if (tabParam === 'view') p.delete('view'); else p.delete(tabParam);
    p.delete('open'); p.delete('q');
    window.history.replaceState(null, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
  };

  const openTarget = useCallback((target, { repair = false } = {}) => {
    const uid = target?.uid || target?.qid;
    const chapter = chapterOf(uid);
    if (!chapter) return;
    setOpenUid(uid);
    setFocus((f) => ({ chapter, uid, repair, n: (f?.n || 0) + 1 }));
  }, [chapterOf]);

  const onChanged = useCallback(() => { load({ quiet: true }); }, [load]);

  if (read.status === 'loading') return <><h1 className="display-md rvw-title">Review</h1><Loading /></>;
  if (read.status === 'down') return <><h1 className="display-md rvw-title">Review</h1><Failed cause={read.cause} at={read.at} onRetry={() => { setRetrying(true); load(); }} retrying={retrying} /></>;
  if (body.state === 'empty') return <><h1 className="display-md rvw-title">Review</h1><Empty wallet={body.wallet} /></>;

  const counts = body.counts || {};
  return (
    <>
      <h1 className="display-md rvw-title">Review</h1>
      <Segments tab={tab} onTab={onTab} open={counts.open ?? 0} papers={counts.papers ?? body.papers.length} />
      <div id="rvw-panel" role="tabpanel" aria-labelledby={tab === 'papers' ? 'rvw-tab-papers' : 'rvw-tab-mistakes'} className="rvw-view" key={tab}>
        {tab === 'papers' ? <PapersView body={body} /> : (
          <div className="rvw-board">
            {move ? <ReviewNextMove move={move} onOpen={openTarget} /> : null}
            <div className="rvw-side">
              <ReceiptStrip receipt={body.receipt} />
              <ReviseRow due={body.reviseDue} answeredToday={body.revise?.answeredToday || 0} />
              <AlsoInReview body={body} items={items} wallet={body.wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
            </div>
            <ChapterRows body={body} wallet={body.wallet} focus={focus} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} />
          </div>
        )}
      </div>
    </>
  );
}

export default function ReviewPage({ tabParam = 'view' }) {
  return (
    <section className="rvw" aria-label="Review">
      <Suspense fallback={<><h1 className="display-md rvw-title">Review</h1><Loading /></>}>
        <ReviewInner tabParam={tabParam} />
      </Suspense>
    </section>
  );
}
