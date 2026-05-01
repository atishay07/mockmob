"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import {
  BENCHMARK_OPTIONS,
  CREDIT_PACKS,
  FEATURE_GUIDE,
  PREPOS_SECTIONS,
  buildMistakeReplayPlan,
  buildTodayMission,
  deterministicReplyFor,
  pageHelpForPath,
} from './assistantKnowledge';

const QUICK_PROMPTS = [
  'What should I do today?',
  'Explain this page',
  'What is Shadow Benchmark?',
  'What is Mistake Replay?',
];

export default function MockMobAssistant({
  variant = 'drawer',
  initialTab = 'mission',
  onClose,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useAuth();
  const [activeSection, setActiveSection] = useState(normalizeSection(initialTab));
  const [usage, setUsage] = useState(null);
  const [studentContext, setStudentContext] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState('NORTH_CAMPUS_RIVAL');
  const [creditNotice, setCreditNotice] = useState(null);
  const transcriptRef = useRef(null);

  const isDrawer = variant === 'drawer';
  const isAuthenticated = Boolean(user?.id);
  const isPaid = Boolean(usage?.isPaid ?? user?.isPremium ?? user?.subscriptionStatus === 'active');
  const wallet = usage?.aiWallet || usage?.wallet || null;
  const aiTotal = usage?.aiCreditBalance ?? wallet?.total ?? 0;
  const currentPage = useMemo(() => pageHelpForPath(pathname), [pathname]);
  const mission = useMemo(
    () => buildTodayMission({ context: studentContext, user, pathname }),
    [studentContext, user, pathname],
  );
  const replay = useMemo(() => buildMistakeReplayPlan(studentContext), [studentContext]);

  async function loadHistory() {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/ai/mentor/history', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setUsage(data.usageSnapshot || null);
        setSessionId(data.session?.id || null);
        setMessages(normalizeHistory(data.messages || []));
        return;
      }
      await loadCredits();
    } catch {
      await loadCredits();
    }
  }

  async function loadCredits() {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setUsage({
          isPaid: data.isPaid,
          tier: data.tier,
          aiWallet: data.wallet,
          aiCreditBalance: data.wallet?.total ?? 0,
          creditCosts: data.creditCosts,
          normalCreditBalance: data.normalCreditBalance,
        });
      }
    } catch {
      setError('PrepOS account data is temporarily unavailable.');
    }
  }

  async function loadContext() {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/ai/context', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setStudentContext(data.context);
    } catch {
      // Review and mission cards both degrade cleanly.
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      const clearTimer = window.setTimeout(() => {
        if (cancelled) return;
        setUsage(null);
        setStudentContext(null);
        setSessionId(null);
        setMessages([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(clearTimer);
      };
    }
    const timer = window.setTimeout(() => {
      Promise.allSettled([loadHistory(), loadContext()])
        .finally(() => {
          if (!cancelled) setError(null);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, pending, activeSection]);

  async function sendMessage(text = input, mode = 'mentor') {
    const finalText = String(text || '').trim();
    if (!finalText || pending) return;

    setInput('');
    setError(null);
    appendUser(finalText);

    const deterministic = deterministicReplyFor({
      text: finalText,
      pathname,
      context: studentContext,
      user,
    });
    if (deterministic) {
      appendAssistant(deterministic);
      persistLocalExchange(finalText, deterministic);
      return;
    }

    if (!isAuthenticated) {
      appendAssistant({
        reply: 'I can guide you around MockMob now. Personal missions need an account because they depend on your mocks, subjects, saved questions, and Radar history.',
        confidence: 100,
        reason: 'Public PrepOS never pretends to know private prep data.',
        actions: [
          { label: 'Create account', type: 'navigate', route: '/signup?source=prepos' },
          { label: 'View plans', type: 'navigate', route: '/pricing?source=prepos' },
        ],
      });
      return;
    }

    if (!isPaid) {
      appendAssistant({
        reply: 'Your free account gets site guidance, basic missions, and one Daily Benchmark. Personalized PrepOS coaching unlocks with Premium.',
        confidence: 100,
        reason: 'This keeps paid AI usage controlled without weakening the free guide.',
        actions: [
          { label: 'Start Daily Benchmark', type: 'benchmark', rivalType: 'NORTH_CAMPUS_RIVAL' },
          { label: 'View Premium', type: 'navigate', route: '/pricing?reason=prepos' },
        ],
      });
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ai/mentor/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: finalText, mode, sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      const response = data.response || data;
      if (!res.ok) {
        appendAssistant(response?.reply ? response : {
          reply: data.message || 'PrepOS could not complete this request.',
          confidence: 0,
          reason: 'The server blocked or failed the action safely.',
          actions: data.error?.includes('credit') || res.status === 402
            ? [{ label: 'View credit options', type: 'section', section: 'guide' }]
            : [],
        });
        return;
      }
      appendAssistant(normalizeModelResponse(response));
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.usageSnapshot) setUsage((prev) => ({ ...(prev || {}), ...data.usageSnapshot }));
    } catch {
      appendAssistant({
        reply: 'Network failed before PrepOS could answer. The guide and mission shortcuts still work.',
        confidence: 0,
        reason: 'No data was changed.',
        actions: [{ label: 'Explain this page', type: 'ask', prompt: 'Explain this page' }],
      });
    } finally {
      setPending(false);
    }
  }

  function appendUser(text) {
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text }]);
  }

  function appendAssistant(response) {
    setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response }]);
  }

  async function persistLocalExchange(message, response) {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/ai/mentor/local', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, message, response, mode: 'guide' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sessionId) setSessionId(data.sessionId);
    } catch {
      // Instant guide answers should never be blocked by persistence.
    }
  }

  async function newSession() {
    if (!isAuthenticated) {
      setMessages([]);
      setActiveSection('mission');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/ai/mentor/session/new', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'New PrepOS session' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || 'session_failed');
      setSessionId(data.session?.id || null);
      setMessages([]);
      setActiveSection('mission');
    } catch {
      setError('Could not start a new PrepOS session.');
    }
  }

  function runAction(action) {
    if (!action) return;

    if (action.type === 'ask' && action.prompt) {
      sendMessage(action.prompt);
      return;
    }
    if (action.type === 'section' || action.type === 'tab') {
      setActiveSection(normalizeSection(action.section || action.tab));
      return;
    }
    if (action.type === 'benchmark' || action.action === 'launch_ai_rival') {
      setSelectedBenchmark(action.rivalType || action.params?.rivalType || 'NORTH_CAMPUS_RIVAL');
      setActiveSection('benchmark');
      return;
    }
    if (action.action === 'buy_credits' || action.type === 'credits') {
      setActiveSection('guide');
      setCreditNotice('AI credit packs are prepared but checkout is not wired yet. Pricing opens the current Premium flow.');
      return;
    }
    if (action.action === 'show_mock_autopsy') {
      sendMessage('Analyze my last mock.', 'autopsy');
      return;
    }
    if (action.action === 'create_trap_drill' || action.action === 'create_mistake_replay') {
      setActiveSection('replay');
      return;
    }
    if (action.action === 'create_next_mock') {
      router.push('/dashboard?source=prepos');
      onClose?.();
      return;
    }

    const route = action.route || action.target || routeForModelAction(action);
    if (route) {
      router.push(route);
      onClose?.();
    }
  }

  function openBenchmark(rivalId) {
    router.push(`/rival?rivalType=${encodeURIComponent(rivalId)}`);
    onClose?.();
  }

  function openCreditPack(pack) {
    setCreditNotice(`${pack.name} is planned, but pack checkout is not wired yet. Use Premium pricing for now.`);
  }

  const shellClass = isDrawer
    ? 'flex h-full min-h-0 flex-col bg-[#090a08] text-zinc-100'
    : 'mx-auto flex min-h-[760px] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#090a08] text-zinc-100 shadow-[0_28px_100px_rgba(0,0,0,0.38)]';

  return (
    <div className={shellClass}>
      <AssistantHeader
        isDrawer={isDrawer}
        isAuthenticated={isAuthenticated}
        isPaid={isPaid}
        loading={status === 'loading'}
        onNewSession={newSession}
        onClose={onClose}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        {activeSection === 'mission' && (
          <MissionSection
            mission={mission}
            replay={replay}
            currentPage={currentPage}
            messages={messages}
            pending={pending}
            error={error}
            input={input}
            isPaid={isPaid}
            isAuthenticated={isAuthenticated}
            transcriptRef={transcriptRef}
            onInput={setInput}
            onSend={sendMessage}
            onAction={runAction}
          />
        )}
        {activeSection === 'replay' && (
          <ReplaySection replay={replay} isPaid={isPaid} onAction={runAction} />
        )}
        {activeSection === 'benchmark' && (
          <BenchmarkSection
            isPaid={isPaid}
            usage={usage}
            selectedBenchmark={selectedBenchmark}
            onSelect={setSelectedBenchmark}
            onOpen={openBenchmark}
            onCredits={() => setActiveSection('guide')}
          />
        )}
        {activeSection === 'review' && (
          <ReviewSection
            context={studentContext}
            isPaid={isPaid}
            onAsk={sendMessage}
            onAction={runAction}
          />
        )}
        {activeSection === 'guide' && (
          <GuideSection
            currentPage={currentPage}
            isAuthenticated={isAuthenticated}
            isPaid={isPaid}
            wallet={wallet}
            aiTotal={aiTotal}
            notice={creditNotice}
            onAction={runAction}
            onPack={openCreditPack}
          />
        )}
      </main>

      <SectionRail activeSection={activeSection} setActiveSection={setActiveSection} />
    </div>
  );
}

