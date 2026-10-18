"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Coins,
  Lock,
  Play,
  RotateCcw,
  Share2,
  Swords,
  Timer,
  Trophy,
} from 'lucide-react';
import { RIVAL_PROFILES } from '@/services/ai-rival/rivalProfiles';
import { useAuth } from '@/components/AuthProvider';
import { CUET_MAX_SUBJECTS } from '@/lib/cuetRules.mjs';
import { creditCount, usesLine } from '@/lib/creditCopy.mjs';
import MobiReact from '@/components/brand/MobiReact';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { REVEAL_AT, REVEAL_PARTS, accuracyNote, rivalMobi } from './rivalReveal.mjs';
import './rival-reveal.css';

const VISIBLE_RIVAL_IDS = [
  'NORTH_CAMPUS_RIVAL',
  'SPEED_DEMON',
  'ACCURACY_MONSTER',
  'WEAKNESS_RIVAL',
  'SRCC_DREAM',
  'BOSS_RIVAL',
];
const PROFILE_LIST = VISIBLE_RIVAL_IDS.map((id) => ({ id, ...RIVAL_PROFILES[id] })).filter((entry) => entry.name);
const BASIC_RIVALS = new Set(['NORTH_CAMPUS_RIVAL', 'SPEED_DEMON', 'ACCURACY_MONSTER', 'COMEBACK_RIVAL']);
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function AIRivalArena() {
  const { user, refreshSession } = useAuth();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState(null);
  const [selectedRival, setSelectedRival] = useState('NORTH_CAMPUS_RIVAL');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [battle, setBattle] = useState(null);
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/usage', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) setUsage(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const rivalType = searchParams.get('rivalType');
    const subjects = searchParams.get('subjects');
    const id = window.setTimeout(() => {
      if (rivalType && RIVAL_PROFILES[rivalType]) setSelectedRival(rivalType);
      if (subjects) {
        setSelectedSubjects(subjects.split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, CUET_MAX_SUBJECTS));
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  useEffect(() => {
    if (!endsAt || result) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [endsAt, result]);

  useEffect(() => {
    if (!endsAt || result || submitting || submittedRef.current) return;
    if (Math.max(0, endsAt - now) === 0) {
      submitBattle();
    }
    // submitBattle intentionally reads the latest answer state at timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, now, result, submitting]);

  const isPaid = Boolean(usage?.isPaid ?? user?.isPremium ?? user?.subscriptionStatus === 'active');
  const selectedProfile = RIVAL_PROFILES[selectedRival] || RIVAL_PROFILES.NORTH_CAMPUS_RIVAL;
  const activeSubjects = selectedSubjects.length
    ? selectedSubjects
    : (user?.subjects?.length ? [user.subjects[0]] : []);
  const access = useMemo(
    () => getClientAccess({
      rivalId: selectedRival,
      profile: selectedProfile,
      isPaid,
      usage,
    }),
    [selectedRival, selectedProfile, isPaid, usage],
  );

  const timeLeftMs = endsAt ? Math.max(0, endsAt - now) : 0;
  const question = battle?.questions?.[currentIndex] || null;

  function toggleSubject(subject) {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) return prev.filter((entry) => entry !== subject);
      return [...prev, subject].slice(0, CUET_MAX_SUBJECTS);
    });
  }

  async function startBattle(rivalId = selectedRival) {
    const profile = RIVAL_PROFILES[rivalId];
    const locked = getClientAccess({ rivalId, profile, isPaid, usage });
    if (!locked.allowed) {
      setSelectedRival(rivalId);
      setError(lockMessage(locked));
      return;
    }
    if (!activeSubjects.length) {
      setError('Choose at least one subject from your profile before starting a benchmark.');
      return;
    }

    setStarting(true);
    setError(null);
    setResult(null);
    setBattle(null);
    submittedRef.current = false;

    try {
      const res = await fetch('/api/ai/rival/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rivalType: rivalId,
          subjects: activeSubjects,
          questionCount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(serverStartError(data));
        return;
      }
      setBattle(data.battle);
      setUsage((prev) => ({ ...(prev || {}), ...(data.usageSnapshot || {}) }));
      setCurrentIndex(0);
      setAnswers({});
      setQuestionStartedAt(Date.now());
      setEndsAt(Date.now() + (data.battle.timeLimitMinutes || 10) * 60_000);
      await refreshSession?.({ silent: true }).catch(() => {});
    } catch {
      setError('Could not start this benchmark. Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  }

  function selectAnswer(optionIndex) {
    if (!question) return;
    const elapsed = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));
    setAnswers((prev) => ({
      ...prev,
      [question.id]: { qid: question.id, selectedIndex: optionIndex, timeSeconds: elapsed },
    }));
  }

  function moveQuestion(nextIndex) {
    setCurrentIndex(Math.max(0, Math.min((battle?.questions?.length || 1) - 1, nextIndex)));
    setQuestionStartedAt(Date.now());
  }

  async function submitBattle() {
    if (!battle || submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);

    const payloadAnswers = (battle.questions || []).map((entry) => {
      const answer = answers[entry.id];
      return {
        qid: entry.id,
        selectedIndex: Number.isInteger(answer?.selectedIndex) ? answer.selectedIndex : null,
        timeSeconds: Number.isFinite(answer?.timeSeconds) ? answer.timeSeconds : 0,
      };
    });

    try {
      const res = await fetch('/api/ai/rival/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ battleId: battle.id, answers: payloadAnswers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not submit this benchmark.');
        submittedRef.current = false;
        return;
      }
      setResult(data);
      setEndsAt(null);
    } catch {
      setError('Could not submit this benchmark.');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  function resetToLobby() {
    setBattle(null);
    setResult(null);
    setError(null);
    setAnswers({});
    setEndsAt(null);
    submittedRef.current = false;
  }

  if (result && battle) {
    return (
      <RivalShell usage={usage}>
        <ResultScreen
          result={result}
          battle={battle}
          onRematch={() => startBattle(battle.rivalType)}
          onLobby={resetToLobby}
          starting={starting}
        />
      </RivalShell>
    );
  }

  if (battle && question) {
    return (
      <RivalShell usage={usage}>
        <BattleScreen
          battle={battle}
          question={question}
          index={currentIndex}
          answers={answers}
          timeLeftMs={timeLeftMs}
          onSelect={selectAnswer}
          onMove={moveQuestion}
          onSubmit={submitBattle}
          submitting={submitting}
          error={error}
        />
      </RivalShell>
    );
  }

  // The lobby (W-072, W-076, W-078): one heading, the rivals as a list to pick from (no icon tiles, no pills), the
  // setup, and one volt action. The day's recommended benchmark is the first row and the default pick, so its old
  // separate card and second Start button fold into the list and the one Start below it.
  return (
    <RivalShell usage={usage}>
      <div className="rvl">
        <header className="rvl-head">
          <h1 className="display-md">Check your pace against a practice rival.</h1>
          <p>A short timed challenge comparing pace, accuracy and skipped questions.</p>
        </header>

        {error ? <ErrorStrip message={error} /> : null}

        <section className="rvl-pick" aria-labelledby="rvl-pick-title">
          <h2 id="rvl-pick-title" className="rvl-h2">Choose a rival</h2>
          <div className="rvl-list" role="radiogroup" aria-labelledby="rvl-pick-title">
            {PROFILE_LIST.map((profile, index) => {
              const cardAccess = getClientAccess({ rivalId: profile.id, profile, isPaid, usage });
              const selected = selectedRival === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="rvl-row mk-press"
                  data-locked={cardAccess.allowed ? undefined : 'true'}
                  onClick={() => {
                    setSelectedRival(profile.id);
                    setError(cardAccess.allowed ? null : lockMessage(cardAccess));
                  }}
                >
                  <span className="rvl-row__mark" aria-hidden="true" />
                  <span className="rvl-row__main">
                    <span className="rvl-row__name">{profile.name}{index === 0 ? <span className="rvl-row__hint"> · recommended today</span> : null}</span>
                    <span className="rvl-row__desc">{profile.description}</span>
                  </span>
                  <span className="rvl-row__nums">
                    <span><b>{Math.round(profile.targetAccuracy * 100)}%</b> accuracy</span>
                    <span><b>{profile.avgTimePerQuestion} s</b> a question</span>
                  </span>
                  <span className="rvl-row__access">
                    {cardAccess.allowed ? null : <Lock size={14} aria-hidden="true" />}
                    {profile.creditCost > 0 ? creditCount(profile.creditCost, 'ai') : profile.freeAllowed ? 'Free today' : 'With Pro'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rvl-setup" aria-labelledby="rvl-setup-title">
          <h2 id="rvl-setup-title" className="rvl-h2">Set it up</h2>
          <div className="rvl-field">
            <span className="rvl-field__label" id="rvl-subjects">Subjects</span>
            <div className="rvl-chips" role="group" aria-labelledby="rvl-subjects">
              {(user?.subjects || []).length ? (
                user.subjects.map((subject) => (
                  <button key={subject} type="button" className="rvl-chip mk-press" aria-pressed={activeSubjects.includes(subject)} onClick={() => toggleSubject(subject)}>
                    {displaySubject(subject)}
                  </button>
                ))
              ) : (
                <Link href="/profile" className="rvl-chip">Add subjects in Account</Link>
              )}
            </div>
          </div>
          <div className="rvl-field">
            <span className="rvl-field__label" id="rvl-count">Questions</span>
            <div className="rvl-chips" role="group" aria-labelledby="rvl-count">
              {[5, 10, 15, 20].map((count) => (
                <button key={count} type="button" className="rvl-chip rvl-chip--num mk-press" aria-pressed={questionCount === count} onClick={() => setQuestionCount(count)}>
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="rvl-go">
            {!access.allowed ? <LockHint access={access} /> : null}
            <button
              type="button"
              data-page-primary
              onClick={() => startBattle(selectedRival)}
              disabled={!access.allowed || starting || !activeSubjects.length}
              className="btn-volt md mk-press rvl-start"
            >
              <Play size={17} aria-hidden="true" /> {starting ? 'Starting benchmark' : `Start ${selectedProfile.name}`}
            </button>
          </div>
        </section>
      </div>
    </RivalShell>
  );
}

function RivalShell({ children, usage }) {
  const wallet = usage?.aiWallet || null;
  // Unknown or paused wallets show no number; practice credits are a different ledger.
  const total = wallet?.known ? wallet.total : null;
  const free = formatFreeRival(usage);
  // Themed with the Arena's own tokens, Night and Day alike (W-078): no dark panel inside Daylight. The wallet is one
  // plain line, not a row of pills.
  return (
    <div className="rvl-shell mx-auto w-full max-w-7xl">
      <p className="rvl-wallet">
        <Coins size={14} aria-hidden="true" />
        <span>AI credits <b>{total ?? 'not available'}</b></span>
        <span aria-hidden="true">·</span>
        <span>Free benchmarks today <b>{free === '—' ? 'not available' : free}</b></span>
      </p>
      {children}
    </div>
  );
}

function BattleScreen({ battle, question, index, answers, timeLeftMs, onSelect, onMove, onSubmit, submitting, error }) {
  const selected = answers[question.id]?.selectedIndex;
  const answeredCount = Object.values(answers).filter((entry) => Number.isInteger(entry?.selectedIndex)).length;
  const total = battle.questions.length;

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="text-sm font-semibold text-zinc-400">{battle.profile.name}</div>
          <h1 className="mt-2 font-display text-3xl font-black text-zinc-50">{battle.intro?.tagline || battle.profile.archetype}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{battle.intro?.introLine || battle.profile.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric icon={<Timer size={15} />} label="Time" value={formatTime(timeLeftMs)} />
          <Metric icon={<Swords size={15} />} label="Answered" value={`${answeredCount}/${total}`} />
          <Metric icon={<Trophy size={15} />} label="Benchmark" value={battle.rivalBenchmark.score} />
        </div>
      </header>

      {error ? <ErrorStrip message={error} /> : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-zinc-500">
            Question {index + 1} of {total} / {displaySubject(question.subject)}
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            {question.chapter || question.difficulty || 'CUET'}
          </span>
        </div>

        <h2 className="max-w-4xl text-lg font-bold leading-7 text-zinc-50">{question.question}</h2>

        <div className="mt-5 grid gap-3">
          {(question.options || []).map((option, optionIndex) => (
            <button
              key={`${question.id}_${optionIndex}`}
              type="button"
              aria-pressed={selected === optionIndex}
              onClick={() => onSelect(optionIndex)}
              className={`flex min-h-14 items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                selected === optionIndex
                  ? 'border-volt/60 bg-volt/10 text-zinc-50'
                  : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20'
              }`}
            >
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-black ${
                selected === optionIndex ? 'bg-volt text-black' : 'bg-white/[0.06] text-zinc-400'
              }`}>
                {LETTERS[optionIndex] || optionIndex + 1}
              </span>
              <span className="pt-1 text-sm leading-6">{String(option)}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold text-zinc-300 disabled:opacity-35"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex gap-2">
            {index < total - 1 ? (
              <button
                type="button"
                onClick={() => onMove(index + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-zinc-100"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-volt px-5 font-display text-sm font-black text-black disabled:opacity-40"
            >
              {submitting ? 'Scoring' : 'Submit benchmark'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultScreen({ result, battle, onRematch, onLobby, starting }) {
  const [copied, setCopied] = useState(false);
  const won = result.result === 'win';
  const tied = result.result === 'tie';
  const title = won ? 'You cleared the benchmark.' : tied ? 'You tied the benchmark.' : 'The benchmark found a gap.';
  const share = result.shareCard || {};
  const shareText = `${share.headline || title} Score ${share.score ?? result.user.score} vs ${share.rivalScore ?? result.rival.score} against ${battle.profile.name}. Next move: ${result.outro?.nextMove || result.nextMoveHint || 'review the gap this benchmark found.'}`;

  // The reveal: the score, then the comparison, then Mobi's reaction, then the next move
  // (rivalReveal.mjs). A tap or a key lands everything at once; Reduce motion draws it in place.
  const prefs = useMobiPrefs();
  const reaction = rivalMobi(result.result, { celebrations: prefs.celebrations });
  const [stage, setStage] = useState(0);
  const [mobiDone, setMobiDone] = useState(false);
  const wide = useWide();
  const rootRef = useRef(null);
  // The score is the first thing seen: a submit tapped low on a phone would otherwise leave the
  // result scrolled past its own headline, or tucked under the sticky top bar. Instant, before the
  // first part lands; .rv-root's scroll-margin-top (76px) lands the headline below the bar.
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    if (node.getBoundingClientRect().top < margin) node.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    if (prefs.reduced) {
      const id = window.requestAnimationFrame(() => setStage(REVEAL_PARTS.length));
      return () => window.cancelAnimationFrame(id);
    }
    const timers = [];
    // The first part waits one frame so its entering state is painted and the score lands.
    const frame = window.requestAnimationFrame(() => {
      REVEAL_PARTS.forEach((part, index) => {
        timers.push(window.setTimeout(() => setStage((current) => Math.max(current, index + 1)), REVEAL_AT[part]));
      });
    });
    const landAll = () => {
      timers.forEach((id) => window.clearTimeout(id));
      setStage(REVEAL_PARTS.length);
    };
    window.addEventListener('pointerdown', landAll, { once: true });
    window.addEventListener('keydown', landAll, { once: true });
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('pointerdown', landAll);
      window.removeEventListener('keydown', landAll);
    };
  }, [prefs.reduced]);
  const shown = (part) => stage > REVEAL_PARTS.indexOf(part);
  const partProps = (part, extra = {}) => ({ 'data-in': shown(part) ? 'true' : 'false', inert: shown(part) ? undefined : true, ...extra });
  // After his one act he stands still beside the next move: no idle loop. Under Reduce motion he
  // keeps the act's still frame. Under Celebrations Off he stands still from the start.
  const mobiAct = reaction && (mobiDone && !prefs.reduced ? 'idle' : reaction.act);
  const mobiStill = Boolean(reaction) && ((mobiDone && !prefs.reduced) || reaction.act === 'idle');
  const accuracyLine = accuracyNote(result.user);

  return (
    <div ref={rootRef} className="rv-root grid gap-6" data-reveal-stage={stage}>
      <header className="rv-part rv-score grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center" {...partProps('score')}>
        <div>
          <h1 className="font-display text-[clamp(30px,5vw,56px)] font-black leading-[1.02] text-zinc-50">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            {result.outro?.summary || `${share.headline || 'Shadow Benchmark complete'}.`}
          </p>
        </div>
        <div className="rounded-2xl border border-volt/25 bg-volt/10 p-5 text-center">
          <div className="text-[13px] font-semibold text-zinc-300">{share.rankTitle || 'Your result'}</div>
          <div className="rv-scoreline mt-2 font-display text-4xl font-black text-zinc-50" role="img" aria-label={`You ${result.user.score}, ${battle.profile.name} ${result.rival.score}`}>
            {result.user.score}<span className="px-1 text-zinc-500" aria-hidden="true">–</span>{result.rival.score}
          </div>
          <div className="mt-1 text-xs font-semibold text-zinc-400">You against {battle.profile.name}</div>
        </div>
      </header>

      <section className="rv-compare" aria-label="How you compare" data-in={shown('comparison') ? 'true' : 'false'}>
        <ResultStat part={partProps('comparison', { style: { '--i': 0 } })} label="Your accuracy" value={`${result.user.accuracy}%`} note={accuracyLine} />
        <ResultStat part={partProps('comparison', { style: { '--i': 1 } })} label="Benchmark accuracy" value={`${result.rival.accuracy}%`} note={`${battle.profile.name}, a simulated benchmark`} />
        <ResultStat part={partProps('comparison', { style: { '--i': 2 } })} label="Your time" value={formatSeconds(result.user.totalTimeSeconds)} note={Number.isFinite(result.rival.totalTimeSeconds) ? `Benchmark ${formatSeconds(result.rival.totalTimeSeconds)}` : null} />
      </section>

      <section className={`rv-part grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${reaction ? 'grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto]' : 'lg:grid-cols-[1fr_auto]'} items-center`} {...partProps('mobi')}>
        {reaction ? (
          <div className="rv-mobi">
            {/* Mounted when his part lands, so the act starts on the moment. His light follows the page's theme. */}
            {shown('mobi') ? (
              <MobiReact
                act={mobiAct}
                still={mobiStill}
                mood={reaction.mood}
                size={wide ? 106 : 86}
                label={reaction.label}
                onDone={() => setMobiDone(true)}
              />
            ) : null}
          </div>
        ) : null}
        <div className="rv-part" {...partProps('next')}>
          <h2 className="text-[13px] font-semibold text-volt">Next move</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{result.outro?.nextMove || result.nextMoveHint}</p>
        </div>
        <div className={`rv-part flex flex-wrap gap-2 ${reaction ? 'col-span-2 lg:col-span-1' : ''}`} {...partProps('next', { style: { '--i': 1 } })}>
          <button
            type="button"
            onClick={onRematch}
            disabled={starting}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-volt px-5 font-display text-sm font-black text-black disabled:opacity-40"
          >
            <RotateCcw size={16} /> Retry
          </button>
          <button
            type="button"
            onClick={onLobby}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold text-zinc-300"
          >
            <Swords size={16} /> Setup
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } catch {
                setCopied(false);
              }
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold text-zinc-300"
          >
            <Share2 size={16} /> {copied ? 'Copied' : 'Copy share text'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ResultStat({ part, label, value, note }) {
  return (
    <div className="rv-part rv-stat" {...part}>
      <div className="rv-stat__label">{label}</div>
      <div className="rv-stat__value font-display font-black text-zinc-50">{value}</div>
      {note ? <div className="rv-stat__note">{note}</div> : null}
    </div>
  );
}

// Mobi is drawn a size up on wide screens; the box he stands in is reserved at both sizes.
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

function LockHint({ access }) {
  const href = access.kind === 'credits' || access.kind === 'paused' ? '/wallet' : '/pricing?reason=benchmark';
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-xl border border-red-400/25 bg-red-400/[0.08] px-3 py-2 text-xs font-bold leading-5 text-red-100 no-underline">
      {lockMessage(access)}
    </Link>
  );
}

function ErrorStrip({ message }) {
  return (
    <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm font-semibold text-red-100">
      {message}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-black text-zinc-50">{value}</div>
    </div>
  );
}

function getClientAccess({ rivalId, profile, isPaid, usage }) {
  if (!profile) return { allowed: false, kind: 'unknown' };
  if (BASIC_RIVALS.has(rivalId)) {
    if (isPaid) return { allowed: true, kind: 'included' };
    if (rivalId !== 'NORTH_CAMPUS_RIVAL') return { allowed: false, kind: 'plan' };
    const remaining = usage?.remaining?.basicRivalBattles;
    if (remaining === undefined || remaining === null || remaining === 'unlimited' || remaining > 0) {
      return { allowed: true, kind: 'free_daily' };
    }
    return { allowed: false, kind: 'daily_used' };
  }

  if (!isPaid) return { allowed: false, kind: 'plan' };
  const wallet = usage?.aiWallet;
  if (!wallet?.spendable) return { allowed: false, kind: wallet?.state === 'empty' ? 'credits' : 'paused', required: profile.creditCost || 1, balance: wallet?.known ? wallet.total : null };
  const available = Number(wallet.total);
  if (available >= (profile.creditCost || 1)) return { allowed: true, kind: 'credits' };
  return { allowed: false, kind: 'credits', required: profile.creditCost || 1, balance: available };
}

function lockMessage(access) {
  if (access.kind === 'daily_used') return 'Today’s free benchmark is used. Pro adds more.';
  if (access.kind === 'paused') return 'AI features are paused for now. Your AI credits have not been used.';
  if (access.kind === 'credits') return usesLine({ what: 'This benchmark', cost: access.required || 1, pool: 'ai', balance: access.balance ?? null });
  if (access.kind === 'plan') return 'This benchmark needs Pro.';
  return 'Benchmark unavailable.';
}

function serverStartError(data) {
  if (data?.message) return data.message;
  if (data?.planRequired) return 'This benchmark needs Pro.';
  if (data?.error === 'free_daily_rival_used') return 'Today’s free benchmark is used. Pro adds more.';
  if (data?.error === 'insufficient_credits') return usesLine({ what: 'This benchmark', cost: data.required || 1, pool: 'ai', balance: data.balance ?? null });
  if (data?.error === 'no_subjects_configured') return 'Add subjects in Profile before starting a benchmark.';
  if (data?.error === 'no_questions_available') return 'No complete question set is available for this benchmark. Try another subject or a shorter mock.';
  if (data?.error === 'battle_insert_failed') {
    return 'Could not start this benchmark. Try the daily benchmark or refresh.';
  }
  return 'Could not start this benchmark. Try the daily benchmark or refresh.';
}

function formatFreeRival(usage) {
  const value = usage?.remaining?.basicRivalBattles;
  if (value === 'unlimited' || value === Infinity) return 'unlimited';
  if (value === undefined || value === null) return '—';
  return value;
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatSeconds(seconds) {
  return formatTime((seconds || 0) * 1000);
}

function displaySubject(subject) {
  return String(subject || 'Subject')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
