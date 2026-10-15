"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Target } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppIcon, CreditAmount, ModeIcon, StatusIcon, SubjectIcon } from '@/components/ui/Glyph';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { CreditsRemainingModal } from '@/components/CreditsRemainingModal';
import NtaConsolePreview from '@/components/arena/NtaConsolePreview';
import NtaGlyph from '@/components/arena/NtaGlyph';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { SegmentedControl as Segmented } from '@/components/ui/controls/SegmentedControl';
import { SmoothDetails } from '@/components/ui/controls/SmoothDetails';
import { Chip } from '@/components/ui/controls/Chip';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { LIFE, tapKeyframes } from '@/components/brand/ObjectLifeModel.mjs';
import { TEST_MODES, resolveCount } from '@/../data/test_modes';
import { MODE_CAPABILITIES } from '@/../data/capabilities';
import StartRule, { useStartRule } from './StartRule';
import './practice.css';

const MODE_LIST = ['quick', 'full', 'smart'];

// A drawn dot between short facts (the site keeps the middle dot out of its words). Read out as a comma.
const Sep = () => <><span className="pr-sep" aria-hidden="true" /><span className="sr-only">, </span></>;
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

export default function DashboardPageClient() {
  const { user, status: authStatus } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [stats, setStats] = useState({ state: 'loading' });
  const [learningSummary, setLearningSummary] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subRefreshing, setSubRefreshing] = useState(false);

  const [selSubj, setSelSubj] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapterSearch, setChapterSearch] = useState('');
  const [selChapter, setSelChapter] = useState(null);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [difficultyMode, setDifficultyMode] = useState('auto');
  // null until the user picks one — defaults are derived from plan during render.
  const [selMode, setSelMode] = useState(null);
  // Today/PrepOS hand over the size of the session they planned (?count=), so the time the
  // student chose is the session they get.
  const [count, setCount] = useState(() => {
    const requested = Number(searchParams.get('count'));
    return TEST_MODES.quick.countOptions.includes(requested) ? requested : 10;
  });
  const [chapterOpen, setChapterOpen] = useState(false);
  // Which console NTA Mode opens in: MockMob's own layout, or the conventional exam-style screen.
  const [ntaScreen, setNtaScreen] = useState(() => (searchParams.get('interface') === 'nta' ? 'nta' : 'mockmob'));
  const [isLaunching, setIsLaunching] = useState(false);
  const launchingKeyRef = useRef(null);
  const [creditError, setCreditError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  // Server launch quote. The launch button renders this; it never guesses from credits.
  const [quote, setQuote] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState('idle');
  const [quoteNonce, setQuoteNonce] = useState(0);
  // Phones: the dock above the tab bar, shown while the in-page session card is out of sight.
  const summaryRef = useRef(null);
  const [dockShown, setDockShown] = useState(false);

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
    optional('/api/leaderboard', setLeaderboard, []);
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

  useEffect(() => {
    if (!selSubj) return;
    let alive = true;
    apiGet(`/api/chapters?subject=${selSubj}`)
      .then((data) => {
        if (!alive) return;
        const list = data?.grouped
          ? (data.units || []).flatMap((unit) => (unit.chapters || []).map((chapter) => ({ ...chapter, unitName: unit.name })))
          : (data?.chapters || []);
        setChapters(list);
        setChapterSearch('');
        const linkedChapter=searchParams.get('subject')===selSubj ? searchParams.get('chapter') : null;
        setSelectedChapters(linkedChapter && list.some(c=>c.name===linkedChapter) ? [linkedChapter] : []);
      })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [selSubj,searchParams]);

  const mySubs = useMemo(
    () => subjects.filter((subject) => user?.subjects?.includes(subject.id) && subject.practice === 'supported'),
    [subjects, user],
  );
  const linkedSubject=searchParams.get('subject');
  const linkedSubjectUnavailable=status==='ready' && linkedSubject && !mySubs.some(subject=>subject.id===linkedSubject);
  // Stored choices that cannot launch (not offered, merged or retired) are shown, never launched.
  const staleSubs = useMemo(
    () => (user?.subjects || [])
      .map((id) => subjects.find((subject) => subject.id === id) || { id, name: id, practice: 'unknown', practiceReason: 'This saved subject is no longer recognised. Edit your subjects to choose a current CUET subject.' })
      .filter((subject) => subject.practice !== 'supported'),
    [subjects, user],
  );
  const myRankIdx = leaderboard.findIndex((entry) => entry.userId === user?.id);
  const avg = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null;
  const isPremium = Boolean(user?.isPremium || learningSummary?.plan?.isPremium);
  const requestedMode = searchParams.get('mode');
  const effectiveModeId = selMode && TEST_MODES[selMode] ? selMode : [...MODE_LIST, 'nta'].includes(requestedMode) ? requestedMode : 'quick';
  const mode = TEST_MODES[effectiveModeId];
  const balance = user?.creditBalance || 0;
  const quoteCount = mode.fixedCount || count;
  const quoteMatches = Boolean(quote && quote.subject?.storedId === selSubj && quote.mode?.id === mode.id && quote.count === quoteCount);
  // The rule the student chose for their next mock (the Rule book), on this card before the clock starts: Full and NTA only.
  const startSheet = useStartRule(status === 'ready' ? selSubj : null, effectiveModeId);
  const quoteLaunchable = quoteStatus === 'ready' && quoteMatches && quote.launchable === true;
  const filteredChapters = useMemo(() => {
    const needle = chapterSearch.trim().toLowerCase();
    if (!needle) return chapters;
    return chapters.filter((chapter) => chapter.name?.toLowerCase().includes(needle));
  }, [chapters, chapterSearch]);

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

  // On a phone the session card sits four screens down, under Subject, Mode, NTA Mode and Questions, so
  // the dock carries the session and its Start until the card itself comes into view (as the app does).
  // The bottom 150 px are the tab bar and the dock, so the card only counts once it clears them.
  const hasSession = status === 'ready' && mySubs.length > 0;
  useEffect(() => {
    const card = summaryRef.current;
    if (!hasSession || !card || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([entry]) => setDockShown(!entry.isIntersecting), { rootMargin: '0px 0px -150px 0px' });
    io.observe(card);
    return () => io.disconnect();
  }, [hasSession]);

  // Click handler — also clamps count and resets difficulty when needed. Locked modes
  // stay selectable so the server quote can say what access they need.
  function chooseMode(id) {
    const next = TEST_MODES[id];
    if (!next) return;
    setSelMode(id);
    setCount((current) => resolveCount(next, current));
    if (!next.allowDifficultyOverride) setDifficultyMode('auto');
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2">Practice</div>
          <div className="h-10 w-72 max-w-full skeleton mb-2" />
          <div className="h-4 w-64 max-w-full skeleton" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass p-4">
              <div className="h-4 w-24 skeleton mb-4" />
              <div className="h-8 w-20 skeleton" />
            </div>
          ))}
        </div>
        <SkeletonCard lines={5} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState scene="unreachable" message={error} onRetry={() => { setError(null); setStatus('loading'); setLoadNonce(n => n + 1); }} />;
  }

  const chapterParam = selectedChapters.length > 0
    ? `&chapters=${encodeURIComponent(selectedChapters.join(','))}`
    : '';
  const difficultyParam = mode.allowDifficultyOverride && isPremium && difficultyMode !== 'auto'
    ? `&difficulty=${encodeURIComponent(difficultyMode)}`
    : '';
  const modeParam = `&mode=${encodeURIComponent(mode.id)}`;
  const interfaceParam = effectiveModeId === 'nta' && ntaScreen === 'nta' ? '&interface=nta' : '';
  const launchHref = `/test?subject=${selSubj}&count=${count}${modeParam}${chapterParam}${difficultyParam}${interfaceParam}`;
  const selectedSubject = subjects.find((entry) => entry.id === selSubj);
  const selectedSubjectCount = stats.subjectCounts?.[selectedSubject?.internalId || selSubj] ?? 0;
  const statsAvailable = stats?.state !== 'unavailable' && stats?.bankSize != null;

  function togglePremiumChapter(chapterName) {
    setSelectedChapters((prev) => (
      prev.includes(chapterName)
        ? prev.filter((entry) => entry !== chapterName)
        : [...prev, chapterName]
    ));
  }

  const modeBadge = (id) => {
    const capability = MODE_CAPABILITIES[id];
    if (capability.state !== 'available') return { text: 'Unavailable', tone: 'muted' };
    if (isPremium) return { text: 'Included', tone: 'included' };
    if (capability.entitlement === 'access') return { text: 'Needs access', tone: 'locked' };
    return { text: `${TEST_MODES[id].creditCost} credits`, tone: 'cost' };
  };
  const minutes = (() => {
    const seconds = quoteMatches && quote.durationSec ? quote.durationSec : mode.fixedDurationSec || quoteCount * (mode.durationPerQuestionSec || 60);
    return Math.round(seconds / 60);
  })();
  const approximate = quoteMatches && quote.durationEstimated;
  const costLabel = quoteStatus === 'ready' && quoteMatches
    ? !quote.launchable ? 'Not available'
      : isPremium ? 'Included with access'
        : quote.creditCost === 0 ? 'Free: today’s included set'
          : `${quote.creditCost} credits`
    : '—';
  const startLabel = isLaunching ? 'Starting…'
    : quoteStatus === 'loading' ? 'Checking…'
      : !quoteLaunchable ? 'Not available'
        : `Start ${mode.label}`;
  // The dock's short price: the server quote once it is in, the mode's own price until then.
  const ntaOn = effectiveModeId === 'nta';
  const ntaBadge = modeBadge('nta');
  const dockBlocked = quoteStatus === 'ready' && quoteMatches && !quote.launchable;
  const dockCost = quoteStatus === 'ready' && quoteMatches
    ? !quote.launchable ? (quote.reasonCode === 'access_required' ? 'Needs Pro' : 'Not available')
      : isPremium ? 'Included'
        : quote.creditCost === 0 ? 'Free today'
          : `${quote.creditCost} credits`
    : modeBadge(effectiveModeId).text;

  function launch() {
    if (isLaunching || launchingKeyRef.current || !quoteLaunchable) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { setQuoteNonce((n) => n + 1); return; }
    setCreditError(null);
    setIsLaunching(true);
    launchingKeyRef.current = launchingKeyRef.current || quote.idempotencyToken;
    setLaunchSuccess(`Launching ${mode.label}…`);
    toast.success('Entering the arena…');
    const tonight = new URLSearchParams();
    for (const name of ['tonightKey','tonightMinutes']) if (searchParams.get(name)) tonight.set(name,searchParams.get(name));
    router.push(`${launchHref}&generationKey=${encodeURIComponent(launchingKeyRef.current)}${tonight.size ? `&${tonight}` : ''}`);
  }

  // A session that cannot start says why in the card, so the dock takes the student there.
  function showSession() {
    const card = summaryRef.current;
    if (!card) return;
    card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    card.querySelector('.pr-summary__reason')?.focus?.({ preventScroll: true });
  }

  return (
    <div className="pr view" data-rule={startSheet ? '' : undefined}>
      {!isPremium && (
        <CreditsRemainingModal open={showCreditsModal} credits={user?.creditBalance ?? 0} offer={quote?.offer} onClose={() => setShowCreditsModal(false)} />
      )}

      <header className="pr-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1 className="display-md">{user?.name ? `${user.name.split(' ')[0]}, what are we practising?` : 'What are we practising?'}</h1>
          <p>Pick a subject and a mode. Timed, marked +5 / −1, saved to Radar.</p>
          {/* Phones: the credits are one line under the heading (practice.css), not a card above Subject. */}
          <p className="pr-head__credits">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} size={15} />
            <span>{isPremium ? 'Quick Practice and Full Mock are included.' : `Quick Practice uses ${TEST_MODES.quick.creditCost}, Full Mock ${TEST_MODES.full.creditCost}.`}</span>
          </p>
        </div>
        <div className="pr-wallet" aria-label="Your credits">
          <div className="pr-wallet__row">
            <span className="pr-wallet__label">Practice credits</span>
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={false} size={18} />
          </div>
          <p className="pr-wallet__note">{isPremium ? 'Quick Practice and Full Mock cost nothing with your access.' : `Quick Practice costs ${TEST_MODES.quick.creditCost} credits and Full Mock costs ${TEST_MODES.full.creditCost}.`}</p>
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
          eyebrow="Subjects"
          title={staleSubs.length ? 'Choose a subject with practice' : 'Pick your subjects first'}
          message={staleSubs.length ? 'None of your saved subjects has practice yet. Add a supported CUET subject to start.' : 'Choose the CUET UG subjects you want to practise.'}
          actionLabel="Edit subjects"
          onAction={() => router.push('/onboarding?edit=true')}
        />
      ) : (
        <div className="pr-layout">
          <div className="pr-steps">
            <section className="pr-step pr-step--subjects" aria-labelledby="pr-s1">
              <div className="pr-step__head">
                <h2 id="pr-s1"><span>1</span>Subject</h2>
                <Link href="/onboarding?edit=true" className="pr-link">Edit subjects</Link>
              </div>
              {/* practice.css lays the tiles out for the room the step has and how many there are: four
                  make one row or two pairs, never three and an orphan. */}
              <div className="pr-subjects" data-count={Math.min(mySubs.length, 6)}>
                {mySubs.map((subject) => {
                  const on = selSubj === subject.id;
                  const count = stats.subjectCounts?.[subject.internalId || subject.id];
                  return (
                    <button key={subject.id} type="button" aria-pressed={on} className="pr-tile pr-subject mk-rim"
                      onClick={(event) => { answerPick(event); setSelSubj(subject.id); setSelChapter(null); setSelectedChapters([]); setDifficultyMode('auto'); }}>
                      {/* Drawn for the largest tile (practice.css sizes it: 60 px on phones, up to 152 px in the
                          desktop showcase) and alive at every size; the lamp is always there and practice.css
                          lights it on the chosen tile. */}
                      <SubjectObject id={subject.internalId || subject.id} size={152} life lit className="pr-subject__obj" />
                      <span className="pr-subject__name">{subject.name}</span>
                      <span className="pr-subject__meta">
                        {subject.officialCode ? <i>{subject.officialCode}</i> : null}
                        {statsAvailable ? `${Number(count ?? 0).toLocaleString('en-IN')} questions` : stats.state === 'loading' ? 'Checking question count…' : 'Count unavailable'}
                      </span>
                      {on ? <span className="pr-tile__tick" aria-hidden="true"><StatusIcon kind="check" size={14} /></span> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="pr-step pr-step--modes" aria-labelledby="pr-s2">
              <div className="pr-step__head"><h2 id="pr-s2"><span>2</span>Mode</h2><span className="pr-hint">Every mode uses the same checked questions.</span></div>
              {/* practice.css arranges the tiles by room. Phones follow the app's start deck: Quick leads, Full mock and
                  NTA mode pair up as the exam-conditions tiles, Smart practice runs as a row under them. From 720 px
                  it is Quick, Full and Smart in three columns and NTA mode as its own wide showcase. */}
              <div className="pr-modes">
                {MODE_LIST.map((id) => {
                  const m = TEST_MODES[id];
                  const badge = modeBadge(id);
                  const on = effectiveModeId === id;
                  return (
                    <button key={id} type="button" aria-pressed={on} className="pr-tile pr-mode mk-rim" data-mode={id} data-tone={badge.tone} onClick={() => chooseMode(id)}>
                      <span className="pr-mode__top">
                        <span className="pr-mode__icon"><ModeIcon id={id} size={20} /></span>
                        <span className="pr-badge" data-tone={badge.tone}>{badge.tone === 'locked' ? <AppIcon name="lock" size={12} /> : null}{badge.text}</span>
                      </span>
                      <span className="pr-mode__name">{m.label}</span>
                      <span className="pr-mode__spec">{MODE_SPECS[id]}</span>
                      {on ? <span className="pr-tile__tick" aria-hidden="true"><StatusIcon kind="check" size={14} /></span> : null}
                    </button>
                  );
                })}
                {/* NTA Mode: the closest thing to exam day. */}
                <button type="button" aria-pressed={ntaOn} className="pr-tile pr-nta mk-rim" data-mode="nta" data-tone={ntaBadge.tone} onClick={() => chooseMode('nta')}>
                  <span className="pr-nta__copy">
                    <span className="pr-mode__top">
                      <span className="pr-mode__icon"><ModeIcon id="nta" size={20} /></span>
                      <NtaGlyph className="pr-nta__glyph" size={48} />
                      <span className="pr-nta__kicker">Closest to exam day</span>
                      <span className="pr-badge" data-tone={ntaBadge.tone}>{ntaBadge.tone === 'locked' ? <AppIcon name="lock" size={12} /> : null}{ntaBadge.text}</span>
                    </span>
                    <span className="pr-mode__name">NTA Mode</span>
                    <span className="pr-mode__spec">50 questions in 60 minutes on an exam-style screen: question palette, mark for review, clear response, and a countdown that submits for you.</span>
                    <span className="pr-nta__short">The exam-day screen, palette and mark for review.</span>
                    <span className="pr-nta__chips"><i>50 Q</i><i>60 min</i><i>Question palette</i><i>Mark for review</i></span>
                  </span>
                  <NtaConsolePreview subject={selectedSubject?.name || 'Accountancy'} />
                  {ntaOn ? <span className="pr-tile__tick" aria-hidden="true"><StatusIcon kind="check" size={14} /></span> : null}
                </button>
              </div>
              {ntaOn ? (
                <div className="pr-nta__after">
                  {/* Phones: the tile is short, so what it holds opens here once NTA mode is chosen. */}
                  <div className="pr-nta__more">
                    <p className="pr-mode__spec">50 questions in 60 minutes on an exam-style screen: question palette, mark for review, clear response, and a countdown that submits for you.</p>
                    <span className="pr-nta__chips"><i>50 Q</i><i>60 min</i><i>Question palette</i><i>Mark for review</i></span>
                    <NtaConsolePreview subject={selectedSubject?.name || 'Accountancy'} />
                  </div>
                  <div className="pr-nta__screen">
                    {isPremium ? (
                      <>
                        <span className="pr-fine__label">Exam screen</span>
                        <Segmented label="Exam screen" value={ntaScreen} onChange={setNtaScreen}
                          options={[{ value: 'mockmob', label: 'MockMob style' }, { value: 'nta', label: 'NTA style' }]} />
                        <span className="pr-hint">Same questions, timing and scoring. You can switch inside the test.</span>
                      </>
                    ) : (
                      <p className="pr-hint">NTA Mode needs Pro. See how both screens look first: <Link href="/?stay=1#exam-experience" className="pr-link">Free exam-screen preview</Link></p>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="pr-step" aria-labelledby="pr-s3">
              <div className="pr-step__head"><h2 id="pr-s3"><span>3</span>Questions</h2><span className="pr-hint">{mode.fixedCount ? 'Fixed for this mode' : `About ${minutes} minutes`}</span></div>
              {mode.fixedCount ? (
                <p className="pr-fixed"><b>{mode.fixedCount} questions</b><span>{minutes} minutes, one sitting, exam timing</span></p>
              ) : (
                <Segmented label="Number of questions" value={count} options={(mode.countOptions || [5, 10, 15, 20]).map((n) => ({ value: n, label: String(n) }))} onChange={setCount} />
              )}
            </section>

            <SmoothDetails className="pr-step pr-fine" open={chapterOpen || difficultyMode !== 'auto' || selectedChapters.length > 0} onToggle={(event) => setChapterOpen(event.currentTarget.open)} summary={<>
                <span>Fine-tune</span>
                <span className="pr-hint">{difficultyMode === 'auto' && selectedChapters.length === 0 ? 'Optional: balanced mix, all chapters' : `${difficultyMode === 'auto' ? 'Balanced mix' : `${difficultyMode} only`}, ${selectedChapters.length ? `${selectedChapters.length} ${selectedChapters.length === 1 ? 'chapter' : 'chapters'}` : 'all chapters'}`}</span>
                <AppIcon name="expand" size={16} className="pr-fine__chev" />
              </>}>
              {mode.allowDifficultyOverride && (
                <div className="pr-fine__block">
                  <div className="pr-fine__label">Difficulty {!isPremium ? <span className="pr-badge" data-tone="locked"><AppIcon name="lock" size={12} />Needs access</span> : null}</div>
                  <Segmented label="Difficulty" value={difficultyMode} disabledValues={isPremium ? [] : ['easy', 'medium', 'hard']}
                    options={['auto', 'easy', 'medium', 'hard'].map((d) => ({ value: d, label: d === 'auto' ? 'Balanced' : d[0].toUpperCase() + d.slice(1) }))} onChange={setDifficultyMode} />
                </div>
              )}
              {chapters.length > 0 && (
                <div className="pr-fine__block">
                  <div className="pr-fine__label">Chapters</div>
                  <label className="sr-only" htmlFor="pr-chapter-search">Search chapters</label>
                  <input id="pr-chapter-search" className="input" value={chapterSearch} onChange={(event) => setChapterSearch(event.target.value)} placeholder="Search chapters" />
                  <div className="ctl-chipset" data-scroll="true" role="group" aria-label="Chapters">
                    <Chip pressed={selectedChapters.length === 0} onClick={() => { setSelChapter(null); setSelectedChapters([]); }}>All chapters</Chip>
                    {filteredChapters.map((chapter) => (
                      <Chip key={chapter.id || chapter.name} pressed={selectedChapters.includes(chapter.name)} title={chapter.name} onClick={() => togglePremiumChapter(chapter.name)}>{chapter.name}</Chip>
                    ))}
                    {filteredChapters.length === 0 && <p className="pr-hint">No chapter matches that search.</p>}
                  </div>
                </div>
              )}
            </SmoothDetails>
          </div>

          <aside className="pr-summary" aria-label="Session summary" ref={summaryRef}>
            <h2>Your session</h2>
            <dl>
              <div><dt>Subject</dt><dd>{selectedSubject?.name || '—'}</dd></div>
              <div><dt>Mode</dt><dd>{mode.label}</dd></div>
              <div><dt>Questions</dt><dd>{quoteCount}</dd></div>
              <div><dt>Time</dt><dd>{approximate ? 'About ' : ''}{minutes} min</dd></div>
              <div><dt>Marking</dt><dd>+5 / −1</dd></div>
              <div data-emph="true"><dt>Cost</dt><dd>{costLabel}</dd></div>
            </dl>
            <p className="pr-summary__reason" role="status" aria-live="polite" tabIndex={-1}>
              {quoteStatus === 'loading' && 'Checking access, credits and questions…'}
              {quoteStatus === 'error' && <>Could not check this session. Nothing was charged. <button type="button" onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button></>}
              {quoteStatus === 'ready' && quoteMatches && quote.reason}
              {quoteStatus === 'ready' && quoteMatches && !quote.launchable && quote.upgradeHref && (
                <> <Link href={quote.upgradeHref}>{quote.reasonCode === 'access_required' ? 'See Pro' : 'See options'}</Link></>
              )}
            </p>
            <StartRule sheet={startSheet} />
            <Button variant="volt" size="md" className="pr-summary__cta" disabled={isLaunching || !quoteLaunchable} onClick={launch}>
              <AppIcon name="practice" size={18} />{startLabel}
            </Button>
          </aside>
        </div>
      )}

      {/* Phones and tablets (practice.css): the session in one line above the tab bar, with its Start, until
          the session card scrolls into view. Out of the tab order and the reading order while it is away. */}
      {mySubs.length > 0 ? (
        <div className="pr-dock" role="region" aria-label="Your session" data-shown={dockShown || undefined} inert={!dockShown}>
          {startSheet ? <p className="pr-dock__rule"><Target size={14} strokeWidth={2.3} aria-hidden="true" /><span>{startSheet.rule}</span></p> : null}
          <span className="pr-dock__obj" key={selSubj}>
            <SubjectObject id={selectedSubject?.internalId || selSubj} size={60} lit />
          </span>
          <span className="pr-dock__text">
            <b>{mode.label}</b>
            <span><span className="sr-only">{selectedSubject?.name}, </span>{quoteCount} Q<span className="pr-dock__min"><Sep />{approximate ? 'about ' : ''}{minutes} min</span><Sep /><i data-tone={dockBlocked ? 'locked' : undefined}>{dockCost}</i></span>
          </span>
          {/* One width in every state: "Start" waits, disabled, while the quote is checked. A session that cannot
              start (or a quote that failed) sends the student to the card, which says why. */}
          {dockBlocked || quoteStatus === 'error' ? (
            <button type="button" className="pr-dock__go pr-dock__go--why mk-press" onClick={showSession}>See why</button>
          ) : (
            <button type="button" className="pr-dock__go mk-press" onClick={launch} disabled={isLaunching || !quoteLaunchable} aria-busy={isLaunching || !quoteLaunchable || undefined}>
              <AppIcon name="practice" size={17} />Start
            </button>
          )}
        </div>
      ) : null}

      <ArenaCompanion compact act={creditError ? 'oops' : isLaunching ? 'think' : 'idle'} pose="attentive" title={effectiveModeId === 'nta' ? 'Meet the exam before exam day.' : `Set up ${mode.label}.`}>{effectiveModeId === 'nta' ? 'Choose your screen below. Mobi stays outside while you answer.' : 'Check the subject, time and access before you start.'}</ArenaCompanion>

      <dl className="pr-stats">
        <div><dt><AppIcon name="review" />Usable questions</dt><dd>{statsAvailable ? Number(stats.bankSize || 0).toLocaleString('en-IN') : stats.state === 'loading' ? 'Checking…' : 'Unavailable'}</dd></div>
        <div><dt><AppIcon name="practice" />Sessions</dt><dd>{attempts.length}</dd></div>
        <div><dt><AppIcon name="progress" />Average score</dt><dd>{attempts.length ? `${avg}%` : '—'}</dd></div>
        <div><dt><AppIcon name="ranks" />Leaderboard</dt><dd>{rank ? `#${rank}` : '—'}</dd></div>
      </dl>

      <div className="pr-lower">
        <section className="pr-panel" aria-labelledby="pr-recent">
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
                      <span className="pr-recent__icon"><SubjectIcon id={subject?.internalId || attempt.subject} size={18} /></span>
                      <span className="pr-recent__text"><b>{subject?.name || attempt.subject}</b><i>{new Date(attempt.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<Sep />{attempt.correct}/{attempt.total} correct</i></span>
                      <span className="pr-recent__score" data-tone={tone}>{attempt.score}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="pr-panel" aria-labelledby="pr-access">
          <div className="pr-panel__head"><h2 id="pr-access">{isPremium ? 'Your access' : 'MockMob Pro'}</h2></div>
          <p className="pr-panel__lead">{isPremium
            ? `Quick Practice, Full Mock, Smart Practice and NTA Mode are included${user?.premiumUntil ? ` until ${new Date(user.premiumUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
            : 'Pro adds Smart Practice and NTA Mode, and Quick Practice and Full Mock stop costing credits.'}</p>
          <div className="pr-panel__row">
            <CreditAmount kind="practice" amount={isPremium ? 'unlimited' : balance} unit={!isPremium} />
            {!isPremium && <Link className="pr-link" href="/pricing">See Pro</Link>}
          </div>
        </section>

        <section className="pr-panel" aria-labelledby="pr-bank">
          <div className="pr-panel__head"><h2 id="pr-bank">Feed the bank</h2></div>
          <p className="pr-panel__lead">Upload a question. If it passes moderation, you earn credits for Quick Practice and Full Mock.</p>
          <Link href="/upload" className="pr-link pr-link--strong">Upload a question<AppIcon name="contribute" size={16} /></Link>
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
  );
}

const MODE_SPECS = {
  quick: '5 to 20 questions, 1 minute each',
  full: '50 questions, 60 minutes',
  smart: 'Weights chapters you have missed',
  nta: '50 questions, 60 minutes, exam console',
};

const SUBMISSION_STATUS = {
  live: { label: 'Approved', icon: 'success', tone: 'good' },
  pending: { label: 'In review', icon: 'info', tone: 'mid' },
  rejected: { label: 'Rejected', icon: 'error', tone: 'low' },
};

