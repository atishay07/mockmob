"use client";

// Practice: set up a session and see what it takes before anything starts (web IA plan 2.2 Practice, IA5).
//   Tonight's move   the same move as Today and the Start sheet, set up in place with one tap
//   Your subjects    tiles, with live question counts where the bank reports them
//   Session          Quick practice, Full mock, NTA mode, Smart practice; the cost is on every row
//   Fine-tune        difficulty and chapters, both optional
//   Your session     the confirm line ("10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your
//                    40 practice credits.") and Start. Nothing is spent on a tap anywhere before Start.
//   More ways        Question stream, and Concepts while the study flags are on
//
// The prefill contract is unchanged: /dashboard?subject=&mode=&count=&chapter= (plus interface=nta,
// tonightKey and tonightMinutes) sets the page up exactly as it always has (practiceModel.mjs
// parsePrefill), and Start opens the same /test link with the server quote's idempotency token. The
// server quote stays the authority on whether a session can start; this page only words it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { CreditsRemainingModal } from '@/components/CreditsRemainingModal';
import { ErrorState } from '@/components/ui/Skeleton';
import { TEST_MODES } from '@/../data/test_modes';
import { MODE_CAPABILITIES } from '@/../data/capabilities';
import { PracticeMobi, PracticeSkeleton, usePracticeBrand, useRecommendedMove } from './PracticeParts';
import { FineTune, MorePractice, NoSubjects, Notes, Recommended, SUBJECTS_EDIT_HREF, SessionGroup, SessionPanel, SubjectGroup } from './PracticeSections';
import {
  EMPTY_PICKS, SESSION_LABEL, asideTitle, confirmText, includedToday, lengthNote, lockLine, lockedAlternative,
  parsePrefill, quoteExpired, quoteFor, quoteNote, resolveSession, scopeLine, sessionRows, startHref, startKeyLabel, tonightParams,
} from './practiceModel.mjs';
import './practice.css';

const EMPTY_CHOICE = Object.freeze({ forKey: null, ...EMPTY_PICKS });

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

/** The server's launch quote for one session. Throws when the answer is not a quote. */
async function fetchQuote(subject, mode, count) {
  const params = new URLSearchParams({ subject, mode, count: String(count) });
  const response = await fetch(`/api/practice/quote?${params}`, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!body || typeof body.state !== 'string') throw new Error('bad_quote');
  return body;
}