function AssistantHeader({ isDrawer, isAuthenticated, isPaid, loading, onNewSession, onClose }) {
  return (
    <header className="border-b border-white/8 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-volt shadow-[0_0_14px_rgba(210,240,0,0.5)]" />
            Prep operating system
          </div>
          <h2 className="mt-1 font-display text-[24px] font-black leading-tight text-zinc-50">MockMob PrepOS</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-500">
            {isAuthenticated
              ? isPaid
                ? 'Personal missions, replay, benchmarks, and review.'
                : 'Guide, missions, and one free daily benchmark.'
              : 'Public guide mode. Personal missions unlock after signup.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewSession}
            className="hidden rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.1] hover:text-zinc-50 sm:inline-flex"
          >
            New
          </button>
          {isDrawer && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
              aria-label="Close PrepOS"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>
      {loading ? <TypingLine label="Checking session" /> : null}
    </header>
  );
}

function MissionSection({
  mission,
  replay,
  currentPage,
  messages,
  pending,
  error,
  input,
  isPaid,
  isAuthenticated,
  transcriptRef,
  onInput,
  onSend,
  onAction,
}) {
  return (
    <section className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 px-5 py-5">
        <MissionCard mission={mission} onAction={onAction} />

        <div className="grid gap-2 sm:grid-cols-3">
          <QuickCard
            title="Explain this page"
            body={currentPage.title}
            action={currentPage.primary}
            onAction={onAction}
          />
          <QuickCard
            title="Continue recovery"
            body={replay.ready ? replay.pattern : 'Needs one signal'}
            action={{ label: replay.ready ? 'Open replay' : 'Take diagnostic', type: replay.ready ? 'section' : 'navigate', section: 'replay', route: '/dashboard?mission=diagnostic' }}
            onAction={onAction}
          />
          <QuickCard
            title="Daily Benchmark"
            body="Short pressure check"
            action={{ label: 'Set up', type: 'benchmark', rivalType: 'NORTH_CAMPUS_RIVAL' }}
            onAction={onAction}
          />
        </div>

        <div ref={transcriptRef} className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <TypingLine label="Ready when you are" />
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Ask for site help, a mission, a replay, or a benchmark. Basic guide answers are instant.
              </p>
            </div>
          ) : null}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onAction={onAction} />
          ))}
          {error ? <InfoStrip tone="warn">{error}</InfoStrip> : null}
          {pending ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <TypingLine label={isPaid ? 'Reading your prep data' : 'Preparing guide answer'} />
            </div>
          ) : null}
        </div>
      </div>

      <CommandInput
        input={input}
        pending={pending}
        isAuthenticated={isAuthenticated}
        onInput={onInput}
        onSend={onSend}
      />
    </section>
  );
}

