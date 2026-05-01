"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Zap,
} from 'lucide-react';
import { RIVAL_PROFILES } from '@/services/ai-rival/rivalProfiles';
import { useAuth } from '@/components/AuthProvider';

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
        setSelectedSubjects(subjects.split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 5));
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
      return [...prev, subject].slice(0, 5);
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

  return (
    <RivalShell usage={usage}>
      <div className="grid gap-6">
        <header className="grid gap-5 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <div className="mono-label text-volt">MockMob / Shadow Benchmark</div>
            <h1 className="mt-2 max-w-3xl font-display text-[clamp(30px,5vw,58px)] font-black leading-[1.01] text-zinc-50">
              Pressure checks that explain the leak.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Shadow Benchmark is not another mock. It is a short timed challenge that tells you whether today&apos;s leak is speed, accuracy, skips, or pressure.
            </p>
          </div>
          <DailyChallenge profile={selectedProfile} onStart={() => startBattle(selectedRival)} disabled={!access.allowed || starting} />
        </header>

        {error ? <ErrorStrip message={error} /> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PROFILE_LIST.map((profile) => {
            const cardAccess = getClientAccess({ rivalId: profile.id, profile, isPaid, usage });
            const selected = selectedRival === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setSelectedRival(profile.id);
                  setError(cardAccess.allowed ? null : lockMessage(cardAccess));
                }}
                className="group min-h-[230px] rounded-2xl border bg-white/[0.03] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.045]"
                style={{
                  borderColor: selected ? `${profile.accent}88` : 'rgba(255,255,255,0.1)',
                  boxShadow: selected ? `0 0 0 1px ${profile.accent}44, 0 18px 60px rgba(0,0,0,0.28)` : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                    style={{ color: profile.accent, borderColor: `${profile.accent}55`, background: `${profile.accent}12` }}
                  >
                    {cardAccess.allowed ? <Swords size={18} /> : <Lock size={18} />}
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                    {profile.creditCost > 0 ? `${profile.creditCost} AI cr` : profile.freeAllowed ? 'free daily' : 'paid basic'}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl font-black text-zinc-50">{profile.name}</h2>
                <p className="mt-2 min-h-[60px] text-xs leading-5 text-zinc-400">{profile.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <MiniStat label="Accuracy" value={`${Math.round(profile.targetAccuracy * 100)}%`} />
                  <MiniStat label="Pace" value={`${profile.avgTimePerQuestion}s`} />
                </div>
                <div className="mt-3 text-[11px] font-semibold text-zinc-500">
                  Strength: <span className="text-zinc-300">{profile.strength}</span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mono-label text-volt">Benchmark setup</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(user?.subjects || []).length ? (
                user.subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                      activeSubjects.includes(subject)
                        ? 'border-volt/40 bg-volt/10 text-volt'
                        : 'border-white/10 bg-black/20 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {displaySubject(subject)}
                  </button>
                ))
              ) : (
                <Link href="/profile" className="text-sm font-bold text-volt no-underline">Add subjects in Profile</Link>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Questions</span>
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`h-9 rounded-full border px-4 text-xs font-black ${
                    questionCount === count ? 'border-volt bg-volt text-black' : 'border-white/10 text-zinc-400'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:min-w-[260px]">
            {!access.allowed ? <LockHint access={access} /> : null}
            <button
              type="button"
              onClick={() => startBattle(selectedRival)}
              disabled={!access.allowed || starting || !activeSubjects.length}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-volt px-6 font-display text-sm font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play size={17} /> {starting ? 'Starting benchmark' : `Start ${selectedProfile.name}`}
            </button>
          </div>
        </section>
      </div>
    </RivalShell>
  );
}

function RivalShell({ children, usage }) {
  const wallet = usage?.aiWallet || null;
  const total = usage?.aiCreditBalance ?? wallet?.total ?? usage?.creditBalance ?? '--';
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,16,0.96),rgba(7,8,7,0.96))] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.45)] md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/10 px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-volt">
            <Zap size={13} /> Daily pressure loop
          </div>
          <div className="flex flex-wrap gap-2">
            <UsagePill label="AI Credits" value={total} />
            <UsagePill label="Free daily" value={formatFreeRival(usage)} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function BattleScreen({ battle, question, index, answers, timeLeftMs, onSelect, onMove, onSubmit, submitting, error }) {
  const selected = answers[question.id]?.selectedIndex;
  const answeredCount = Object.values(answers).filter((entry) => Number.isInteger(entry?.selectedIndex)).length;
  const total = battle.questions.length;

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mono-label text-volt">{battle.profile.name}</div>
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
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Question {index + 1} of {total} / {displaySubject(question.subject)}
          </div>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
            {question.chapter || question.difficulty || 'CUET'}
          </span>
        </div>

        <h2 className="max-w-4xl text-lg font-bold leading-7 text-zinc-50">{question.question}</h2>

        <div className="mt-5 grid gap-3">
          {(question.options || []).map((option, optionIndex) => (
            <button
              key={`${question.id}_${optionIndex}`}
              type="button"
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
  const won = result.result === 'win';
  const tied = result.result === 'tie';
  const title = won ? 'You cleared the benchmark.' : tied ? 'Dead heat.' : 'The benchmark exposed a leak.';
  const share = result.shareCard || {};

  return (
    <div className="grid gap-6">
      <header className="grid gap-5 rounded-2xl border border-white/10 bg-black/25 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mono-label text-volt">Benchmark result</div>
          <h1 className="mt-2 font-display text-[clamp(30px,5vw,56px)] font-black leading-[1.02] text-zinc-50">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            {result.outro?.summary || `${share.headline || 'Shadow Benchmark complete'}.`}
          </p>
        </div>
        <div className="rounded-2xl border border-volt/25 bg-volt/10 p-5 text-center">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-volt">{share.rankTitle || 'Rival card'}</div>
          <div className="mt-2 font-display text-4xl font-black text-zinc-50">{result.user.score}-{result.rival.score}</div>
          <div className="mt-1 text-xs font-semibold text-zinc-400">{battle.profile.name}</div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Your accuracy" value={`${result.user.accuracy}%`} icon={<Trophy size={15} />} />
        <Metric label="Benchmark accuracy" value={`${result.rival.accuracy}%`} icon={<Swords size={15} />} />
        <Metric label="Your time" value={formatSeconds(result.user.totalTimeSeconds)} icon={<Timer size={15} />} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mono-label text-volt">Next move</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{result.outro?.nextMove || result.nextMoveHint}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Share-card data is ready: {share.headline || 'Shadow Benchmark result'} with score {share.score ?? result.user.score} vs {share.rivalScore ?? result.rival.score}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold text-zinc-300"
          >
            <Share2 size={16} /> Share data
          </button>
        </div>
      </section>
    </div>
  );
}

function DailyChallenge({ profile, onStart, disabled }) {
  return (
    <div className="rounded-2xl border border-volt/20 bg-volt/[0.065] p-4">
      <div className="mono-label text-volt">Recommended benchmark today</div>
      <h2 className="mt-2 font-display text-2xl font-black text-zinc-50">{profile.name}</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{profile.description}</p>
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-volt px-5 font-display text-xs font-black text-black disabled:opacity-40"
      >
        <Play size={15} /> Start challenge
      </button>
    </div>
  );
}

function LockHint({ access }) {
  const href = access.kind === 'credits' ? '/pricing?reason=ai_credits' : '/pricing?reason=benchmark';
  return (
    <Link href={href} className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-3 py-2 text-xs font-bold leading-5 text-red-100 no-underline">
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

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      <div className="mt-1 font-display text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-black text-zinc-50">{value}</div>
    </div>
  );
}

function UsagePill({ label, value }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">
      <Coins size={12} /> {label}: <span className="text-volt">{value}</span>
    </span>
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
  const available = Number(usage?.aiCreditBalance ?? usage?.aiWallet?.total ?? usage?.creditBalance ?? 0);
  if (available >= (profile.creditCost || 1)) return { allowed: true, kind: 'credits' };
  return { allowed: false, kind: 'credits', required: profile.creditCost || 1, balance: available };
}

function lockMessage(access) {
  if (access.kind === 'daily_used') return 'Free Daily Benchmark is used for today. Upgrade for more pressure checks.';
  if (access.kind === 'credits') return `Need ${access.required || 1} AI credit(s) for this benchmark.`;
  if (access.kind === 'plan') return 'This benchmark is Premium.';
  return 'Benchmark unavailable.';
}

function serverStartError(data) {
  if (data?.message) return data.message;
  if (data?.planRequired) return 'This benchmark is Premium. Upgrade to unlock it.';
  if (data?.error === 'free_daily_rival_used') return 'Free Daily Benchmark is used for today. Upgrade for more pressure checks.';
  if (data?.error === 'insufficient_credits') return `Need ${data.required || 1} AI credit(s). Current balance: ${data.balance || 0}.`;
  if (data?.error === 'no_subjects_configured') return 'Add subjects in Profile before starting a benchmark.';
  if (data?.error === 'no_questions_available') return 'No complete question set is available for this benchmark. Try another subject or a shorter diagnostic mock.';
  if (data?.error === 'battle_insert_failed') {
    return "Couldn't start this benchmark. Try Daily Benchmark or refresh.";
  }
  return 'Could not start this benchmark. Try Daily Benchmark or refresh.';
}

function formatFreeRival(usage) {
  const value = usage?.remaining?.basicRivalBattles;
  if (value === 'unlimited' || value === Infinity) return 'unlimited';
  if (value === undefined || value === null) return '--';
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