export default function DashboardPageClient({ studyEnabled = false }) {
  const { user, status: authStatus } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const brand = usePracticeBrand();

  const prefillKey = searchParams.toString();
  const prefill = useMemo(() => parsePrefill(searchParams), [searchParams]);

  const [subjects, setSubjects] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadNonce, setLoadNonce] = useState(0);
  const [stats, setStats] = useState({ state: 'loading' });
  const [chaptersFor, setChaptersFor] = useState({ subject: null, list: [], failed: false });
  // What the student chose on this page. It belongs to the link that opened it: a new link starts clean.
  const [choice, setChoice] = useState(EMPTY_CHOICE);
  const [fineUser, setFineUser] = useState(null);
  const [chapterSearch, setChapterSearch] = useState('');
  const [launching, setLaunching] = useState(false);
  const launchingRef = useRef(false);
  const [quote, setQuote] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState('idle');
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [flash, setFlash] = useState(false);
  const panelRef = useRef(null);
  const panelTitleRef = useRef(null);

  // After a mock attempt the test page sets `mm:postTest=1` in sessionStorage before redirecting. When
  // the student lands back here, show the credits sheet once and clear the flag so a refresh does not repeat it.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (authStatus !== 'authenticated' || !user) return undefined;
    try {
      if (window.sessionStorage.getItem('mm:postTest') === '1') {
        window.sessionStorage.removeItem('mm:postTest');
        if (!user?.isPremium) {
          const id = window.setTimeout(() => setShowCreditsModal(true), 0);
          return () => window.clearTimeout(id);
        }
      }
    } catch { /* private mode: non-fatal */ }
    return undefined;
  }, [authStatus, user]);

  // The session panel shows briefly where a set-up landed (a border, not a glow), then settles.
  useEffect(() => {
    if (!flash) return undefined;
    const id = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(id);
  }, [flash]);

  // The subjects the bank supports, and the question counts. The counts are optional: a failed read leaves them out.
  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return undefined;
    let alive = true;
    apiGet('/api/stats')
      .then((value) => { if (alive) setStats(value ?? { state: 'unavailable' }); })
      .catch(() => { if (alive) setStats({ state: 'unavailable' }); });
    apiGet('/api/subjects')
      .then((list) => {
        if (!alive) return;
        if (!Array.isArray(list)) throw new Error('subjects_unavailable');
        setSubjects(list);
        setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [user?.id, authStatus, loadNonce]);

  const mySubs = useMemo(
    () => subjects.filter((subject) => user?.subjects?.includes(subject.id) && subject.practice === 'supported'),
    [subjects, user],
  );
  const supported = useMemo(() => new Set(subjects.filter((subject) => subject.practice === 'supported').map((subject) => subject.id)), [subjects]);
  // Saved choices that cannot start (not offered, merged or retired) are shown, never started.
  const staleSubs = useMemo(
    () => (user?.subjects || [])
      .map((id) => subjects.find((subject) => subject.id === id) || { id, name: id, practice: 'unknown', practiceReason: 'This saved subject is no longer recognised. Edit your subjects to choose a current CUET subject.' })
      .filter((subject) => subject.practice !== 'supported'),
    [subjects, user],
  );

  // ---- The session on screen, from the link and then the student's own choices ----
  const picks = choice.forKey === prefillKey ? choice : EMPTY_PICKS;
  const { subjectId, modeId, count, difficulty, ntaScreen, chapterNames, chapterMissing, chaptersRead, chapterList } = resolveSession({
    prefill, picks, mySubjectIds: mySubs.map((subject) => subject.id), chapters: chaptersFor,
  });
  const selectedSubject = mySubs.find((subject) => subject.id === subjectId) || null;
  const mode = TEST_MODES[modeId];
  const fineOpen = fineUser ?? (chapterNames.length > 0 || difficulty !== 'auto');

  // The chapters of the chosen subject.
  useEffect(() => {
    if (!subjectId) return undefined;
    let alive = true;
    apiGet(`/api/chapters?subject=${encodeURIComponent(subjectId)}`)
      .then((data) => {
        if (!alive) return;
        const list = data?.grouped
          ? (data.units || []).flatMap((unit) => (unit.chapters || []).map((chapter) => ({ ...chapter, unitName: unit.name })))
          : (data?.chapters || []);
        setChaptersFor({ subject: subjectId, list, failed: false });
      })
      .catch(() => { if (alive) setChaptersFor({ subject: subjectId, list: [], failed: true }); });
    return () => { alive = false; };
  }, [subjectId]);

  // The server's quote for this session. It reads access, credits and the question bank; the page never
  // guesses from its own arithmetic.
  useEffect(() => {
    if (status !== 'ready' || !subjectId) return undefined;
    let alive = true;
    const id = window.setTimeout(() => {
      setQuoteStatus('loading');
      fetchQuote(subjectId, modeId, count)
        .then((body) => { if (!alive) return; setQuote(body); setQuoteStatus('ready'); })
        .catch(() => { if (!alive) return; setQuote(null); setQuoteStatus('error'); });
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [status, subjectId, modeId, count, quoteNonce, user?.id]);

  const matched = quoteFor(quote, { subject: subjectId, mode: modeId, count });
  const pro = Boolean(user?.isPremium) || quote?.entitlement?.kind === 'access';
  const balance = matched?.creditBalance ?? (Number.isFinite(user?.creditBalance) ? user.creditBalance : null);
  const launchable = quoteStatus === 'ready' && Boolean(matched) && matched.launchable === true;
  const checking = quoteStatus === 'loading' || (quoteStatus !== 'error' && !matched);
  const locked = !pro && MODE_CAPABILITIES[modeId]?.entitlement === 'access';
  const minutes = matched?.durationSec ? Math.round(matched.durationSec / 60) : mode.fixedDurationSec ? Math.round(mode.fixedDurationSec / 60) : count * Math.round((mode.durationPerQuestionSec || 60) / 60);

  const move = useRecommendedMove({ user, supported, enabled: status === 'ready' && mySubs.length > 0 });

  const rows = useMemo(
    () => sessionRows({ pro, isLocked: (id) => MODE_CAPABILITIES[id]?.entitlement === 'access' }),
    [pro],
  );

  // ---- Actions ----
  function choose(patch) {
    setChoice({ ...(choice.forKey === prefillKey ? choice : EMPTY_CHOICE), forKey: prefillKey, ...patch });
  }
  function pickSubject(id) {
    setChapterSearch('');
    choose({ subject: id, chapters: [], difficulty: 'auto' });
  }
  function pickMode(id) {
    choose({ mode: id, ...(TEST_MODES[id].allowDifficultyOverride ? {} : { difficulty: 'auto' }) });
  }
  function toggleChapter(name) {
    choose({ chapters: chapterNames.includes(name) ? chapterNames.filter((entry) => entry !== name) : [...chapterNames, name] });
  }
  // A recommended move that is a practice link: set the page up in place, then bring the session panel into view.
  function setUp(want) {
    setChapterSearch('');
    setFineUser(null);
    setChoice({
      forKey: prefillKey,
      subject: want.subject && mySubs.some((subject) => subject.id === want.subject) ? want.subject : subjectId,
      mode: want.mode || 'quick',
      count: want.askedCount ? want.count : null,
      chapters: want.chapter ? [want.chapter] : [],
      difficulty: 'auto',
      ntaScreen: want.ntaScreen,
    });
    setFlash(true);
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      panelTitleRef.current?.focus({ preventScroll: true });
    });
  }

  async function start() {
    if (launchingRef.current || !subjectId) return;
    launchingRef.current = true;
    setLaunching(true);
    try {
      let current = matched;
      // A quote is good for a minute. Past that, ask again and carry on with the fresh one.
      if (quoteExpired(current)) {
        current = await fetchQuote(subjectId, modeId, count);
        setQuote(current);
        setQuoteStatus('ready');
      }
      const same = current.subject?.storedId === subjectId && current.mode?.id === modeId && current.count === count;
      if (!same || !current.launchable || !current.idempotencyToken) {
        launchingRef.current = false;
        setLaunching(false);
        return;
      }
      router.push(startHref(
        { subject: subjectId, count, mode: modeId, chapters: chapterNames, difficulty, pro, ntaScreen },
        { generationKey: current.idempotencyToken, tonight: tonightParams(searchParams) },
      ));
    } catch {
      launchingRef.current = false;
      setLaunching(false);
      setQuoteStatus('error');
    }
  }

  // ---- What the page says ----
  const head = (
    <header className="prc-head">
      <div>
        <h1 className="prc-title">What are you practising?</h1>
        <p className="prc-lede">Pick a subject and a session. You see what it takes before anything starts, and nothing is used until you press Start.</p>
      </div>
      <div className="prc-head__mobi"><PracticeMobi failed={status === 'error'} /></div>
    </header>
  );

  if (authStatus === 'loading' || !user || status === 'loading') return <PracticeSkeleton />;

  if (status === 'error') {
    return (
      <div className="student-page student-page--practice prc">
        {head}
        <ErrorState
          title="Practice did not load"
          message="Check your connection and try again. Nothing was charged."
          onRetry={() => { setStatus('loading'); setLoadNonce((n) => n + 1); }}
        />
      </div>
    );
  }

  const notes = [];
  if (status === 'ready' && prefill.subject && !mySubs.some((subject) => subject.id === prefill.subject)) {
    notes.push({ id: 'linked', tone: 'warning', title: 'That subject is not in your practice subjects', body: 'Choose one of yours below, or add it to your sheet.', action: { href: SUBJECTS_EDIT_HREF, label: 'Edit subjects' } });
  }
  if (staleSubs.length > 0) {
    notes.push({
      id: 'stale', tone: 'warning', title: 'Some saved subjects cannot start practice', action: { href: SUBJECTS_EDIT_HREF, label: 'Edit subjects' },
      list: staleSubs.map((subject) => ({ id: subject.id, name: subject.name, reason: subject.practiceReason || 'Practice is not available for this subject yet.' })),
    });
  }
  const adjusted = picks.count === null ? lengthNote(modeId, prefill.askedCount) : null;
  if (adjusted) notes.push({ id: 'length', tone: 'info', body: adjusted });
  if (chapterMissing) notes.push({ id: 'chapter', tone: 'info', body: `The chapter ${prefill.chapter} was not found in ${selectedSubject?.name || 'this subject'}, so this set covers all chapters.` });

  if (mySubs.length === 0) {
    return (
      <div className="student-page student-page--practice prc">
        {head}
        <Notes notes={notes} />
        <NoSubjects staleOnly={staleSubs.length > 0} />
        <MorePractice studyEnabled={studyEnabled} />
      </div>
    );
  }

  const noteForQuote = checking || quoteStatus === 'error' || launching || !matched ? null : quoteNote(matched, { mode: modeId, pro });
  const modeName = SESSION_LABEL[modeId].toLowerCase();
  const statusText = launching ? `Starting ${modeName}.`
    : quoteStatus === 'error' ? 'Could not check this session. Nothing was charged.'
      : checking ? 'Checking access, credits and questions.' : '';
  const view = {
    key: `${modeId}-${subjectId}-${count}-${locked}`,
    title: asideTitle({ mode: modeId, subjectName: selectedSubject?.name }),
    line: locked ? lockLine(modeId) : confirmText({ mode: modeId, count, pro, balance, freeToday: includedToday(matched), minutes: matched?.durationSec ? minutes : null }),
    scope: locked ? '' : scopeLine({ chapters: chapterNames, difficulty }),
    locked,
    upgradeHref: matched?.upgradeHref || '/pricing?reason=premium_mode',
    alternative: lockedAlternative(modeId),
    statusText: locked ? '' : statusText,
    note: locked ? null : noteForQuote,
    canRetry: !locked && quoteStatus === 'error',
  };

  return (
    <div className="student-page student-page--practice prc">
      {!pro && (
        <CreditsRemainingModal open={showCreditsModal} credits={user?.creditBalance ?? 0} offer={quote?.offer} onClose={() => setShowCreditsModal(false)} />
      )}
      {head}
      <Notes notes={notes} />

      <div className="prc-layout">
        <div className="prc-main">
          <Recommended
            status={move.status}
            move={move.move}
            current={{ subject: subjectId, mode: modeId, count, chapters: chapterNames }}
            onSetup={setUp}
          />
          <SubjectGroup
            subjects={mySubs}
            value={subjectId}
            onChange={pickSubject}
            counts={stats.subjectCounts}
            statsState={stats?.state !== 'unavailable' && stats?.bankSize != null ? 'ready' : stats?.state === 'loading' ? 'loading' : 'unavailable'}
            showArt={brand.subjectArt}
          />
          <SessionGroup
            rows={rows}
            value={modeId}
            onChange={pickMode}
            mode={mode}
            count={count}
            onCount={(next) => choose({ count: next })}
            minutes={minutes}
            pro={pro}
            ntaScreen={ntaScreen}
            onNtaScreen={(next) => choose({ ntaScreen: next })}
          />
          <FineTune
            open={fineOpen}
            onToggle={setFineUser}
            mode={mode}
            pro={pro}
            difficulty={difficulty}
            onDifficulty={(next) => choose({ difficulty: next })}
            chapters={chapterList}
            chaptersFailed={chaptersRead && chaptersFor.failed}
            chapterSearch={chapterSearch}
            onChapterSearch={setChapterSearch}
            selected={chapterNames}
            onToggleChapter={toggleChapter}
            onAllChapters={() => choose({ chapters: [] })}
          />
        </div>
        <SessionPanel
          panelRef={panelRef}
          titleRef={panelTitleRef}
          view={view}
          flash={flash}
          launching={launching}
          checking={checking}
          available={launchable}
          startLabel={startKeyLabel({ mode: modeId, launching, checking, available: launchable })}
          onStart={start}
          onSwitch={pickMode}
          onRecheck={() => setQuoteNonce((n) => n + 1)}
        />
      </div>
      <MorePractice studyEnabled={studyEnabled} />
    </div>
  );
}