function MissionCard({ mission, onAction }) {
  return (
    <section className="rounded-[22px] border border-volt/20 bg-[linear-gradient(180deg,rgba(210,240,0,0.09),rgba(255,255,255,0.025))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold text-volt">Today&apos;s Mission</div>
          <h3 className="mt-2 font-display text-[25px] font-black leading-tight text-zinc-50">{mission.title}</h3>
        </div>
        <div className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-zinc-300">{mission.confidence}%</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{mission.line}</p>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <MissionFact label="Why" value={mission.why} />
        <MissionFact label="Time" value={mission.time} />
        <MissionFact label="Pass" value={mission.success} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAction(mission.action)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950"
        >
          <Icon name="play" style={{ width: 15, height: 15 }} /> {mission.action.label}
        </button>
        {mission.secondary ? (
          <button
            type="button"
            onClick={() => onAction(mission.secondary)}
            className="inline-flex min-h-11 items-center rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-zinc-100"
          >
            {mission.secondary.label}
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{mission.source}. {mission.reward}</p>
    </section>
  );
}

function MissionFact({ label, value }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <div className="text-[11px] font-bold text-zinc-500">{label}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-300">{value}</div>
    </div>
  );
}

function QuickCard({ title, body, action, onAction }) {
  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition hover:border-white/14 hover:bg-white/[0.045]"
    >
      <div className="font-display text-sm font-black text-zinc-50">{title}</div>
      <p className="mt-1 min-h-10 text-xs leading-5 text-zinc-500">{body}</p>
      <span className="mt-2 inline-flex text-xs font-bold text-volt">{action.label}</span>
    </button>
  );
}

