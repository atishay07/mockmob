"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Play, SlidersHorizontal, Target } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppIcon, CreditAmount, StatusIcon } from '@/components/ui/Glyph';
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
import { MODE_CAPABILITIES } from '@/../data/capabilities';
import { retiredSubjectEntry } from '@/../data/subject_claim';
import StartRule, { useStartRule } from './StartRule';
import ChapterPicker from './ChapterPicker';
import { chapterUnits, chaptersForMode } from './chapterGroups.mjs';
import { MODE_SPECS, MODE_TILE_SPECS, bankCount, freshPaperLine } from '@/lib/paperCopy.mjs';
import PracticeMobChip from '@/components/mob/PracticeMobChip';
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
  smart: 'We choose for you: Smart practice leans on the topics where you get under 60% right, so there is nothing to set.',
  nta: 'We choose for you: 50 questions across the syllabus in the exam’s mix, so there is nothing to set.',
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

// studyEnabled: the Learn lessons are on (STUDY_CONTENT_ENABLED, read by page.js). Learn left the phone dock for the More
// sheet and this page (NAV-1017 8.2), so its Concepts panel is drawn here only while Learn exists.
export default function DashboardPageClient({ studyEnabled = false } = {}) {
  const { user, status: authStatus } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

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
    optional('/api/questions/mine', value => setSubmissions(Array.isArray(value) ? value : []), []);
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
  }, [user, authStatus, loadNonce, searchParams]);

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
  // The rule the student chose for their next mock (the Rule book), on this card before the clock starts: Full and NTA only.
  const startSheet = useStartRule(status === 'ready' ? selSubj : null, effectiveModeId);
  const quoteLaunchable = quoteStatus === 'ready' && quoteMatches && quote.launchable === true;

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
    ? !quote.launchable ? (quote.reasonCode === 'access_required' ? 'Needs Pro' : quote.creditCost ? `${quote.creditCost} practice credits` : 'Not available')
      : isPremium ? 'Included with access'
        : quote.creditCost === 0 ? 'Free: today’s included set'
          : `${quote.creditCost} practice credits`
    : 'Checking';
  const costTone = quoteStatus === 'ready' && quoteMatches && !quote.launchable ? 'locked' : 'cost';
  const startLabel = isLaunching ? 'Starting…'
    : quoteStatus === 'loading' ? 'Checking…'
      : !quoteLaunchable ? 'Not available'
        : `Start ${mode.label}`;
  const ntaOn = effectiveModeId === 'nta';
  const blocked = quoteStatus === 'ready' && quoteMatches && !quote.launchable;
  const blockedLabel = shortfall ? `Need ${shortfall} more practice ${shortfall === 1 ? 'credit' : 'credits'}` : quote?.reasonCode === 'access_required' ? 'See Pro' : 'See options';
  // The bar's short price: the server quote once it is in, the mode's own price until then.
  const barCost = quoteStatus === 'ready' && quoteMatches
    ? !quote.launchable ? (quote.reasonCode === 'access_required' ? 'Needs Pro'
      : quote.reasonCode === 'insufficient_credits' && quote.creditCost ? `${quote.creditCost} credits` : 'Not available')
      : isPremium ? 'Included'
        : quote.creditCost === 0 ? 'Free today'
          : `${quote.creditCost} ${quote.creditCost === 1 ? 'credit' : 'credits'}`
    : modeBadge(effectiveModeId).text;
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
    <Link href={quote.upgradeHref} className={`btn-outline md ${className}`}>{short ? (shortfall ? `Need ${shortfall} more` : quote.reasonCode === 'access_required' ? 'See Pro' : 'See options') : blockedLabel}</Link>
  ) : quoteStatus === 'error' && short ? (
    <button type="button" className={`btn-outline md ${className}`} onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button>
  ) : (
    <Button key={`key-${modeNudge}`} variant="volt" size="md" className={className} data-page-primary={short ? undefined : ''} data-nudge={modeNudge > 0 || undefined}
      disabled={isLaunching || !quoteLaunchable} aria-busy={isLaunching || quoteStatus === 'loading' || undefined} onClick={launch}>
      {short ? <>{examPair ? <ClockGlyph size={17} /> : null}{isLaunching ? 'Starting…' : barStartLabel}</> : <>{examPair ? <ClockGlyph /> : <AppIcon name="practice" size={18} />}{startLabel}</>}
    </Button>
  ));

  return (
    // data-owns-start: Practice owns the volt Start, so the bar's and the sidebar's Start key are quiet (outlined) for the
    // whole visit, never flipping as the page scrolls (owner F12; AppLayoutClient, start.css).
    <div className="pr view" data-rule={startSheet ? '' : undefined} data-owns-start="" data-launch={launchMoment || undefined}>
      {!isPremium && (
        <CreditsRemainingModal open={showCreditsModal} credits={user?.creditBalance ?? 0} offer={quote?.offer} onClose={() => setShowCreditsModal(false)} />
      )}

      <header className="pr-head pr-head--solo">
        <div>
          <h1 className="display-md">{user?.name ? `${user.name.split(' ')[0]}, what are we practising?` : 'What are we practising?'}</h1>
          <p>Pick a subject and a mode. Timed, marked +5 / −1, saved to your record.</p>
          {/* The balance and the two prices, one line under the lede at every width (the session panel repeats the balance). */}
          <p className="pr-head__credits">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} unitLabel="practice credits" size={15} />
            <span>{isPremium ? 'Quick practice and Full mock are included with your access.' : `Quick practice costs ${TEST_MODES.quick.creditCost} practice credits and Full mock costs ${TEST_MODES.full.creditCost}.`}</span>
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
                      onClick={(event) => { answerPick(event); chooseMode(id); }}>
                      <span className="pr-tile__price" data-tone={badge.tone}>{badge.tone === 'locked' ? <AppIcon name="lock" size={13} /> : null}{badge.text}</span>
                      <span className="pr-tile__art" aria-hidden="true"><ModeArt id={id} subjectId={selectedSubject?.internalId || selSubj} on={on} /></span>
                      <span className="pr-tile__text">
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
                    <NtaConsolePreview subject={subjectLabel || 'Accountancy'} />
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
                <Segmented label="Number of questions" value={count} options={(mode.countOptions || [5, 10, 15, 20]).map((n) => ({ value: n, label: String(n) }))} onChange={setCount} />
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
                  {!isPremium ? <p className="pr-fine2__mix">A set level comes with Pro. <Link href="/pricing" className="pr-link">See Pro</Link></p> : null}
                </div>
              ) : null}
            </section>

          <aside className="pr-summary pr-ticket" aria-label="Your session">
            <div className="pr-ticket__top">
              <span className="pr-ticket__obj" key={selSubj}><SubjectObject id={selectedSubject?.internalId || selSubj} size={76} lit /></span>
              <div>
                <h2 className="pr-ticket__mode">{mode.label}</h2>
                <p className="pr-ticket__what">{quoteCount} {subjectLabel ? `${subjectLabel} ` : ''}questions</p>
              </div>
              {cardMobi ? <span className="pr-ticket__mobi" aria-hidden="true"><PipActor pose={cardMobi === 'oops' ? 'encouraging' : 'thinking'} blink={1} /></span> : null}
            </div>
            <dl>
              <div><dt>Time</dt><dd>{approximate ? 'About ' : ''}{minutes} min</dd></div>
              <div><dt>Marking</dt><dd>+5 / −1</dd></div>
              <div data-wide="" data-emph=""><dt>Cost</dt><dd data-tone={costTone}>{costLabel}</dd></div>
              {!isPremium ? <div data-wide="" data-balance=""><dt>Your practice credits</dt><dd>{balance.toLocaleString('en-IN')}</dd></div> : null}
            </dl>
            {/* The bank behind every paper, said once and quietly (owner, 16 Oct; START-1017 D10): no fixed set of mocks,
                each paper built fresh, unseen questions first. Count from /api/stats; unknown is not 0. */}
            <p className="pr-ticket__fresh">{freshPaperLine({ count: selectedSubjectBank, subjectName: subjectLabel, isPremium, mode: effectiveModeId })}</p>
            <p className="pr-summary__reason" role="status" aria-live="polite" tabIndex={-1}>
              {quoteStatus === 'loading' && 'Checking access, credits and questions…'}
              {quoteStatus === 'error' && <>Could not check this session. Nothing was charged. <button type="button" onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button></>}
              {quoteStatus === 'ready' && quoteMatches && quote.reason}
              {quoteStatus === 'ready' && quoteMatches && !quote.launchable && quote.upgradeHref && (
                <> <Link href={quote.upgradeHref}>{quote.reasonCode === 'access_required' ? 'See Pro' : 'See options'}</Link></>
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
                <p className="pr-bar__fine" data-static=""><SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" /><span className="pr-bar__fine-text"><b>Fine-tune</b> {effectiveModeId === 'smart' ? 'we pick your weakest topics' : 'the exam’s own mix, set for you'}</span></p>
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

      {/* Ruled figures from the student's own record. The bank size shows only when it is known. */}
      <dl className="pr-stats" data-count={statsAvailable || stats.state === 'loading' ? 4 : 3}>
        {statsAvailable || stats.state === 'loading' ? <div><dt>Usable questions</dt><dd>{statsAvailable ? Number(stats.bankSize || 0).toLocaleString('en-IN') : <span className="pr-stats__wait">Checking</span>}</dd></div> : null}
        <div><dt>Sessions</dt><dd>{attempts.length}<small className="pr-stats__note">saved</small></dd></div>
        <div><dt>Average score</dt><dd>{attempts.length ? <>{avg}%<small className="pr-stats__note">over {attempts.length} {attempts.length === 1 ? 'session' : 'sessions'}{attempts.length < 5 ? ', too few to read much into' : ''}</small></> : <span className="pr-stats__wait">No sessions yet</span>}</dd></div>
        <div><dt>Your standing</dt><dd>{rank ? <>#{rank}<small className="pr-stats__note">of {rankedOf.toLocaleString('en-IN')} {rankedOf === 1 ? 'student' : 'students'} ranked</small></> : <span className="pr-stats__wait">Not ranked yet</span>}</dd></div>
      </dl>

      <div className="pr-lower">
        <section className="pr-panel pr-panel--recent" aria-labelledby="pr-recent">
          <div className="pr-panel__head"><h2 id="pr-recent">Recent sessions</h2>{attempts.length > 0 && <Link href="/review" className="pr-link">Review mistakes</Link>}</div>
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
        {studyEnabled && (
          <section className="pr-panel" aria-labelledby="pr-concepts">
            <div className="pr-panel__head"><h2 id="pr-concepts">Concepts</h2></div>
            <p className="pr-panel__lead">Short lessons: learn a concept, lock it in with recall, then apply it on practice questions.</p>
            <Link href="/learn" className="pr-link pr-link--strong"><AppIcon name="learn" size={16} />Open Learn</Link>
          </section>
        )}
        <section className="pr-panel" aria-labelledby="pr-access">
          <div className="pr-panel__head"><h2 id="pr-access">{isPremium ? 'Your access' : 'MockMob Pro'}</h2></div>
          <p className="pr-panel__lead">{isPremium
            ? `Quick practice, Full mock, Smart practice and NTA mode are included${user?.premiumUntil ? ` until ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
            : proEnded
              ? `Your Pro access ended on ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Quick practice and Full mock now use practice credits; your history and saved questions stay.`
              : 'Pro adds Smart practice and NTA mode, and Quick practice and Full mock stop costing practice credits.'}</p>
          <div className="pr-panel__row">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} unitLabel="practice credits" />
            {!isPremium && <Link className="pr-link" href="/pricing">{proEnded ? 'See Pro to renew' : 'See Pro'}</Link>}
          </div>
        </section>

        <section className="pr-panel" aria-labelledby="pr-bank">
          <div className="pr-panel__head"><h2 id="pr-bank">Add a question</h2></div>
          <p className="pr-panel__lead">Upload a question. If it passes moderation, you earn practice credits for Quick practice and Full mock.</p>
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
        </section>
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

