"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppIcon, ModeIcon, StatusIcon, SubjectIcon } from '@/components/ui/Glyph';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { useResumableTest } from '@/components/VisitorSync';
import { CreditsRemainingModal } from '@/components/CreditsRemainingModal';
import NtaConsolePreview from '@/components/arena/NtaConsolePreview';
import { TEST_MODES, resolveCount } from '@/../data/test_modes';
import { MODE_CAPABILITIES } from '@/../data/capabilities';
import {
  accessSummary, arrivedWithSetup, confirmLine, costValue, isFirstCheck, planSetup, practiceLead, sessionTally,
} from '@/../data/practice_landing.mjs';
import NextStepStrip, { usePracticePlan } from './NextStepStrip';
import './practice.css';

const MODE_LIST = ['quick', 'full', 'smart'];

export default function DashboardPageClient() {
  const { user, status: authStatus } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resume = useResumableTest();

  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [stats, setStats] = useState({ state: 'loading' });
  const [learningSummary, setLearningSummary] = useState(null);
  // The student has started choosing their own session on this page.
  const [touched, setTouched] = useState(false);

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

  // After a mock attempt the test page sets `mm:postTest=1` in sessionStorage
  // before redirecting. When the user lands back here (Practice), pop the modal
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
    // Optional reads (question counts, plan flags) cannot hold the practice setup behind them.
    const optional = (path, apply, fallback) => apiGet(path)
      .then(value => { if (alive) apply(value ?? fallback); })
      .catch(() => { if (alive) apply(fallback); });
    optional('/api/stats', setStats, { state: 'unavailable' });
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
  const isPremium = Boolean(user?.isPremium || learningSummary?.plan?.isPremium);
  const requestedMode = searchParams.get('mode');
  const effectiveModeId = selMode && TEST_MODES[selMode] ? selMode : [...MODE_LIST, 'nta'].includes(requestedMode) ? requestedMode : 'quick';
  const mode = TEST_MODES[effectiveModeId];
  const quoteCount = mode.fixedCount || count;
  const quoteMatches = Boolean(quote && quote.subject?.storedId === selSubj && quote.mode?.id === mode.id && quote.count === quoteCount);
  const quoteLaunchable = quoteStatus === 'ready' && quoteMatches && quote.launchable === true;
  const arrived = arrivedWithSetup(searchParams);
  const planWanted = status === 'ready' && attempts.length > 0 && !resume && !arrived;
  const planRead = usePracticePlan(planWanted, user?.id);
  const lead = status === 'ready'
    ? practiceLead({ attempts, resume, plan: planRead.plan, planState: planRead.state === 'idle' ? 'loading' : planRead.state, arrivedWithSetup: arrived, touched })
    : null;
  const suggested = lead?.strip === 'setup' ? planSetup(planRead.plan?.primary, TEST_MODES) : null;
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

  // Click handler — also clamps count and resets difficulty when needed. Locked modes
  // stay selectable so the server quote can say what access they need.
  function chooseMode(id) {
    const next = TEST_MODES[id];
    if (!next) return;
    setTouched(true);
    setSelMode(id);
    setCount((current) => resolveCount(next, current));
    if (!next.allowDifficultyOverride) setDifficultyMode('auto');
  }

  if (status === 'loading') {
    return (
      <div className="pr view" role="status" aria-label="Loading practice">
        <div className="pl-head-skeleton">
          <div className="h-10 w-72 max-w-full skeleton mb-2" />
          <div className="h-4 w-64 max-w-full skeleton" />
        </div>
        <div className="pr-layout">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={() => { setError(null); setStatus('loading'); setLoadNonce(n => n + 1); }} />;
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
  const approximate = Boolean(quoteMatches && quote.durationEstimated);
  const matchingQuote = quoteMatches ? quote : null;
  const firstCheck = isFirstCheck({ lead, modeId: effectiveModeId, count: quoteCount });
  const startLabel = isLaunching ? 'Starting…'
    : quoteStatus === 'loading' ? 'Checking…'
      : !quoteLaunchable ? 'Not available'
        : firstCheck ? 'Start your 10-question check'
          : `Start ${mode.label}`;
  const confirm = confirmLine({ count: quoteCount, minutes, approximate, quoteState: quoteStatus, quote: matchingQuote, isPremium });
  const access = accessSummary({ isPremium, premiumUntil: user?.premiumUntil, creditBalance: user?.creditBalance });
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : '';
  // With no subject to practise, the page's job is choosing subjects, whatever else is true.
  const headKind = lead?.kind === 'resume' ? 'resume' : mySubs.length === 0 ? 'setup' : lead?.kind === 'first' ? 'first' : 'setup';
  // A suggestion this page cannot apply (an unknown mode) is treated as already set, so no dead button shows.
  const setupMatches = !suggested || (suggested.mode === effectiveModeId && (suggested.count === null || suggested.count === quoteCount));
  const markTouched = () => setTouched(true);

  return (
    <div className="pr view">
      {!isPremium && access.balance !== null && (
        <CreditsRemainingModal open={showCreditsModal} credits={access.balance} offer={quote?.offer} onClose={() => setShowCreditsModal(false)} />
      )}

      <header className="pr-head pl-head" data-kind={headKind}>
        {headKind === 'resume' ? (
          <>
            <div>
              <h1 className="display-md">Your test is waiting</h1>
              <p>{resume.minutesLeft} {resume.minutesLeft === 1 ? 'minute' : 'minutes'} left on your {resume.label}. Your answers are saved on this device.</p>
            </div>
            <div className="pl-head__action">
              <Button asChild variant="volt" size="md"><Link href={resume.href}><AppIcon name="practice" size={18} />Resume your test</Link></Button>
            </div>
          </>
        ) : headKind === 'first' ? (
          <div>
            <h1 className="display-md">{firstName ? `${firstName}, start with a 10-question check` : 'Start with a 10-question check'}</h1>
            <p>Ten questions in one subject, marked like CUET: +5 for a right answer, −1 for a wrong one. Your result shows which mistakes to review first.</p>
          </div>
        ) : (
          <div>
            <h1 className="display-md">{firstName ? `${firstName}, what are we practising?` : 'What are we practising?'}</h1>
            <p>Every session is timed and marked like CUET: +5 for a right answer, −1 for a wrong one.</p>
          </div>
        )}
      </header>

      {lead && mySubs.length > 0 ? (
        <NextStepStrip
          strip={lead.strip}
          plan={planRead.plan}
          dominant={!lead.setupDominant}
          setupMatches={setupMatches}
          onRetry={planRead.retry}
          onApplySetup={() => {
            if (!suggested) return;
            chooseMode(suggested.mode);
            if (suggested.count) setCount(suggested.count);
          }}
        />
      ) : null}

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
        <div className="pr-layout">
          <div className="pr-steps">
            {headKind === 'resume' ? <h2 className="pl-setup-title">Or start a new session</h2> : null}
            <section className="pr-step" aria-labelledby="pr-s1">
              <div className="pr-step__head">
                <h2 id="pr-s1">Subject</h2>
                <Link href="/onboarding?edit=true" className="pr-link">Edit subjects</Link>
              </div>
              <div className="pr-subjects">
                {mySubs.map((subject) => {
                  const on = selSubj === subject.id;
                  const count = stats.subjectCounts?.[subject.internalId || subject.id];
                  return (
                    <button key={subject.id} type="button" aria-pressed={on} className="pr-tile pr-subject"
                      onClick={() => { markTouched(); setSelSubj(subject.id); setSelChapter(null); setSelectedChapters([]); setDifficultyMode('auto'); }}>
                      <span className="pr-subject__icon"><SubjectIcon id={subject.internalId || subject.id} size={20} /></span>
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

            <section className="pr-step" aria-labelledby="pr-s2">
              <div className="pr-step__head"><h2 id="pr-s2">Mode</h2><span className="pr-hint">Same checked library in every mode.</span></div>
              <div className="pr-modes">
                {MODE_LIST.map((id) => {
                  const m = TEST_MODES[id];
                  const badge = modeBadge(id);
                  const on = effectiveModeId === id;
                  return (
                    <button key={id} type="button" aria-pressed={on} className="pr-tile pr-mode" data-tone={badge.tone} onClick={() => chooseMode(id)}>
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
              </div>
            </section>

            {/* NTA Mode: the closest thing to exam day, so it gets its own row. */}
            {(() => {
              const badge = modeBadge('nta');
              const on = effectiveModeId === 'nta';
              return (
                <div className="pr-nta-wrap" data-on={on}>
                  <button type="button" aria-pressed={on} className="pr-tile pr-nta" data-tone={badge.tone} onClick={() => chooseMode('nta')}>
                    <span className="pr-nta__copy">
                      <span className="pr-mode__top">
                        <span className="pr-mode__icon"><ModeIcon id="nta" size={20} /></span>
                        <span className="pr-badge" data-tone={badge.tone}>{badge.tone === 'locked' ? <AppIcon name="lock" size={12} /> : null}{badge.text}</span>
                      </span>
                      <span className="pr-mode__name">NTA Mode</span>
                      <span className="pr-mode__spec">The closest practice to exam day. 50 questions in 60 minutes on an exam-style screen with a question palette, mark for review, clear response and a countdown that submits for you. Original practice questions, not official papers.</span>
                    </span>
                    <NtaConsolePreview subject={selectedSubject?.name || 'Accountancy'} />
                    {on ? <span className="pr-tile__tick" aria-hidden="true"><StatusIcon kind="check" size={14} /></span> : null}
                  </button>
                  {on ? (
                    <div className="pr-nta__screen">
                      {isPremium ? (
                        <>
                          <span className="pr-fine__label">Exam screen</span>
                          <Segmented label="Exam screen" value={ntaScreen} onChange={setNtaScreen}
                            options={[{ value: 'mockmob', label: 'MockMob style' }, { value: 'nta', label: 'NTA style' }]} />
                          <span className="pr-hint">Same questions, timing and scoring. You can switch inside the test.</span>
                        </>
                      ) : (
                        <p className="pr-hint">NTA Mode needs Pro. See how both screens look first: <Link href="/#exam-experience" className="pr-link">Free exam-screen preview</Link></p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <section className="pr-step" aria-labelledby="pr-s3">
              <div className="pr-step__head"><h2 id="pr-s3">Questions</h2><span className="pr-hint">{mode.fixedCount ? 'Fixed for this mode' : `${approximate ? 'About ' : ''}${minutes} minutes`}</span></div>
              {mode.fixedCount ? (
                <p className="pr-fixed"><b>{mode.fixedCount} questions</b><span>{minutes} minutes, one sitting, exam timing</span></p>
              ) : (
                <Segmented label="Number of questions" value={count} options={(mode.countOptions || [5, 10, 15, 20]).map((n) => ({ value: n, label: String(n) }))} onChange={(n) => { markTouched(); setCount(n); }} />
              )}
            </section>

            <details className="pr-step pr-fine" open={chapterOpen || difficultyMode !== 'auto' || selectedChapters.length > 0} onToggle={(event) => setChapterOpen(event.currentTarget.open)}>
              <summary>
                <span>Fine-tune</span>
                <span className="pr-hint">{fineTuneHint(difficultyMode, selectedChapters.length)}</span>
                <AppIcon name="expand" size={16} className="pr-fine__chev" />
              </summary>
              {mode.allowDifficultyOverride && (
                <div className="pr-fine__block">
                  <div className="pr-fine__label">Difficulty {!isPremium ? <span className="pr-badge" data-tone="locked"><AppIcon name="lock" size={12} />Needs access</span> : null}</div>
                  <Segmented label="Difficulty" value={difficultyMode} disabledValues={isPremium ? [] : ['easy', 'medium', 'hard']}
                    options={['auto', 'easy', 'medium', 'hard'].map((d) => ({ value: d, label: d === 'auto' ? 'Balanced' : d[0].toUpperCase() + d.slice(1) }))} onChange={(d) => { markTouched(); setDifficultyMode(d); }} />
                </div>
              )}
              {chapters.length > 0 && (
                <div className="pr-fine__block">
                  <div className="pr-fine__label">Chapters</div>
                  <label className="sr-only" htmlFor="pr-chapter-search">Search chapters</label>
                  <input id="pr-chapter-search" className="input" value={chapterSearch} onChange={(event) => setChapterSearch(event.target.value)} placeholder="Search chapters" />
                  <div className="pr-chapters">
                    <button type="button" aria-pressed={selectedChapters.length === 0} onClick={() => { markTouched(); setSelChapter(null); setSelectedChapters([]); }}>All chapters</button>
                    {filteredChapters.map((chapter) => (
                      <button key={chapter.id || chapter.name} type="button" aria-pressed={selectedChapters.includes(chapter.name)} title={chapter.name} onClick={() => { markTouched(); togglePremiumChapter(chapter.name); }}>{chapter.name}</button>
                    ))}
                    {filteredChapters.length === 0 && <p className="pr-hint">No chapter matches that search.</p>}
                  </div>
                </div>
              )}
            </details>
          </div>

          <aside className="pr-summary pl-summary" aria-label="Session summary">
            <h2>{headKind === 'resume' ? 'A new session' : firstCheck ? 'Your first check' : 'Your session'}</h2>
            <dl>
              <div><dt>Subject</dt><dd>{selectedSubject?.name || 'Not chosen'}</dd></div>
              <div><dt>Mode</dt><dd>{mode.label}</dd></div>
              <div><dt>Questions</dt><dd>{quoteCount}</dd></div>
              <div><dt>Time</dt><dd>{approximate ? 'About ' : ''}{minutes} min</dd></div>
              <div><dt>Marking</dt><dd>+5 right, −1 wrong</dd></div>
              <div data-emph="true"><dt>Cost</dt><dd>{costValue({ quoteState: quoteStatus, quote: matchingQuote, isPremium })}</dd></div>
              {!isPremium ? <div><dt>Your credits</dt><dd>{access.balance === null ? 'Not available' : access.balance.toLocaleString('en-IN')}</dd></div> : null}
            </dl>
            <p className="pl-confirm" aria-live="polite">{confirm}</p>
            <Button variant={lead?.setupDominant === false ? 'outline' : 'volt'} size="md" className="pr-summary__cta" disabled={isLaunching || !quoteLaunchable}
              onClick={() => {
                if (isLaunching || launchingKeyRef.current || !quoteLaunchable) return;
                if (Date.parse(quote.expiresAt) <= Date.now()) { setQuoteNonce((n) => n + 1); return; }
                setCreditError(null);
                setIsLaunching(true);
                launchingKeyRef.current = launchingKeyRef.current || quote.idempotencyToken;
                setLaunchSuccess(`Starting ${mode.label}…`);
                const tonight = new URLSearchParams();
                for (const name of ['tonightKey','tonightMinutes']) if (searchParams.get(name)) tonight.set(name,searchParams.get(name));
                router.push(`${launchHref}&generationKey=${encodeURIComponent(launchingKeyRef.current)}${tonight.size ? `&${tonight}` : ''}`);
              }}>
              <AppIcon name="practice" size={18} />{startLabel}
            </Button>
            <p className="pr-summary__reason" role="status" aria-live="polite">
              {quoteStatus === 'loading' && 'Checking access, credits and questions…'}
              {quoteStatus === 'error' && <>Could not check this session. Nothing was charged. <button type="button" onClick={() => setQuoteNonce((n) => n + 1)}>Check again</button></>}
              {quoteStatus === 'ready' && quoteMatches && quote.reason}
              {quoteStatus === 'ready' && quoteMatches && !quote.launchable && quote.upgradeHref && (
                <> <Link href={quote.upgradeHref}>{quote.reasonCode === 'access_required' ? 'See Pro' : 'See options'}</Link></>
              )}
            </p>
          </aside>
        </div>
      )}

      <div className="pr-lower pl-lower">
        <section className="pr-panel" aria-labelledby="pr-recent">
          <div className="pr-panel__head"><h2 id="pr-recent">Recent sessions</h2>{attempts.length > 0 && <Link href="/review" className="pr-link">Review mistakes</Link>}</div>
          {attempts.length === 0 ? (
            <p className="pr-empty">Your sessions appear here after you submit your first one.</p>
          ) : (
            <ul className="pr-recent">
              {attempts.slice(0, 5).map((attempt) => {
                const subject = subjects.find((entry) => entry.id === attempt.subject);
                const tone = attempt.score >= 70 ? 'good' : attempt.score >= 40 ? 'mid' : 'low';
                const tally = sessionTally(attempt);
                const day = Number.isFinite(Date.parse(attempt.completedAt)) ? new Date(attempt.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
                return (
                  <li key={attempt.id}>
                    <Link href={`/result/${attempt.id}`}>
                      <span className="pr-recent__icon"><SubjectIcon id={subject?.internalId || attempt.subject} size={18} /></span>
                      <span className="pr-recent__text"><b>{subject?.name || attempt.subject}</b><i>{[day, tally].filter(Boolean).join(', ')}</i></span>
                      <span className="pr-recent__score" data-tone={tone}>{attempt.score}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="pr-panel" aria-labelledby="pr-access" data-plan={access.plan}>
          <div className="pr-panel__head"><h2 id="pr-access">{access.title}</h2></div>
          <p className="pl-access__status">{access.status}</p>
          <p className="pr-panel__lead">{access.detail}</p>
          {access.action ? <Link className="pr-link" href={access.action.href}>{access.action.label}</Link> : null}
          {access.earn ? (
            <p className="pl-access__earn">{access.earn.line} <Link className="pr-link" href={access.earn.href}>{access.earn.label}</Link></p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

// "Optional. Balanced mix, all chapters." No middle-dot strings.
function fineTuneHint(difficultyMode, chapterCount) {
  if (difficultyMode === 'auto' && chapterCount === 0) return 'Optional. Balanced mix, all chapters.';
  const difficulty = difficultyMode === 'auto' ? 'Balanced mix' : `${difficultyMode[0].toUpperCase()}${difficultyMode.slice(1)} only`;
  const chapters = chapterCount === 0 ? 'all chapters' : `${chapterCount} ${chapterCount === 1 ? 'chapter' : 'chapters'}`;
  return `${difficulty}, ${chapters}.`;
}

const MODE_SPECS = {
  quick: '5 to 20 questions, 1 minute each',
  full: '50 questions, 60 minutes',
  smart: 'Weights chapters you have missed',
  nta: '50 questions, 60 minutes, exam console',
};

// A single-choice control: one tab stop per option, state exposed with aria-checked.
function Segmented({ label, value, options, onChange, disabledValues = [] }) {
  const enabledOptions = options.filter((option) => !disabledValues.includes(option.value));
  const tabStop = enabledOptions.find((option) => option.value === value) || enabledOptions[0];

  return (
    <div
      className="pr-seg"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        const keyDirection = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1
          : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!keyDirection && event.key !== 'Home' && event.key !== 'End') return;
        if (!enabledOptions.length) return;
        event.preventDefault();
        const currentIndex = enabledOptions.findIndex((option) => option.value === value);
        const nextIndex = event.key === 'Home' ? 0
          : event.key === 'End' ? enabledOptions.length - 1
            : (Math.max(0, currentIndex) + keyDirection + enabledOptions.length) % enabledOptions.length;
        const next = enabledOptions[nextIndex];
        event.currentTarget.querySelector(`[data-radio-value="${String(next.value)}"]`)?.focus();
        onChange(next.value);
      }}
    >
      {options.map((option) => {
        const disabled = disabledValues.includes(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            data-radio-value={String(option.value)}
            aria-checked={value === option.value}
            tabIndex={!disabled && tabStop?.value === option.value ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