function ReplaySection({ replay, isPaid, onAction }) {
  return (
    <section className="space-y-4 p-5">
      <div>
        <div className="text-[12px] font-bold text-volt">Mistake Replay</div>
        <h3 className="mt-1 font-display text-3xl font-black text-zinc-50">{replay.title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Replay means facing the exact mistake pattern again. It is not a renamed smart practice mode.
        </p>
      </div>
      <div className="rounded-[22px] border border-white/8 bg-white/[0.025] p-5">
        <div className="text-sm font-bold text-zinc-100">Pattern</div>
        <p className="mt-2 text-lg font-semibold leading-7 text-zinc-50">{replay.pattern}</p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{replay.reason}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <MissionFact label="Replay" value={replay.replay || 'Diagnostic needed first.'} />
          <MissionFact label="Pass condition" value={replay.pass} />
        </div>
        <button
          type="button"
          onClick={() => onAction(replay.action)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950"
        >
          {replay.action.label}
        </button>
      </div>
      {!isPaid && replay.ready ? (
        <InfoStrip>
          Personalized replay is Premium. Free accounts can still start a diagnostic or Daily Benchmark.
        </InfoStrip>
      ) : null}
    </section>
  );
}

function BenchmarkSection({ isPaid, usage, selectedBenchmark, onSelect, onOpen, onCredits }) {
  return (
    <section className="space-y-4 p-5">
      <div>
        <div className="text-[12px] font-bold text-volt">Shadow Benchmark</div>
        <h3 className="mt-1 font-display text-3xl font-black text-zinc-50">Pressure check, not a fake rival.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          MockMob picks real questions, calculates your score, and tells you whether you lost on speed, accuracy, skips, or pressure.
        </p>
      </div>
      <div className="space-y-2">
        {BENCHMARK_OPTIONS.map((benchmark) => {
          const access = benchmarkAccess({ benchmark, isPaid, usage });
          const selected = selectedBenchmark === benchmark.id;
          return (
            <div
              key={benchmark.id}
              className={`rounded-2xl border p-4 transition ${
                selected ? 'border-volt/30 bg-volt/[0.055]' : 'border-white/8 bg-white/[0.025]'
              }`}
            >
              <button type="button" onClick={() => onSelect(benchmark.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-base font-black text-zinc-50">{benchmark.name}</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{benchmark.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-xs font-semibold text-zinc-300">
                    {benchmark.cost ? `${benchmark.cost} AI cr` : benchmark.availability}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{benchmark.purpose}</p>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">{access.message}</span>
                <button
                  type="button"
                  onClick={() => (access.allowed ? onOpen(benchmark.id) : access.kind === 'credits' ? onCredits() : null)}
                  disabled={!access.allowed && access.kind !== 'credits'}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    access.allowed
                      ? 'bg-volt text-zinc-950'
                      : access.kind === 'credits'
                        ? 'bg-white/[0.08] text-zinc-100'
                        : 'bg-white/[0.04] text-zinc-500'
                  }`}
                >
                  {access.allowed ? 'Start setup' : access.kind === 'credits' ? 'View credits' : 'Locked'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewSection({ context, isPaid, onAsk, onAction }) {
  const last = context?.lastMockSummary;
  const weak = context?.weaknessSummary?.weakChapters || [];
  return (
    <section className="space-y-4 p-5">
      <div>
        <div className="text-[12px] font-bold text-volt">Review</div>
        <h3 className="mt-1 font-display text-3xl font-black text-zinc-50">Turn results into recovery.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Mock autopsy is the deep premium layer. Basic review stays compact.
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="text-sm font-bold text-zinc-100">Last mock</div>
        {last ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Subject" value={display(last.subject)} />
            <Metric label="Score" value={last.score ?? 0} />
            <Metric label="Accuracy" value={`${last.accuracy ?? 0}%`} />
            <Metric label="Unattempted" value={last.unattempted ?? 0} />
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-zinc-400">No completed mock found yet. Take one short diagnostic first.</p>
        )}
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="text-sm font-bold text-zinc-100">Current leaks</div>
        {weak.length ? (
          <div className="mt-3 space-y-2">
            {weak.slice(0, 3).map((item) => (
              <div key={`${item.subject}_${item.chapter}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{display(item.subject)}: {item.chapter}</span>
                <span className="text-zinc-500">{item.accuracy}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-zinc-400">Weakness data appears after enough attempts.</p>
        )}
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => isPaid ? onAsk('Analyze my last mock.', 'autopsy') : onAction({ type: 'navigate', route: '/pricing?reason=mock_autopsy' })}
          className="min-h-12 rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950"
        >
          {isPaid ? 'Run mock autopsy' : 'Upgrade for autopsy'}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: 'section', section: 'replay' })}
          className="min-h-12 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-zinc-100"
        >
          Open Mistake Replay
        </button>
      </div>
    </section>
  );
}

function GuideSection({ currentPage, isAuthenticated, isPaid, wallet, aiTotal, notice, onAction, onPack }) {
  return (
    <section className="space-y-5 p-5">
      <div>
        <div className="text-[12px] font-bold text-volt">Guide</div>
        <h3 className="mt-1 font-display text-3xl font-black text-zinc-50">Find the right MockMob tool.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Site explanations are deterministic, fast, and available even before login.
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="font-display text-base font-black text-zinc-50">{currentPage.title}</div>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{currentPage.body}</p>
        <button
          type="button"
          onClick={() => onAction(currentPage.primary)}
          className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.1]"
        >
          {currentPage.primary.label}
        </button>
      </div>
      <div className="grid gap-2">
        {FEATURE_GUIDE.map((feature) => (
          <button
            key={feature.key}
            type="button"
            onClick={() => onAction({ type: 'navigate', route: feature.route })}
            className="w-full rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.045]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-base font-black text-zinc-50">{feature.name}</div>
              <span className="text-sm font-semibold text-volt">{feature.actionLabel}</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{feature.description}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{feature.whenToUse}</p>
          </button>
        ))}
      </div>
      <CreditShelf
        isAuthenticated={isAuthenticated}
        isPaid={isPaid}
        wallet={wallet}
        aiTotal={aiTotal}
        notice={notice}
        onPack={onPack}
      />
    </section>
  );
}

