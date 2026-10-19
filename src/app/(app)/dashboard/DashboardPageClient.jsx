"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Play, SlidersHorizontal, Target } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppIcon, CreditAmount, StatusIcon } from '@/components/ui/Glyph';
import { useContributeEnabled } from '@/components/contribute/ContributeFlag';
import { Button } from '@/components/ui/Button';
import { ErrorState, EmptyState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { CreditsRemainingModal } from '@/components/CreditsRemainingModal';
import NtaConsolePreview from '@/components/arena/NtaConsolePreview';
import { PipActor } from '@/components/brand/PipActor';
import { SegmentedControl as Segmented } from '@/components/ui/controls/SegmentedControl';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { ExamPanel, Stopwatch, WeightsGlyph } from '@/components/start/StartArt';
import { LIFE, tapKeyframes } from '@/components/brand/ObjectLifeModel.mjs';
import { TEST_MODES, fineTuneScope, resolveCount } from '@/../data/test_modes';
import { countHint, dailySetFromQuote, isDailySet } from '@/lib/dailySet.mjs';
import { forgetDailySet } from '@/lib/useDailySet';
import { forgetFirstFullMock } from '@/lib/useFirstFullMock';
import { useMyDailySet } from '@/components/useMyDailySet';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_REASON, FIRST_FULL_MOCK_STATE } from '@/../data/first_full_mock';
import { MODE_CAPABILITIES } from '@/../data/capabilities';
import { retiredSubjectEntry } from '@/../data/subject_claim';
import StartRule, { useStartRule } from './StartRule';
import ChapterPicker from './ChapterPicker';
import ConceptsPanel from '@/components/study/ConceptsPanel';
import { chapterUnits, chaptersForMode } from './chapterGroups.mjs';
import { MODE_SPECS, MODE_TILE_SPECS, bankCount, freshPaperLine } from '@/lib/paperCopy.mjs';
import PracticeMobChip from '@/components/mob/PracticeMobChip';
import PracticeRepairs from './PracticeRepairs';
import { useRailCue, reducedMotion as railReduced } from '@/components/start/railCue';
import { InlineNudge, ProFacts, openUpgrade } from '@/components/pro';
import { fullMocksIn } from '@/lib/proNudge.mjs';
import './practice.css';
import './chapter-picker.css';

// The four modes, as a 2 x 2 grid of pressable tiles (START-1017 D4, owner F5).
const MODE_LIST = ['quick', 'full', 'smart', 'nta'];

// Short facts are joined by a comma, never a dot.
const Sep = () => <>, </>;
// A pick is a choice, so the object answers it a little more than a passing tap (the app's 0.4).
const PICK_AMPLITUDE = 0.7;

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// The chosen tile's object gives and settles on the app's tap spring, wherever on the tile the press
// landed. A press on the object itself is already answered by its own life (with the sparkle).
function answerPick(event) {
  const tile = event.currentTarget;
  if (event.target instanceof Element && event.target.closest('.subj-obj')) return;
  if (reducedMotion()) return;
  const layer = tile.querySelector('.subj-obj__react');
  if (!layer || typeof layer.animate !== 'function') return;
  layer.animate(tapKeyframes(PICK_AMPLITUDE), { duration: LIFE.reactMs, easing: 'linear' });
}

// "40% easy, 40% medium, 20% hard" from the mode's own mix (data/test_modes.js), never typed twice.
const mixLine = (mode) => {
  const d = mode?.difficulty || {};
  return `Balanced is ${Math.round((d.easy || 0) * 100)}% easy, ${Math.round((d.medium || 0) * 100)}% medium, ${Math.round((d.hard || 0) * 100)}% hard`;
};

// The fine-tune scope sentence at the top of the block (START-1017 4.3). Smart and NTA say we choose, with Mobi.
const SCOPE_LINE = {
  quick: 'For Quick practice you can pick the chapters and the difficulty.',
  full: 'For a Full mock you can set the difficulty. It covers every chapter, like the exam.',
  // Owner N3: confident and plain, "we build it exactly the NTA way; you don't need to choose anything".
  smart: 'We build it from your own answers, around the topics where you get under 60% right. You don’t need to choose anything.',
  nta: 'We build it exactly the NTA way: 50 questions across the whole syllabus, in the exam’s own mix. You don’t need to choose anything.',
};

// Why a link's chapter was set aside, by mode.
const LINK_DROP = {
  full: 'A Full mock covers every chapter, like the exam',
  smart: 'Smart practice chooses its own topics',
  nta: 'NTA mode covers the whole syllabus, like the exam',
};

// The mode tile's picture: the subject itself for Quick practice, the app's stopwatch for a Full mock, topic weights for
// Smart practice, the exam screen for NTA mode.
function ModeArt({ id, subjectId, on }) {
  if (id === 'quick') return <SubjectObject id={subjectId} size={64} lit={on} />;
  if (id === 'full') return <Stopwatch width={52} />;
  if (id === 'smart') return <WeightsGlyph width={60} height={56} />;
  return <ExamPanel width={66} height={56} />;
}

// The exam pair's start moment (owner, 15 Oct: "the clock doing a 360"). Pressing Start on a Full mock or NTA mode turns
// the stopwatch's hand once round, in the mode's tile and on the Start key, before the paper opens. 640 ms; with reduced
// motion the key only dims for 160 ms.
const START_TURN_MS = 640;
const START_FADE_MS = 160;

/** A small drawn stopwatch for the exam pair's Start key; its hand turns once on the start moment (practice.css). */
function ClockGlyph({ size = 18 }) {
  return (
    <svg className="pr-clock" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="9.5" y="1.6" width="5" height="2.6" rx="1.1" className="pr-clock__crown" />
      <circle cx="12" cy="13.6" r="8.2" className="pr-clock__face" />
      <g className="pr-clock__hand"><line x1="12" y1="13.6" x2="12" y2="8" /></g>
      <circle cx="12" cy="13.6" r="1.4" className="pr-clock__pin" />
    </svg>
  );
}

function PracticeSkeleton() {
  // Shapes that hold the setup's places (subjects, four tiles, the length, fine-tune, the session), so nothing jumps.
  return (
    // data-owns-start from the first frame, so the sidebar's Start key keeps one look for the whole visit (it used to show
    // volt while this skeleton was up and turn quiet once the page landed).
    <div className="pr view pr-skeleton" aria-busy="true" aria-label="Loading practice" data-owns-start="">
      <div className="pr-skel pr-skel--h1 skeleton" />
      <div className="pr-skel pr-skel--line skeleton" />
      <div className="pr-layout">
        <div className="pr-steps">
          <div className="pr-skel-row">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="pr-skel pr-skel--disc skeleton" />)}</div>
          <div className="pr-skel-grid">{[0, 1, 2, 3].map((i) => <span key={i} className="pr-skel pr-skel--tile skeleton" />)}</div>
          <div className="pr-skel pr-skel--seg skeleton" />
          <div className="pr-skel pr-skel--fine skeleton" />
        </div>
        <div className="pr-skel pr-skel--card skeleton" />
      </div>
    </div>
  );
}