function CreditShelf({ isAuthenticated, isPaid, wallet, aiTotal, notice, onPack }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="font-display text-base font-black text-zinc-50">AI credits</div>
      <p className="mt-1 text-sm leading-6 text-zinc-400">
        Credits stay out of the main screen. They appear only before deep PrepOS work.
      </p>
      {isAuthenticated && isPaid ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Balance" value={aiTotal ?? wallet?.total ?? 0} />
          <Metric label="Included" value={`${wallet?.includedRemaining ?? 0}/${wallet?.includedMonthlyCredits ?? 50}`} />
          <Metric label="Bonus" value={wallet?.bonusCredits ?? 0} />
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-black/20 p-3 text-sm leading-6 text-zinc-400">
          {isAuthenticated ? 'Upgrade to unlock personalized AI credits.' : 'Create an account to unlock personal PrepOS history.'}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {CREDIT_PACKS.map((pack) => (
          <button
            key={pack.key}
            type="button"
            onClick={() => onPack(pack)}
            className="rounded-xl bg-black/20 p-3 text-left transition hover:bg-black/30"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-100">{pack.name}</span>
              <span className="text-xs font-bold text-zinc-500">Coming soon</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{pack.description}</p>
          </button>
        ))}
      </div>
      {notice ? (
        <InfoStrip tone="warn">
          {notice} <Link href="/pricing?reason=ai_credits" className="font-bold text-volt no-underline">Open pricing</Link>
        </InfoStrip>
      ) : null}
    </div>
  );
}