// studyEnabled: the Concepts lessons are on (STUDY_CONTENT_ENABLED, read by page.js). Concepts left the phone dock for the More
// sheet and this page (NAV-1017 8.2), so its panel is drawn here only while Concepts exists. The panel is personalised (ConceptsPanel).
export default function DashboardPageClient({ studyEnabled = false } = {}) {
  const { user, status: authStatus } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // CONTRIBUTE_ENABLED: the Add a question panel and the submissions read are part of the paused contribution side.
  const contributeOn = useContributeEnabled();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [standing, setStanding] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [stats, setStats] = useState({ state: 'loading' });
  const [learningSummary, setLearningSummary] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subRefreshing, setSubRefreshing] = useState(false);

  const [selSubj, setSelSubj] = useState(null);
  // The chosen subject's chapters, grouped by unit for the picker: { state, units, count, flat } (chapterGroups.mjs).
  const [chapterData, setChapterData] = useState({ state: 'loading', units: [], count: 0, flat: true });
  const [chapterNonce, setChapterNonce] = useState(0);
  // The chapters the student picked. Kept while another mode is chosen (folded away, not deleted) and used only for
  // Quick practice (START-1017 4.3); coming back to Quick practice brings them back.
  const [selectedChapters, setSelectedChapters] = useState([]);
  // One quiet line under Chapters when the choice changed by itself (a new subject, a return, a link it could not use).
  const [chapterNote, setChapterNote] = useState(null);
  const [difficultyMode, setDifficultyMode] = useState('auto');
  // null until the user picks one — defaults are derived from plan during render.
  const [selMode, setSelMode] = useState(null);
  // Today/PrepOS hand over the size of the session they planned (?count=), so the time the
  // student chose is the session they get.
  const [count, setCount] = useState(() => {
    const requested = Number(searchParams.get('count'));
    return TEST_MODES.quick.countOptions.includes(requested) ? requested : 10;
  });
  // Which console NTA mode opens in: MockMob's own layout, or the conventional exam-style screen.
  const [ntaScreen, setNtaScreen] = useState(() => (searchParams.get('interface') === 'nta' ? 'nta' : 'mockmob'));
  const [isLaunching, setIsLaunching] = useState(false);
  // 'turn' while the exam pair's start moment plays (the stopwatch hand goes once round), then the paper opens.
  const [launchMoment, setLaunchMoment] = useState(null);
  // Counts mode changes, so the Start key answers a tile press with a small settle (the press visibly sets the session up).
  const [modeNudge, setModeNudge] = useState(0);
  // ?pick=chapters (the Start sheet's By chapter row): the chapter list opens as the page lands.
  const pickChapters = searchParams.get('pick') === 'chapters';
  // A start that takes longer than 600 ms gets Mobi thinking in the card (D9); a quick one never shows him.
  const [slowLaunch, setSlowLaunch] = useState(false);
  const launchingKeyRef = useRef(null);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  // Server launch quote. The launch button renders this; it never guesses from credits.
  const [quote, setQuote] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState('idle');
  const [quoteNonce, setQuoteNonce] = useState(0);
  // The first full mock in each subject is free (data/first_full_mock.js). Every Free quote says so for its subject, whichever mode
  // it prices, and what it said is kept per subject, so the Full mock tile keeps its price while another mode's quote loads.
  const [firstFullBySubject, setFirstFullBySubject] = useState({});
  const fineRef = useRef(null);
  const chapterButtonRef = useRef(null);
  const shelfRef = useRef(null);

  // After a mock attempt the test page sets `mm:postTest=1` in sessionStorage
  // before redirecting. When the user lands back here (Arena), pop the modal
  // once and clear the flag so it doesn't re-trigger on a refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authStatus !== 'authenticated' || !user) return;
    try {
      if (window.sessionStorage.getItem('mm:postTest') === '1') {
        window.sessionStorage.removeItem('mm:postTest');
        if (!user?.isPremium) {
          const id = window.setTimeout(() => setShowCreditsModal(true), 0);
          return () => window.clearTimeout(id);
        }
      }
    } catch { /* private mode — non-fatal */ }
  }, [authStatus, user]);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return;

    let alive = true;
    // Optional panels cannot hold the practice setup behind slow inventory or leaderboard reads.
    const optional = (path, apply, fallback) => apiGet(path)
      .then(value => { if (alive) apply(value ?? fallback); })
      .catch(() => { if (alive) apply(fallback); });
    optional('/api/leaderboard', value => setStanding(value?.you ?? null), null);
    optional('/api/stats', setStats, { state: 'unavailable' });
    if (contributeOn) optional('/api/questions/mine', value => setSubmissions(Array.isArray(value) ? value : []), []);
    optional('/api/learning/summary', setLearningSummary, null);
    async function load() {
      try {
        const [subs, atts] = await Promise.all([
          apiGet('/api/subjects'),
          apiGet(`/api/attempts?userId=${user.id}`),
        ]);
        if (!alive) return;
        setSubjects(subs);
        setAttempts(atts);
        const mySubs = subs.filter((subject) => user.subjects?.includes(subject.id) && subject.practice === 'supported');
        const linkedSubject=searchParams.get('subject');
        if (mySubs.length > 0) setSelSubj(current => mySubs.some(subject => subject.id === linkedSubject) ? linkedSubject : mySubs.some(subject => subject.id === current) ? current : mySubs[0].id);
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setError(e.message);
        setStatus('error');
      }
    }

    load();
    return () => { alive = false; };
  }, [user, authStatus, loadNonce, searchParams, contributeOn]);

  async function refreshSubmissions() {
    setSubRefreshing(true);
    try {
      const myQs = await apiGet('/api/questions/mine');
      setSubmissions(Array.isArray(myQs) ? myQs : []);
    } catch {
      // non-fatal
    } finally {
      setSubRefreshing(false);
    }
  }

  const requestedMode = searchParams.get('mode');
  const effectiveModeId = selMode && TEST_MODES[selMode] ? selMode : MODE_LIST.includes(requestedMode) ? requestedMode : 'quick';
  const mode = TEST_MODES[effectiveModeId];
  const scope = fineTuneScope(effectiveModeId);
  // Whether the session card's practice_cost line is on screen (the level line then stands its own ask down).
  const [costNudgeShown, setCostNudgeShown] = useState(false);

  useEffect(() => {
    if (!selSubj) return;
    let alive = true;
    const internal = subjects.find((entry) => entry.id === selSubj)?.internalId || selSubj;
    apiGet(`/api/chapters?subject=${selSubj}`)
      .then((data) => {
        if (!alive) return;
        const grouped = chapterUnits(data, internal);
        setChapterData({ state: 'ready', ...grouped });
        const known = grouped.units.flatMap((unit) => unit.chapters.map((chapter) => chapter.name));
        // A link's chapter (?chapter= or ?chapters=) is used only by a mode that takes chapters; otherwise it is set aside
        // and the Chapters row says so (START-1017 4.2, states).
        const linked = searchParams.get('subject') === selSubj
          ? [...(searchParams.get('chapters') || '').split(','), searchParams.get('chapter') || ''].map((name) => name.trim()).filter(Boolean)
          : [];
        const linkMode = MODE_LIST.includes(searchParams.get('mode')) ? searchParams.get('mode') : 'quick';
        const kept = chaptersForMode(fineTuneScope(linkMode).chapters, linked, known);
        setSelectedChapters(kept.chapters);
        setChapterNote(linked.length && !kept.chapters.length && !fineTuneScope(linkMode).chapters
          ? `${LINK_DROP[linkMode] || 'This mode covers every chapter'}, so the chapter from your link was not used.`
          : null);
      })
      .catch(() => { if (alive) setChapterData({ state: 'error', units: [], count: 0, flat: true }); });
    return () => { alive = false; };
  }, [selSubj, searchParams, subjects, chapterNonce]);

  // On a phone the shelf is one sideways row: the chosen subject is brought to the middle when it changes.
  useEffect(() => {
    const shelf = shelfRef.current;
    const on = shelf?.querySelector('[aria-pressed="true"]');
    if (!shelf || !on || shelf.scrollWidth <= shelf.clientWidth + 1) return;
    const left = on.offsetLeft - (shelf.clientWidth - on.offsetWidth) / 2;
    shelf.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [selSubj, status]);

  const mySubs = useMemo(
    () => subjects.filter((subject) => user?.subjects?.includes(subject.id) && subject.practice === 'supported'),
    [subjects, user],
  );
  // The shelf's sideways cue on a phone (owner G27, as on the Start sheet): the last subject in view is cut at about 60%,
  // the shelf nudges 24 px once on the first visit on a device, and a chevron shows while subjects wait past the edge.
  const shelfHint = useRef(null);
  const { edges: shelfEdges } = useRailCue(shelfRef, { active: status === 'ready' && mySubs.length > 1, items: '.pr-subject', min: 92, max: 132, endInset: 16, nudgeKey: 'mm:cue:practice-shelf:v1', nudgeDelay: 900, hintRef: shelfHint, count: mySubs.length });
  const linkedSubject=searchParams.get('subject');
  const linkedSubjectUnavailable=status==='ready' && linkedSubject && !mySubs.some(subject=>subject.id===linkedSubject);
  // Stored choices that cannot launch (not offered, merged or retired) are shown, never launched.
  const staleSubs = useMemo(
    () => [...(user?.subjects || []), ...(user?.retiredSubjects || [])]
      .map((id) => retiredSubjectEntry(id) || subjects.find((subject) => subject.id === id) || { id, name: id, practice: 'unknown', practiceReason: 'This saved subject is no longer recognised. Edit your subjects to choose a current CUET subject.' })
      .filter((subject) => subject.practice !== 'supported'),
    [subjects, user],
  );
  // Only the student's own standing comes from the server: { rank, of, tests, average } or null.
  const avg = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const rank = Number.isFinite(Number(standing?.rank)) ? Number(standing.rank) : null;
  const rankedOf = Number.isFinite(Number(standing?.of)) ? Number(standing.of) : 0;
  const isPremium = Boolean(user?.isPremium || learningSummary?.plan?.isPremium);
  // A student whose Pro ended is told so, with the date, instead of being shown Pro as if never held.
  const proEnded = !isPremium && Boolean(user?.premiumUntil);
  const balance = user?.creditBalance || 0;
  const quoteCount = mode.fixedCount || count;
  const quoteMatches = Boolean(quote && quote.subject?.storedId === selSubj && quote.mode?.id === mode.id && quote.count === quoteCount);
  // The Full mock's price on Free: 'Free' when this subject's first full mock is still free, nothing while that is unread (a number
  // there could be the very claim the quote contradicts), else the list price. The session card and the bar follow the quote itself.
  const quotedHere = quoteStatus === 'ready' && quote?.subject?.storedId === selSubj;
  const firstFullState = isPremium ? null : firstFullBySubject[selSubj] || (quoteStatus === 'error' || quotedHere ? FIRST_FULL_MOCK_STATE.unknown : null);
  const quoteFirstFree = quoteStatus === 'ready' && quoteMatches && quote.freeReason === FIRST_FULL_MOCK_REASON;
  // The rule the student chose for their next mock (the Rule book), on this card before the clock starts: Full and NTA only.
  const startSheet = useStartRule(status === 'ready' ? selSubj : null, effectiveModeId);
  const quoteLaunchable = quoteStatus === 'ready' && quoteMatches && quote.launchable === true;
  // The 10-question option's price follows the allowance, read the way the quote reads it: this screen's own Quick 10 quote while it is
  // the one on show, else the shared read (src/lib/dailySet.mjs). A free included set is never priced at 10 credits.
  const sharedDaily = useMyDailySet();
  const dailyNow = quoteStatus === 'ready' && quoteMatches && isDailySet(mode.id, quoteCount) ? dailySetFromQuote(quote) : sharedDaily;
  const countHintFor = (n) => { const hint = countHint(mode.id, n, { isPremium, dailySet: dailyNow }); return hint ? { hint } : {}; };

  useEffect(() => {
    if (status !== 'ready' || !selSubj) return;
    let alive = true;
    const params = new URLSearchParams({ subject: selSubj, mode: effectiveModeId, count: String(quoteCount) });
    const id = window.setTimeout(() => {
      setQuoteStatus('loading');
      fetch(`/api/practice/quote?${params}`, { cache: 'no-store' })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!alive) return;
          if (!body || typeof body.state !== 'string') throw new Error('bad_quote');
          setQuote(body);
          setQuoteStatus('ready');
          const quoted = body.subject?.storedId;
          if (quoted && typeof body.firstFullMock === 'string') setFirstFullBySubject((known) => (known[quoted] === body.firstFullMock ? known : { ...known, [quoted]: body.firstFullMock }));
        })
        .catch(() => {
          if (!alive) return;
          setQuote(null);
          setQuoteStatus('error');
        });
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [status, selSubj, effectiveModeId, quoteCount, quoteNonce, user?.id]);

  // Mobi thinks in the card only when a start takes longer than 600 ms.
  useEffect(() => {
    if (!isLaunching) return undefined;
    const id = window.setTimeout(() => setSlowLaunch(true), 600);
    return () => window.clearTimeout(id);
  }, [isLaunching]);

  // Changing the mode keeps the count in range and folds away what the new mode does not take (the chapters are kept in
  // memory and come back with Quick practice; a set level goes back to Balanced). Locked modes stay selectable so the
  // server quote can say what access they need.
  function chooseMode(id) {
    const next = TEST_MODES[id];
    if (!next) return;
    const before = fineTuneScope(effectiveModeId);
    const after = fineTuneScope(id);
    setSelMode(id);
    if (id !== effectiveModeId) setModeNudge((n) => n + 1);
    setCount((current) => resolveCount(next, current));
    if (!after.difficulty) setDifficultyMode('auto');
    if (!before.chapters && after.chapters && selectedChapters.length) {
      setChapterNote(`Your ${selectedChapters.length} ${selectedChapters.length === 1 ? 'chapter is' : 'chapters are'} back.`);
    } else if (id !== effectiveModeId) setChapterNote(null);
  }

  function chooseSubject(event, subject) {
    answerPick(event);
    if (subject.id === selSubj) return;
    const total = subject.chapters?.length || 0;
    setChapterNote(selectedChapters.length && total ? `Chapters reset to all ${total} for ${subject.name}.` : null);
    setSelSubj(subject.id);
    setSelectedChapters([]);
    setDifficultyMode('auto');
    setChapterData({ state: 'loading', units: [], count: 0, flat: true });
  }

  // Arrow keys move through the four mode tiles (a radio group with one tab stop, WAI-ARIA).
  function onModeKey(event) {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let at = MODE_LIST.indexOf(effectiveModeId);
    if (event.key === 'Home') at = 0;
    else if (event.key === 'End') at = MODE_LIST.length - 1;
    else if (moves[event.key]) at = (at + moves[event.key] + MODE_LIST.length) % MODE_LIST.length;
    else return;
    event.preventDefault();
    chooseMode(MODE_LIST[at]);
    event.currentTarget.querySelectorAll('[role="radio"]')[at]?.focus();
  }

  if (status === 'loading') return <PracticeSkeleton />;

  if (status === 'error') {
    return <ErrorState scene="unreachable" title="Practice did not load" message="Check your connection and try again. Nothing was charged." onRetry={() => { setError(null); setStatus('loading'); setLoadNonce(n => n + 1); }} />;
  }

  // What this session sends: chapters only for a mode that takes them, a level only where the mode allows one and the
  // student has Pro (the server refuses anything else; data/test_modes.js fineTuneScope).
  const sentChapters = scope.chapters ? selectedChapters : [];
  const chapterParam = sentChapters.length > 0
    ? `&chapters=${encodeURIComponent(sentChapters.join(','))}`
    : '';
  const difficultyParam = scope.difficulty && isPremium && difficultyMode !== 'auto'
    ? `&difficulty=${encodeURIComponent(difficultyMode)}`
    : '';
  const modeParam = `&mode=${encodeURIComponent(mode.id)}`;
  const interfaceParam = effectiveModeId === 'nta' && ntaScreen === 'nta' ? '&interface=nta' : '';
  const launchHref = `/test?subject=${selSubj}&count=${count}${modeParam}${chapterParam}${difficultyParam}${interfaceParam}`;
  const selectedSubject = subjects.find((entry) => entry.id === selSubj);
  const subjectLabel = selectedSubject?.name || '';
  const statsAvailable = stats?.state !== 'unavailable' && stats?.bankSize != null;
  const selectedSubjectBank = statsAvailable ? bankCount(stats, selectedSubject?.internalId, selSubj) : null;
  const chapterTotal = chapterData.count || selectedSubject?.chapters?.length || 0;

  const modeBadge = (id) => {
    const capability = MODE_CAPABILITIES[id];
    if (capability.state !== 'available') return { text: 'Unavailable', tone: 'muted' };
    if (isPremium) return { text: 'Included', tone: 'included' };
    if (capability.entitlement === 'access') return { text: 'Needs Pro', tone: 'locked' };
    if (id === 'full' && firstFullState === FIRST_FULL_MOCK_STATE.available) return { text: FIRST_FULL_MOCK_COPY.short, tone: 'included' };
    if (id === 'full' && !firstFullState) return { text: '', tone: 'cost' };
    // Quick practice is priced by its question count (1 credit a question); a Full mock is a fixed price.
    if (TEST_MODES[id].creditPerQuestion) return { text: `${TEST_MODES[id].creditPerQuestion} a question`, tone: 'cost' };
    return { text: `${TEST_MODES[id].creditCost} ${TEST_MODES[id].creditCost === 1 ? 'credit' : 'credits'}`, tone: 'cost' };
  };
  const minutes = (() => {
    const seconds = quoteMatches && quote.durationSec ? quote.durationSec : mode.fixedDurationSec || quoteCount * (mode.durationPerQuestionSec || 60);
    return Math.round(seconds / 60);
  })();
  const approximate = quoteMatches && quote.durationEstimated;
  // A blocked session still states its real price; the reason line and the action say what is missing.
  const shortfall = quoteStatus === 'ready' && quoteMatches && quote.reasonCode === 'insufficient_credits' ? Math.max(0, (quote.creditCost || 0) - balance) : 0;
  const costLabel = quoteStatus === 'ready' && quoteMatches
    ? !quote.launchable ? (quote.reasonCode === 'access_required' ? 'Needs Pro' : quote.creditCost ? `${quote.creditCost} credits` : 'Not available')
      : isPremium ? 'Included with access'
        : quote.creditCost === 0 ? (quoteFirstFree ? FIRST_FULL_MOCK_COPY.price : 'Free: today’s included set')
          : `${quote.creditCost} credits`
    : 'Checking';
  const costTone = quoteStatus === 'ready' && quoteMatches && !quote.launchable ? 'locked' : 'cost';
  // The session in words, said once, on the Start key (owner G26, 19 Oct): "Start 10 questions in Accountancy". The card
  // above it leads with the mode, so picking a subject never puts a count and a subject at the top of the page.
  const sessionWords = effectiveModeId === 'full' ? 'the full mock' : effectiveModeId === 'nta' ? 'the NTA paper' : `${quoteCount} ${quoteCount === 1 ? 'question' : 'questions'}`;
  const inSubject = subjectLabel ? ` in ${subjectLabel}` : '';
  const startLabel = isLaunching ? 'Starting…'
    : quoteStatus === 'loading' ? 'Checking…'
      : !quoteLaunchable ? 'Not available'
        : `Start ${sessionWords}${inSubject}`;
  const ntaOn = effectiveModeId === 'nta';
  const blocked = quoteStatus === 'ready' && quoteMatches && !quote.launchable;
  const blockedLabel = shortfall ? `Need ${shortfall} more practice ${shortfall === 1 ? 'credit' : 'credits'}` : quote?.reasonCode === 'access_required' ? 'See Pro' : 'See options';
  // The bar's short price: the server quote once it is in, the mode's own price until then.
  const barCost = quoteStatus === 'ready' && quoteMatches
    ? !quote.launchable ? (quote.reasonCode === 'access_required' ? 'Needs Pro'
      : quote.reasonCode === 'insufficient_credits' && quote.creditCost ? `${quote.creditCost} credits` : 'Not available')
      : isPremium ? 'Included'
        : quote.creditCost === 0 ? (quoteFirstFree ? FIRST_FULL_MOCK_COPY.short : 'Free today')
          : `${quote.creditCost} ${quote.creditCost === 1 ? 'credit' : 'credits'}`
    : modeBadge(effectiveModeId).text || 'Checking';
  const chapterValue = effectiveModeId === 'smart' ? 'Your weakest topics, chosen for you' : !scope.chapters ? 'All, as the exam' : sentChapters.length ? `${sentChapters.length} of ${chapterTotal}` : chapterTotal ? `All ${chapterTotal}` : 'All';
  const difficultyValue = !scope.difficulty ? 'Chosen for you' : difficultyMode === 'auto' ? 'Balanced' : difficultyMode[0].toUpperCase() + difficultyMode.slice(1);
  // Mobi on this page only at a real moment: thinking in the card while a start is slow, or after a failed start; else
  // beside "We choose for you" in Fine-tune. Never both (D9).
  const cardMobi = creditError ? 'oops' : isLaunching && slowLaunch ? 'think' : null;

  function launch() {
    if (isLaunching || launchingKeyRef.current || !quoteLaunchable) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { setQuoteNonce((n) => n + 1); return; }
    setCreditError(null);
    setIsLaunching(true);
    launchingKeyRef.current = launchingKeyRef.current || quote.idempotencyToken;
    forgetDailySet(user?.id); // starting a set may use today's included one: the next read asks the server again
    forgetFirstFullMock(user?.id); // and a full mock may take the subject's free first one
    setLaunchSuccess(`Launching ${mode.label}…`);
    toast.success('Starting your session…');
    const tonight = new URLSearchParams();
    for (const name of ['tonightKey','tonightMinutes']) if (searchParams.get(name)) tonight.set(name,searchParams.get(name));
    const target = `${launchHref}&generationKey=${encodeURIComponent(launchingKeyRef.current)}${tonight.size ? `&${tonight}` : ''}`;
    // A Full mock or NTA paper opens on its start moment: the clock turns once, then the paper loads. Short sessions go now.
    if (mode.id === 'full' || mode.id === 'nta') {
      setLaunchMoment('turn');
      window.setTimeout(() => router.push(target), reducedMotion() ? START_FADE_MS : START_TURN_MS);
      return;
    }
    router.push(target);
  }

  // The card's Chapters and Difficulty rows go to Fine-tune and put focus on its first control.
  function goToFine(what) {
    const block = fineRef.current;
    if (!block) return;
    block.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    const target = what === 'chapters' ? chapterButtonRef.current : block.querySelector('[role="radio"][aria-checked="true"]');
    window.setTimeout(() => target?.focus?.({ preventScroll: true }), reducedMotion() ? 0 : 320);
  }

  // The phone bar's key names what it starts, so it never reads as the dock's Start key (which opens the Start sheet).
  const barStartLabel = effectiveModeId === 'full' ? 'Start full mock'
    : effectiveModeId === 'nta' ? 'Start NTA paper'
      : `Start ${quoteCount} ${quoteCount === 1 ? 'question' : 'questions'}`;
  const keyNamesCount = !['full', 'nta'].includes(effectiveModeId) && !blocked && quoteStatus !== 'error';
  // The session card's Start (from 1024 px) and the phone bar's Start: one volt each, never both on one layout.
  const examPair = effectiveModeId === 'full' || effectiveModeId === 'nta';
  const startKey = (className, short = false) => (blocked && quote.upgradeHref ? (
    <Link href={quote.upgradeHref} data-pro-feature={quote.reasonCode === 'access_required' ? effectiveModeId : 'credits'} className={`btn-outline md ${className}`}>{short ? (shortfall ? `Need ${shortfall} more` : quote.reasonCode === 'access_required' ? 'See Pro' : 'See options') : blockedLabel}</Link>
  ) : quoteStatus === 'error' && short ? (
    <button type="button" className={`btn-outline md ${className}`} onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button>
  ) : (
    <Button key={`key-${modeNudge}`} variant="volt" size="md" className={className} data-page-primary={short ? undefined : ''} data-phone-primary={short ? '' : undefined} data-nudge={modeNudge > 0 || undefined}
      disabled={isLaunching || !quoteLaunchable} aria-busy={isLaunching || quoteStatus === 'loading' || undefined} aria-label={short && !isLaunching ? `${barStartLabel}${inSubject}` : undefined} onClick={launch}>
      {/* Under 380 px the bar's key says "Start 10" (its name still says the whole label), so the mode's name beside it is
          never cut to "Quick pr…" (W-068). The subject is the key's second line ("in Accountancy", owner G26). */}
      {short ? <>{examPair ? <ClockGlyph size={17} /> : null}{isLaunching ? 'Starting…' : <span className="pr-bar__keytext"><span>{keyNamesCount ? <>Start {quoteCount}<span className="pr-bar__qword"> {quoteCount === 1 ? 'question' : 'questions'}</span></> : barStartLabel}</span>{subjectLabel && quoteLaunchable ? <small>in {subjectLabel}</small> : null}</span>}</> : <>{examPair ? <ClockGlyph /> : <AppIcon name="practice" size={18} />}<span className="pr-summary__words">{startLabel}</span></>}
    </Button>
  ));

  return (
    // data-owns-start: Practice owns the volt Start, so the sidebar's Start key is quiet (outlined) for the whole visit, never
    // flipping as the page scrolls (owner F12; AppLayoutClient, start.css). The phone dock's key steps back while the session
    // bar's key (data-phone-primary) is on screen, and only then (W-075; pagePrimary.mjs). This page has no scroll script.
    <div className="pr view" data-rule={startSheet ? '' : undefined} data-owns-start="" data-launch={launchMoment || undefined}>
      {!isPremium && (
        <CreditsRemainingModal open={showCreditsModal} credits={user?.creditBalance ?? 0} offer={quote?.offer} onClose={() => setShowCreditsModal(false)} />
      )}

      <header className="pr-head pr-head--solo">
        <div>
          <h1 className="display-md">{user?.name ? `${user.name.split(' ')[0]}, what are we practising?` : 'What are we practising?'}</h1>
          <p>Pick a subject and a mode. Timed, marked +5 / −1, saved to your record.</p>
          {/* The balance under the lede at every width. The price is said once, on the mode tiles (and the card's own Cost line),
              not again here (release 9: it was stated about four times in the first fold). */}
          <p className="pr-head__credits">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} unitLabel="credits" size={15} />
            {isPremium ? <span>Quick practice and Full mock are included with your access.</span> : null}
          </p>
          <PracticeMobChip userId={user?.id} />
        </div>
      </header>


      {creditError && <div className="pr-alert" data-tone="error" role="alert"><StatusIcon kind="error" />{creditError}</div>}

      {launchSuccess && <div className="pr-alert" data-tone="success" role="status"><StatusIcon kind="success" />{launchSuccess}</div>}

      {linkedSubjectUnavailable && <div className="pr-alert" data-tone="warning" role="status"><StatusIcon kind="warning"/><div><strong>The lesson’s subject is not in your available practice subjects.</strong><p>Choose an available subject below, or add the lesson’s subject before starting practice.</p><Link href="/onboarding?edit=true">Edit subjects</Link></div></div>}

      {staleSubs.length > 0 && (
        <div className="pr-alert" data-tone="warning" role="status">
          <StatusIcon kind="warning" />
          <div>
            <strong>Some saved subjects cannot start practice</strong>
            <ul>{staleSubs.map((subject) => <li key={subject.id}><b>{subject.name}:</b> {subject.practiceReason}</li>)}</ul>
            <Link href="/onboarding?edit=true">Edit subjects</Link>
          </div>
        </div>
      )}

      {mySubs.length === 0 ? (
        <EmptyState
          title={staleSubs.length ? 'Choose a subject with practice' : 'Pick your subjects first'}
          message={staleSubs.length ? 'None of your saved subjects has practice yet. Add a supported CUET subject to start.' : 'Choose the CUET UG subjects you want to practise.'}
          actionLabel="Edit subjects"
          onAction={() => router.push('/onboarding?edit=true')}
        />
      ) : (
        <div className="pr-layout pr-layout--1017">
          <div className="pr-steps">
            <section className="pr-step pr-step--subjects" aria-labelledby="pr-s1">
              <div className="pr-step__head">
                <h2 id="pr-s1">Subject</h2>
                <Link href="/onboarding?edit=true" className="pr-link">Edit subjects</Link>
              </div>
              {/* The subject shelf: each subject's object on one shelf line, its name and chapter count under it. The chosen
                  one is sharp with its lamp on and a volt rule under its name; the others stand back, blurred, dimmer and a
                  little smaller (owner F7). Phones: one sideways row that brings the chosen subject to the middle. */}
              <div className="pr-shelf" data-overflow={shelfEdges.overflow || undefined} data-at-end={shelfEdges.end || undefined}>
              <div className="pr-subjects" role="group" aria-label="Subject" data-count={Math.min(mySubs.length, 6)} ref={shelfRef}>
                {mySubs.map((subject) => {
                  const on = selSubj === subject.id;
                  const total = subject.chapters?.length || 0;
                  return (
                    <button key={subject.id} type="button" aria-pressed={on} className="pr-subject" onClick={(event) => chooseSubject(event, subject)}>
                      {/* Drawn at the shelf's largest size and alive at every size; the lamp is always there and
                          practice.css lights it on the chosen subject. */}
                      <SubjectObject id={subject.internalId || subject.id} size={132} life lit className="pr-subject__obj" />
                      <span className="pr-subject__name">{subject.name}</span>
                      <span className="pr-subject__meta">
                        {total ? <span>{total} {total === 1 ? 'chapter' : 'chapters'}</span> : null}
                        {subject.officialCode ? <span>Code {subject.officialCode}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* The chevron hint (phones): a tap moves the shelf on by two subjects; keyboard users tab through the subjects. */}
              <button ref={shelfHint} type="button" className="pr-shelf__hint" tabIndex={-1} aria-hidden="true"
                onClick={() => { const el = shelfRef.current; const first = el?.querySelector('.pr-subject'); if (el) el.scrollBy({ left: (first?.offsetWidth || 104) * 2, behavior: railReduced() ? 'auto' : 'smooth' }); }}>
                <span className="pr-shelf__disc"><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
              </button>
              </div>
              {/* Repairs and Ask Mobi, about the subject the shelf has chosen (owner D5): what is waiting to be repaired, the
                  saved repairs to revisit, and Mobi in place. It changes with the shelf, so it is seen on every visit. */}
              <PracticeRepairs userId={user?.id} attempts={attempts} subjectId={selSubj} subjectName={subjectLabel} />
            </section>

            <section className="pr-step pr-step--modes" aria-labelledby="pr-s2">
              <div className="pr-step__head"><h2 id="pr-s2">Mode</h2><span className="pr-hint">Every mode uses the same checked questions.</span></div>
              {/* Four pressable tiles, one radio group: a ring in the corner fills to a tick on the chosen tile (owner F5:
                  the modes must feel like buttons that do something). Locked modes stay choosable so the quote can say why. */}
              <div className="pr-tiles" role="radiogroup" aria-labelledby="pr-s2" onKeyDown={onModeKey}>
                {MODE_LIST.map((id) => {
                  const m = TEST_MODES[id];
                  const badge = modeBadge(id);
                  const on = effectiveModeId === id;
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="pr-tile mk-press" data-mode={id} data-tone={badge.tone}
                      onClick={(event) => { answerPick(event); chooseMode(id); if (badge.tone === 'locked') openUpgrade({ trigger: id, opener: event.currentTarget }); }}>
                      {/* The chosen tile's rim draws round it (restored 19 Oct, owner G28/G31: the mk-rim draw of deploy/1016-batch). */}
                      <span className="pr-tile__rim" aria-hidden="true" />
                      <span className="pr-tile__price" data-tone={badge.tone}>{badge.tone === 'locked' ? <AppIcon name="lock" size={13} /> : null}{badge.text}</span>
                      <span className="pr-tile__art" aria-hidden="true"><ModeArt id={id} subjectId={selectedSubject?.internalId || selSubj} on={on} /></span>
                      <span className="pr-tile__text">
                        {/* NTA mode is the button-card closest to exam day: its volt gradient and this line come back from
                            deploy/1015-night (owner G28, 19 Oct). */}
                        {id === 'nta' ? <span className="pr-tile__kicker">The closest thing to exam day</span> : null}
                        <span className="pr-tile__name">{m.label}</span>
                        <span className="pr-tile__spec">{MODE_TILE_SPECS[id]}</span>
                      </span>
                      {/* The tile says what pressing it does (owner F5): "Set up" puts this mode in the session card and on
                          its Start key; once chosen it reads "Chosen", with the tick. */}
                      <span className="pr-tile__act" aria-hidden="true">
                        {on ? <Check size={14} strokeWidth={3} /> : <Play size={12} strokeWidth={0} fill="currentColor" />}
                        <span>{on ? 'Chosen' : 'Set up'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {ntaOn ? (
                <div className="pr-nta__after">
                  {/* NTA mode's panel: the exam screen, what the mode is in full, and the screen choice. Moved here from the
                      mode row and from the old Mobi line under the setup; nothing is dropped. */}
                  <div className="pr-nta__more">
                    <NtaConsolePreview subject={subjectLabel || 'Accountancy'} subjectId={selectedSubject?.id || selSubj} />
                  </div>
                  <div className="pr-nta__screen">
                    <p className="pr-nta__about">{MODE_SPECS.nta} Mobi stays outside while you answer.</p>
                    {isPremium ? (
                      <>
                        <span className="pr-fine__label">Exam screen</span>
                        <Segmented label="Exam screen" value={ntaScreen} onChange={setNtaScreen}
                          options={[{ value: 'mockmob', label: 'MockMob style' }, { value: 'nta', label: 'NTA style' }]} />
                        <span className="pr-hint">Same questions, timing and scoring. You can switch inside the test.</span>
                      </>
                    ) : (
                      <p className="pr-hint">NTA mode needs Pro. See how both screens look first: <Link href="/?stay=1#exam-experience" className="pr-link">Free exam-screen preview</Link></p>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* The tail of the setup: Questions, Fine-tune, the session card and, on phones, the session bar. The bar is sticky
              inside this block, so it arrives with Questions, rides above the tab bar while you finish the setup, lands as
              the card's footer and leaves with it: it never sits on the subject shelf or the mode tiles on the first screen
              (verifier W-008), and with no script it can never come back lower down (owner F12). From 1024 px this block
              dissolves into the two-column grid (practice.css). */}
          <div className="pr-tail">

            <section className="pr-step" aria-labelledby="pr-s3">
              <div className="pr-step__head"><h2 id="pr-s3">Questions</h2><span className="pr-hint">{mode.fixedCount ? 'Fixed for this mode' : `About ${minutes} minutes`}</span></div>
              {mode.fixedCount ? (
                <p className="pr-fixed"><b>{mode.fixedCount} questions</b><span>{minutes} minutes, one sitting, exam timing</span></p>
              ) : (
                <Segmented label="Number of questions" value={count} options={(mode.countOptions || [5, 10, 15, 20]).map((n) => ({ value: n, label: String(n), ...countHintFor(n) }))} onChange={setCount} />
              )}
            </section>

            {/* Fine-tune: always open, above the session and its Start, and scoped by the mode (owner F8, F9; START-1017
                4.3). Quick practice: chapters and difficulty. Full mock: difficulty only. Smart and NTA: we choose. */}
            <section className="pr-step pr-fine2" aria-labelledby="pr-s4" ref={fineRef} id="pr-fine" data-scope={scope.chapters ? 'both' : scope.difficulty ? 'level' : 'none'}>
              <div className="pr-step__head"><h2 id="pr-s4">Fine-tune</h2>{scope.chapters || scope.difficulty ? <span className="pr-hint">Optional</span> : null}</div>
              {scope.chapters || scope.difficulty ? (
                <p className="pr-fine2__scope" key={effectiveModeId}>{SCOPE_LINE[effectiveModeId]}</p>
              ) : (
                <div className="pr-fine2__we" key={effectiveModeId}>
                  {cardMobi ? null : <span className="pr-fine2__mobi" aria-hidden="true"><PipActor pose="thinking" blink={1} /></span>}
                  <p>{SCOPE_LINE[effectiveModeId]}{effectiveModeId === 'smart' && !attempts.length ? ' With no answers yet, it starts from the standard mix.' : ''}</p>
                </div>
              )}
              {scope.chapters ? (
                <div className="pr-fine2__row">
                  <div className="pr-fine2__label"><span>Chapters</span><small>{sentChapters.length ? `${sentChapters.length} of ${chapterTotal}` : chapterTotal ? `All ${chapterTotal}` : ''}</small></div>
                  <ChapterPicker key={selSubj} subjectName={subjectLabel} data={chapterData} chosen={selectedChapters} autoOpen={pickChapters && searchParams.get('subject') === selSubj}
                    onChange={(next) => { setSelectedChapters(next); setChapterNote(null); }}
                    onRetry={() => { setChapterData({ state: 'loading', units: [], count: 0, flat: true }); setChapterNonce((n) => n + 1); }} buttonRef={chapterButtonRef} />
                  {chapterNote ? <p className="pr-fine2__note" role="status">{chapterNote}</p> : null}
                </div>
              ) : chapterNote ? <p className="pr-fine2__note" role="status">{chapterNote}</p> : null}
              {scope.difficulty ? (
                <div className="pr-fine2__row">
                  <div className="pr-fine2__label"><span>Difficulty</span><small>{mixLine(mode)}</small></div>
                  <Segmented label="Difficulty" value={difficultyMode} disabledValues={isPremium ? [] : ['easy', 'medium', 'hard']}
                    options={['auto', 'easy', 'medium', 'hard'].map((d) => ({ value: d, label: d === 'auto' ? 'Balanced' : d[0].toUpperCase() + d.slice(1) }))} onChange={setDifficultyMode} />
                  {/* One Pro ask in view (D79 restraint): while the session card's cost line asks, this line only informs. */}
                  {!isPremium ? <p className="pr-fine2__mix">A set level comes with Pro.{costNudgeShown ? null : <> <Link href="/pricing" className="pr-link" data-pro-feature="difficulty">See Pro</Link></>}</p> : null}
                </div>
              ) : null}
            </section>

          <aside className="pr-summary pr-ticket" aria-label="Your session">
            {/* The card leads with the mode (owner G26, 19 Oct): its picture, its name and what it is. The count and the subject
                are said once, on the Start key, so picking a subject changes nothing at the top of the card. */}
            <div className="pr-ticket__top">
              <span className="pr-ticket__obj pr-ticket__art" key={effectiveModeId} aria-hidden="true"><ModeArt id={effectiveModeId} subjectId={selectedSubject?.internalId || selSubj} on /></span>
              <div>
                <h2 className="pr-ticket__mode">{mode.label}</h2>
                <p className="pr-ticket__what">{MODE_TILE_SPECS[effectiveModeId]}</p>
              </div>
              {cardMobi ? <span className="pr-ticket__mobi" aria-hidden="true"><PipActor pose={cardMobi === 'oops' ? 'encouraging' : 'thinking'} blink={1} /></span> : null}
            </div>
            <dl>
              <div><dt>Time</dt><dd>{approximate ? 'About ' : ''}{minutes} min</dd></div>
              <div><dt>Marking</dt><dd>+5 / −1</dd></div>
              <div data-wide="" data-emph=""><dt>Cost</dt><dd data-tone={costTone}>{costLabel}</dd></div>
            </dl>
            {/* The bank behind every paper, said once and quietly (owner, 16 Oct; START-1017 D10): no fixed set of mocks,
                each paper built fresh, unseen questions first. Count from /api/stats; unknown is not 0. */}
            <p className="pr-ticket__fresh">{freshPaperLine({ count: selectedSubjectBank, subjectName: subjectLabel, isPremium, mode: effectiveModeId })}</p>
            {/* Free only, when this set has a credit price (D79): one quiet line under the cost. */}
            {!isPremium && quoteLaunchable && quote.creditCost > 0 ? <InlineNudge placement="practice_cost" facts={{ balance }} className="pr-nudge" onShown={setCostNudgeShown} /> : null}
            <p className="pr-summary__reason" role="status" aria-live="polite" tabIndex={-1}>
              {quoteStatus === 'loading' && 'Checking access, credits and questions…'}
              {quoteStatus === 'error' && <>Could not check this session. Nothing was charged. <button type="button" onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button></>}
              {quoteStatus === 'ready' && quoteMatches && quote.reason}
              {quoteStatus === 'ready' && quoteMatches && !quote.launchable && quote.upgradeHref && (
                <> <Link href={quote.upgradeHref} data-pro-feature={quote.reasonCode === 'access_required' ? effectiveModeId : 'credits'}>{quote.reasonCode === 'access_required' ? 'See Pro' : 'See options'}</Link></>
              )}
              {quoteStatus === 'ready' && quoteMatches && quote.reasonCode === 'insufficient_credits' && (
                <> <Link href="/wallet">Open your wallet</Link></>
              )}
            </p>
            <StartRule sheet={startSheet} />
            {/* Fine-tune, said right above Start on every width (owner F8: "above the start quick practice so that everyone
                can see and customize it"). Edit goes to the Fine-tune block and opens what it names. */}
            <div className="pr-ticket__fine" role="group" aria-labelledby="pr-ticket-fine">
              <div className="pr-ticket__fine-head">
                <span id="pr-ticket-fine"><SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" />Fine-tune</span>
                {scope.chapters || scope.difficulty ? <button type="button" className="pr-ticket__edit" onClick={() => goToFine(scope.chapters ? 'chapters' : 'difficulty')}>Edit<span className="sr-only"> fine-tune</span></button> : null}
              </div>
              <dl>
                <div><dt>Chapters</dt><dd>{scope.chapters ? <button type="button" className="pr-ticket__go" onClick={() => goToFine('chapters')}>{chapterValue}</button> : chapterValue}</dd></div>
                <div><dt>Difficulty</dt><dd>{scope.difficulty ? <button type="button" className="pr-ticket__go" onClick={() => goToFine('difficulty')}>{difficultyValue}</button> : difficultyValue}</dd></div>
              </dl>
            </div>
            {startKey('pr-summary__cta')}
          </aside>

          {/* Phones and tablets: the session bar, sticky inside the setup (practice.css). It rides above the tab bar while
              the setup is on screen, lands as the card's footer at its end and leaves with it: no scroll script, so it can
              never come back lower down (owner F12). From 1024 px the card is a sticky side panel and there is no bar. */}
          <div className="pr-bar" role="region" aria-label="Start this session">
            <div className="pr-bar__in">
              {startSheet ? <p className="pr-dock__rule"><Target size={14} strokeWidth={2.3} aria-hidden="true" /><span>{startSheet.rule}</span></p> : null}
              {/* Fine-tune, one line right above Start, so nobody skips it (owner F8). */}
              {scope.chapters || scope.difficulty ? (
                <button type="button" className="pr-bar__fine" onClick={() => goToFine(scope.chapters ? 'chapters' : 'difficulty')}>
                  <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                  <span className="pr-bar__fine-text"><b>Fine-tune</b> {scope.chapters ? `${sentChapters.length ? `${sentChapters.length} of ${chapterTotal}` : chapterTotal ? `all ${chapterTotal}` : 'all'} chapters, ` : ''}{difficultyValue.toLowerCase()} level</span>
                  <span className="pr-bar__fine-edit">Edit</span>
                </button>
              ) : (
                <p className="pr-bar__fine" data-static=""><SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" /><span className="pr-bar__fine-text"><b>Fine-tune</b> {effectiveModeId === 'smart' ? 'your weak topics, nothing to choose' : 'built the NTA way, nothing to choose'}</span></p>
              )}
              <span className="pr-bar__obj" key={selSubj}>
                <SubjectObject id={selectedSubject?.internalId || selSubj} size={60} lit />
              </span>
              <span className="pr-bar__text" data-blocked={blocked || undefined}>
                <b>{mode.label}</b>
                {/* The key already names the count ("Start 10 questions"), so the line does not repeat it; full and NTA papers keep it. */}
                <span><span className="sr-only">{subjectLabel}, {keyNamesCount ? `${quoteCount} questions, ` : ''}</span>{keyNamesCount ? null : <>{quoteCount} Q<Sep /></>}<span className="pr-bar__min">{approximate ? 'about ' : ''}{minutes} min<Sep /></span><i data-tone={blocked ? 'locked' : undefined}>{barCost}</i></span>
              </span>
              {startKey('pr-bar__go', true)}
            </div>
          </div>
          </div>
        </div>
      )}

      <ProFacts facts={{ sessions: status === 'ready' ? attempts.length : null, fullMocks: status === 'ready' ? fullMocksIn(attempts) : null, balance: isPremium ? null : balance }} />
      {/* Ruled figures from the student's own record. The bank size shows only when it is known. */}
      <dl className="pr-stats" data-count={statsAvailable || stats.state === 'loading' ? 4 : 3}>
        {statsAvailable || stats.state === 'loading' ? <div><dt>Usable questions</dt><dd>{statsAvailable ? Number(stats.bankSize || 0).toLocaleString('en-IN') : <span className="pr-stats__wait">Checking</span>}</dd></div> : null}
        <div><dt>Sessions</dt><dd>{attempts.length}<small className="pr-stats__note">saved</small></dd></div>
        <div><dt>Average score</dt><dd>{attempts.length ? <>{avg}%<small className="pr-stats__note">over {attempts.length} {attempts.length === 1 ? 'session' : 'sessions'}{attempts.length < 5 ? ', too few to read much into' : ''}</small></> : <span className="pr-stats__wait">No sessions yet</span>}</dd></div>
        <div><dt>Your standing</dt><dd>{rank ? <>#{rank}<small className="pr-stats__note">of {rankedOf.toLocaleString('en-IN')} {rankedOf === 1 ? 'student' : 'students'} ranked</small></> : <span className="pr-stats__wait">Not ranked yet</span>}</dd></div>
      </dl>

      <div className="pr-lower">
        <section className="pr-panel pr-panel--recent" aria-labelledby="pr-recent">
          <div className="pr-panel__head"><h2 id="pr-recent">Recent sessions</h2>{attempts.length > 0 && <Link href="/review" className="pr-link">Review and repair</Link>}</div>
          {attempts.length === 0 ? (
            <p className="pr-empty">Your sessions appear here after you submit your first one.</p>
          ) : (
            <ul className="pr-recent">
              {attempts.slice(0, 5).map((attempt) => {
                const subject = subjects.find((entry) => entry.id === attempt.subject);
                const tone = attempt.score >= 70 ? 'good' : attempt.score >= 40 ? 'mid' : 'low';
                return (
                  <li key={attempt.id}>
                    <Link href={`/result/${attempt.id}`}>
                      <span className="pr-recent__icon" aria-hidden="true"><SubjectObject id={subject?.internalId || attempt.subject} size={56} framed={false} life={false} /></span>
                      <span className="pr-recent__text"><b>{subject?.name || attempt.subject}</b><i>{new Date(attempt.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<Sep />{attempt.correct}/{attempt.total} correct</i></span>
                      <span className="pr-recent__score" data-tone={tone}><b>{attempt.score}%</b><small>of marks</small></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="pr-lower__side">
        {studyEnabled && <ConceptsPanel />}
        <section className="pr-panel" aria-labelledby="pr-access">
          <div className="pr-panel__head"><h2 id="pr-access">{isPremium ? 'Your access' : 'MockMob Pro'}</h2></div>
          <p className="pr-panel__lead">{isPremium
            ? `Quick practice, Full mock, Smart practice and NTA mode are included${user?.premiumUntil ? ` until ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
            : proEnded
              ? `Your Pro access ended on ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Quick practice and Full mock now use credits; your history and saved questions stay.`
              : 'Pro adds Smart practice and NTA mode, and Quick practice and Full mock stop costing credits.'}</p>
          <div className="pr-panel__row">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} unitLabel="credits" />
            {!isPremium && <Link className="pr-link" href="/pricing">{proEnded ? 'See Pro to renew' : 'See Pro'}</Link>}
          </div>
        </section>

        {contributeOn && <section className="pr-panel" aria-labelledby="pr-bank">
          <div className="pr-panel__head"><h2 id="pr-bank">Add a question</h2></div>
          <p className="pr-panel__lead">Upload a question. If it passes moderation, you earn credits for Quick practice and Full mock.</p>
          <Link href="/upload" className="pr-link pr-link--strong"><AppIcon name="contribute" size={16} />Upload a question</Link>
          {submissions.length > 0 && (
            <>
              <div className="pr-panel__head pr-panel__head--sub"><h3>My submissions</h3>
                <button type="button" className="pr-link" onClick={refreshSubmissions} disabled={subRefreshing}><AppIcon name="refresh" size={14} />{subRefreshing ? 'Refreshing' : 'Refresh'}</button>
              </div>
              <ul className="pr-subs">
                {submissions.slice(0, 5).map((q) => {
                  const s = SUBMISSION_STATUS[q.status] || SUBMISSION_STATUS.pending;
                  return (
                    <li key={q.id}>
                      <span className="pr-subs__q" title={q.question}>{q.question}</span>
                      <span className="pr-badge" data-tone={s.tone}><StatusIcon kind={s.icon} size={12} />{s.label}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>}
        </div>
      </div>
    </div>
  );
}

const SUBMISSION_STATUS = {
  live: { label: 'Approved', icon: 'success', tone: 'good' },
  pending: { label: 'In review', icon: 'info', tone: 'mid' },
  rejected: { label: 'Rejected', icon: 'error', tone: 'low' },
};