function SectionRail({ activeSection, setActiveSection }) {
  return (
    <nav className="grid grid-cols-5 border-t border-white/8 bg-[#090a08] px-2 py-2">
      {PREPOS_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => setActiveSection(section.id)}
          className={`min-h-10 rounded-xl text-xs font-bold transition ${
            activeSection === section.id
              ? 'bg-volt text-zinc-950'
              : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100'
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function CommandInput({ input, pending, isAuthenticated, onInput, onSend }) {
  return (
    <div className="border-t border-white/8 p-4">
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSend(prompt, modeForPrompt(prompt))}
            className="shrink-0 rounded-full bg-white/[0.055] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.09] hover:text-zinc-50"
          >
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => onInput(event.target.value)}
          placeholder={isAuthenticated ? 'Ask for a mission, replay, or review...' : 'Ask how MockMob works...'}
          className="min-h-12 flex-1 rounded-xl border border-white/10 bg-[#10110e] px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-volt/50"
        />
        <button
          type="submit"
          disabled={!input.trim() || pending}
          className="min-h-12 rounded-xl bg-volt px-5 font-display text-sm font-black text-zinc-950 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function ChatMessage({ message, onAction }) {
  if (message.role === 'user') {
    return <div className="ml-auto max-w-[86%] rounded-2xl bg-volt px-4 py-3 text-sm font-semibold text-zinc-950">{message.text}</div>;
  }
  const response = message.response || {};
  return (
    <div className="max-w-[92%] rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <p className="text-sm leading-6 text-zinc-200">{response.reply || message.text}</p>
      {response.reason ? <p className="mt-2 text-xs leading-5 text-zinc-500">{response.reason}</p> : null}
      {Array.isArray(response.cards) && response.cards.length ? (
        <div className="mt-3 space-y-2">
          {response.cards.slice(0, 2).map((card, index) => (
            <div key={`${card.title}_${index}`} className="rounded-xl bg-black/20 p-3">
              <div className="text-xs font-bold text-zinc-200">{card.title}</div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{card.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      {Array.isArray(response.actions) && response.actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {response.actions.slice(0, 2).map((action, index) => (
            <button
              key={`${action.label || action.action}_${index}`}
              type="button"
              onClick={() => onAction(action)}
              className="rounded-lg bg-white/[0.07] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.11]"
            >
              {action.label || labelForModelAction(action)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TypingLine({ label }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-zinc-500">
      <span>{label}</span>
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-volt [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-volt [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-volt" />
      </span>
    </div>
  );
}

function InfoStrip({ children, tone = 'neutral' }) {
  const cls = tone === 'warn'
    ? 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
    : 'border-white/8 bg-white/[0.025] text-zinc-300';
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${cls}`}>{children}</div>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-[#10110e] p-3">
      <div className="text-xs font-semibold text-zinc-500">{label}</div>
      <div className="mt-1 font-display text-lg font-black text-zinc-50">{value}</div>
    </div>
  );
}

function normalizeHistory(rows) {
  return (rows || []).map((row) => {
    if (row.role === 'assistant') {
      return {
        id: row.id || `a_${row.createdAt || Math.random()}`,
        role: 'assistant',
        response: normalizeModelResponse(row.response || row.structured_payload || { reply: row.text || row.content || '' }),
      };
    }
    return {
      id: row.id || `u_${row.createdAt || Math.random()}`,
      role: row.role || 'user',
      text: row.text || row.content || '',
    };
  });
}

function normalizeModelResponse(response) {
  return {
    reply: response?.reply || 'PrepOS responded without a readable answer.',
    confidence: response?.confidence ?? 0,
    reason: summarizeCards(response?.cards),
    cards: Array.isArray(response?.cards) ? response.cards : [],
    actions: Array.isArray(response?.actions) ? response.actions : [],
    charge: response?.charge,
  };
}

function summarizeCards(cards) {
  const card = Array.isArray(cards) ? cards[0] : null;
  if (!card) return null;
  return [card.title, card.body].filter(Boolean).join(': ');
}

function modeForPrompt(prompt) {
  if (/last mock|autopsy|analyze/i.test(prompt)) return 'autopsy';
  if (/comeback/i.test(prompt)) return 'comeback';
  return 'mentor';
}

function routeForModelAction(action) {
  switch (action.action) {
    case 'create_next_mock':
      return '/dashboard?source=prepos';
    case 'show_admission_path':
      return '/admission-compass';
    case 'start_revision_queue':
    case 'explain_mistake':
      return '/saved?source=prepos';
    case 'upgrade_plan':
      return '/pricing?reason=prepos';
    default:
      return null;
  }
}

function labelForModelAction(action) {
  if (action.action === 'buy_credits') return 'View credits';
  if (action.action === 'upgrade_plan') return 'View Premium';
  if (action.action === 'launch_ai_rival') return 'Open Benchmark';
  if (action.action === 'create_trap_drill') return 'Open Mistake Replay';
  return 'Open';
}

function benchmarkAccess({ benchmark, isPaid, usage }) {
  if (benchmark.tier === 'free') {
    const remaining = usage?.remaining?.basicRivalBattles;
    if (isPaid || remaining === 'unlimited' || remaining == null || remaining > 0) {
      return { allowed: true, message: 'Available now' };
    }
    return { allowed: false, kind: 'daily', message: 'Daily Benchmark used today' };
  }
  if (benchmark.tier === 'paid_basic') {
    return isPaid
      ? { allowed: true, message: 'Included with Premium' }
      : { allowed: false, kind: 'plan', message: 'Premium required' };
  }
  if (!isPaid) return { allowed: false, kind: 'plan', message: 'Premium required' };
  const balance = Number(usage?.aiCreditBalance ?? usage?.aiWallet?.total ?? 0);
  if (balance >= benchmark.cost) return { allowed: true, message: `${benchmark.cost} AI credit${benchmark.cost === 1 ? '' : 's'}` };
  return { allowed: false, kind: 'credits', message: `Need ${benchmark.cost} AI credits` };
}

function normalizeSection(value) {
  if (value === 'ask') return 'mission';
  const ids = new Set(PREPOS_SECTIONS.map((section) => section.id));
  return ids.has(value) ? value : 'mission';
}

function display(value) {
  return String(value || 'None').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}
