"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '@/components/ui/Icons';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuth } from '@/components/AuthProvider';
import {
  BENCHMARK_OPTIONS,
  CREDIT_PACKS,
  FEATURE_GUIDE,
  buildMistakeReplayPlan,
  buildTodayMission,
  deterministicReplyFor,
  pageHelpForPath,
} from './assistantKnowledge';

const HUB_SECTIONS = [
  { id: 'ai', label: 'PrepOS' },
  { id: 'mission', label: 'Missions' },
  { id: 'guide', label: 'Tools' },
];

const QUICK_PROMPTS = [
  { label: 'Plan today', prompt: 'What should I do today?', mode: 'mentor' },
  { label: 'Replan', prompt: 'Replan my day around my daily target.', mode: 'mock_plan' },
  { label: 'Benchmark', prompt: 'Which benchmark should I take today?', mode: 'battle' },
  { label: 'Review', prompt: 'Review my last mock and tell me the next move.', mode: 'autopsy' },
];

const PREPOS_COMMANDS = [
  {
    label: 'Mission',
    prefix: '/mission',
    body: 'Open the daily calendar',
    icon: 'route',
    action: { type: 'section', section: 'mission' },
  },
  {
    label: 'Replan',
    prefix: '/replan',
    body: 'Adjust today around your target',
    icon: 'clock',
    action: { type: 'replan' },
  },
  {
    label: 'Benchmark',
    prefix: '/benchmark',
    body: 'Choose the right rival',
    icon: 'target',
    action: { type: 'section', section: 'benchmark' },
  },
  {
    label: 'Review',
    prefix: '/review',
    body: 'Turn the last mock into next steps',
    icon: 'radar',
    action: { type: 'section', section: 'review' },
  },
];

const PLAN_BUILD_STEPS = [
  'Reading setup choices',
  'Choosing mission order',
  'Writing the daily plan',
];

const SETUP_DEFAULTS = {
  target: 'CUET score climb',
  dailyMinutes: 45,
  focus: 'weakness',
  benchmark: 'daily',
};

const TARGET_OPTIONS = [
  'CUET score climb',
  'DU North Campus',
  '700+ score push',
  'Consistency streak',
];

const FOCUS_OPTIONS = [
  { key: 'weakness', label: 'Weak chapters' },
  { key: 'speed', label: 'Speed' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'revision', label: 'Revision' },
];

const BENCHMARK_BY_SETUP = {
  daily: 'NORTH_CAMPUS_RIVAL',
  speed: 'SPEED_DEMON',
  accuracy: 'ACCURACY_MONSTER',
  weakness: 'WEAKNESS_RIVAL',
};

export default function MockMobAIHub({
  variant = 'drawer',
  initialTab = 'ai',
  onClose,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useAuth();

  const [activeSection, setActiveSection] = useState(normalizeSection(initialTab));
  const [missionFocus, setMissionFocus] = useState(null);
  const [usage, setUsage] = useState(null);
  const [studentContext, setStudentContext] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState('NORTH_CAMPUS_RIVAL');
  const [creditNotice, setCreditNotice] = useState(null);
  const [setupProfile, setSetupProfile] = useState(null);
  const [setupDraft, setSetupDraft] = useState(SETUP_DEFAULTS);
  const [setupOpen, setSetupOpen] = useState(false);
  const [planVersion, setPlanVersion] = useState(1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [setupBuild, setSetupBuild] = useState(null);
  const transcriptRef = useRef(null);
  const setupBuildTimersRef = useRef([]);

  const isDrawer = variant === 'drawer';
  const isAuthenticated = Boolean(user?.id);
  const isPaid = Boolean(usage?.isPaid ?? user?.isPremium ?? user?.subscriptionStatus === 'active');
  const wallet = usage?.aiWallet || usage?.wallet || null;
  const aiTotal = usage?.aiCreditBalance ?? wallet?.total ?? 0;
  const setupKey = `mockmob_ai_setup_${user?.id || 'guest'}`;
  const currentPage = useMemo(() => pageHelpForPath(pathname), [pathname]);
  const enrichedContext = useMemo(
    () => studentContext ? { ...studentContext, setupProfile } : null,
    [studentContext, setupProfile],
  );
  const mission = useMemo(
    () => buildTodayMission({ context: enrichedContext, user, pathname }),
    [enrichedContext, user, pathname],
  );
  const replay = useMemo(() => buildMistakeReplayPlan(enrichedContext), [enrichedContext]);
  const firstName = useMemo(() => {
    const source = user?.name || user?.email || studentContext?.displayName || 'there';
    return String(source).split(/[ @]/)[0] || 'there';
  }, [studentContext?.displayName, user?.email, user?.name]);

  useEffect(() => () => {
    setupBuildTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    setupBuildTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      const stored = parseSetupProfile(window.localStorage.getItem(setupKey));
      setSetupProfile(stored);
      setSetupDraft(stored || SETUP_DEFAULTS);
      setSetupOpen(Boolean(isAuthenticated && !stored));
      if (stored) setTranscriptOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setupKey, isAuthenticated]);

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
  }, [messages, pending, activeSection, setupBuild]);

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
      // The hub still works as a site guide without personal prep context.
    }
  }

  async function sendMessage(text = input, mode = 'mentor') {
    const finalText = String(text || '').trim();
    if (!finalText || pending) return;

    if (setupBuild) {
      clearSetupBuildTimers();
      setSetupBuild(null);
    }
    setActiveSection('ai');
    setTranscriptOpen(true);
    setInput('');
    setError(null);
    appendUser(finalText);

    const deterministic = deterministicReplyFor({
      text: finalText,
      pathname,
      context: enrichedContext,
      user,
    });
    if (deterministic) {
      appendAssistant(deterministic);
      persistLocalExchange(finalText, deterministic);
      return;
    }

    if (!isAuthenticated) {
      appendAssistant({
        reply: 'I can answer MockMob and CUET questions now. Personal missions need an account because they use your subjects, mocks, saved questions, and Radar history.',
        confidence: 100,
        reason: 'Public PrepOS stays helpful without pretending to know private prep data.',
        actions: [
          { label: 'Create account', type: 'navigate', route: '/signup?source=ai' },
          { label: 'How MockMob works', type: 'ask', prompt: 'How does MockMob help CUET prep?' },
        ],
      });
      return;
    }

    if (!isPaid && mode !== 'mentor') {
      appendAssistant({
        reply: 'Your free account gets site guidance, setup, daily missions, and one Daily Benchmark. Deep replanning, autopsy, and personalized replay unlock with Premium.',
        confidence: 100,
        reason: 'Free guidance stays useful while paid PrepOS work stays controlled.',
        actions: [
          { label: 'Open Missions', type: 'section', section: 'mission' },
          { label: 'View Premium', type: 'navigate', route: '/pricing?reason=ai' },
        ],
      });
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ai/mentor/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: finalText, mode, sessionId, setupProfile }),
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
        reply: 'Network failed before PrepOS could answer. Missions and setup still work locally.',
        confidence: 0,
        reason: 'No data was changed.',
        actions: [{ label: 'Open Missions', type: 'section', section: 'mission' }],
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
      setActiveSection('ai');
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
      setTranscriptOpen(false);
      setActiveSection('ai');
    } catch {
      setError('Could not start a new AI session.');
    }
  }

  function saveSetup(next = setupDraft) {
    const clean = normalizeSetup(next);
    const nextBenchmark = BENCHMARK_BY_SETUP[clean.benchmark] || 'NORTH_CAMPUS_RIVAL';
    setSetupProfile(clean);
    setSetupDraft(clean);
    setSetupOpen(false);
    setSelectedBenchmark(nextBenchmark);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(setupKey, JSON.stringify(clean));
    }
    startSetupPlanBuild(clean, nextBenchmark);
  }

  function clearSetupBuildTimers() {
    setupBuildTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    setupBuildTimersRef.current = [];
  }

  function startSetupPlanBuild(clean, benchmarkId) {
    if (typeof window === 'undefined') return;
    clearSetupBuildTimers();
    setActiveSection('ai');
    setTranscriptOpen(true);
    setPending(false);
    setError(null);
    setInput('');
    setMissionFocus('mission');
    setMessages((prev) => [
      ...prev,
      {
        id: `u_setup_${Date.now()}`,
        role: 'user',
        text: `Build my ${display(clean.target)} plan for ${clean.dailyMinutes} minutes.`,
      },
    ]);
    setSetupBuild({ stage: 0, profile: clean });

    setupBuildTimersRef.current = [
      window.setTimeout(() => setSetupBuild({ stage: 1, profile: clean }), 320),
      window.setTimeout(() => setSetupBuild({ stage: 2, profile: clean }), 680),
      window.setTimeout(() => {
        const response = buildSetupPlanResponse({
          setupProfile: clean,
          context: studentContext,
          user,
          pathname,
          benchmarkId,
          planVersion: planVersion + 1,
        });
        setSetupBuild(null);
        setPlanVersion((value) => value + 1);
        setMessages((prev) => [
          ...prev,
          { id: `a_setup_${Date.now()}`, role: 'assistant', response },
        ]);
        setupBuildTimersRef.current = [
          window.setTimeout(() => {
            setMissionFocus('mission');
            setTranscriptOpen(true);
          }, 1900),
        ];
      }, 1040),
    ];
  }

  function startSetup() {
    setSetupOpen(true);
    setActiveSection('ai');
    setTranscriptOpen(false);
  }

  function replanDay() {
    setPlanVersion((value) => value + 1);
    setMissionFocus('mission');
    setActiveSection('mission');
  }

  function runAction(action) {
    clearSetupBuildTimers();
    setSetupBuild(null);
    if (!action) return;

    if (action.type === 'ask' && action.prompt) {
      sendMessage(action.prompt, action.mode || 'mentor');
      return;
    }
    if (action.type === 'setup') {
      startSetup();
      return;
    }
    if (action.type === 'replan') {
      replanDay();
      return;
    }
    if (action.type === 'section' || action.type === 'tab') {
      const requested = action.section || action.tab;
      if (['replay', 'benchmark', 'review'].includes(requested)) {
        setMissionFocus(requested);
        setActiveSection('mission');
        return;
      }
      setActiveSection(normalizeSection(requested));
      return;
    }
    if (action.type === 'benchmark' || action.action === 'launch_ai_rival') {
      const rival = action.rivalType || action.params?.rivalType || 'NORTH_CAMPUS_RIVAL';
      setSelectedBenchmark(rival);
      setMissionFocus('benchmark');
      setActiveSection('mission');
      return;
    }
    if (action.action === 'buy_credits' || action.type === 'credits') {
      setActiveSection('guide');
      setCreditNotice('PrepOS top-ups are live. Open the credit page to add credits without changing your subscription.');
      return;
    }
    if (action.action === 'show_mock_autopsy') {
      sendMessage('Analyze my last mock.', 'autopsy');
      return;
    }
    if (action.action === 'create_trap_drill' || action.action === 'create_mistake_replay') {
      setMissionFocus('replay');
      setActiveSection('mission');
      return;
    }
    if (action.action === 'create_next_mock') {
      router.push('/dashboard?source=ai');
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
    router.push(`/pricing/prepos?pack=${encodeURIComponent(pack.key)}&source=assistant`);
    onClose?.();
  }

  const shellClass = isDrawer
    ? 'flex h-full min-h-0 flex-col bg-[#090a08] text-zinc-100'
    : 'mx-auto flex min-h-[760px] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#090a08] text-zinc-100 shadow-[0_28px_100px_rgba(0,0,0,0.38)]';

  return (
    <div className={shellClass}>
      <HubHeader
        firstName={firstName}
        isDrawer={isDrawer}
        isAuthenticated={isAuthenticated}
        isPaid={isPaid}
        loading={status === 'loading'}
        onNewSession={newSession}
        onClose={onClose}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        {activeSection === 'ai' && (
          <AIChatSection
            firstName={firstName}
            setupOpen={setupOpen}
            setupDraft={setupDraft}
            setupProfile={setupProfile}
            isAuthenticated={isAuthenticated}
            isPaid={isPaid}
            messages={messages}
            transcriptOpen={transcriptOpen}
            pending={pending}
            error={error}
            input={input}
            transcriptRef={transcriptRef}
            setupBuild={setupBuild}
            onInput={setInput}
            onSend={sendMessage}
            onAction={runAction}
            onTranscriptOpen={() => setTranscriptOpen(true)}
            onTranscriptClose={() => setTranscriptOpen(false)}
            onSetupDraft={setSetupDraft}
            onSaveSetup={saveSetup}
            onCloseSetup={() => setSetupOpen(false)}
            onStartSetup={startSetup}
          />
        )}

        {activeSection === 'mission' && (
          <MissionDashboard
            mission={mission}
            replay={replay}
            context={enrichedContext}
            setupProfile={setupProfile}
            planVersion={planVersion}
            selectedBenchmark={selectedBenchmark}
            missionFocus={missionFocus}
            isPaid={isPaid}
            usage={usage}
            onAction={runAction}
            onOpenBenchmark={openBenchmark}
            onSelectBenchmark={setSelectedBenchmark}
            onReplan={replanDay}
            onStartSetup={startSetup}
            onCredits={() => setActiveSection('guide')}
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

function HubHeader({ firstName, isDrawer, isAuthenticated, isPaid, loading, onNewSession, onClose }) {
  return (
    <header className="border-b border-white/8 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <PrepOSOrb size={36} active />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-volt shadow-[0_0_14px_rgba(210,240,0,0.5)]" />
              PrepOS
            </div>
            <h2 className="mt-1 font-display text-[24px] font-black leading-tight text-zinc-50">
              Hello, {firstName}
            </h2>
            <p className="mt-1 text-sm leading-5 text-zinc-500">
              {isAuthenticated
                ? isPaid
                  ? 'Ask, plan, replay, benchmark, and review from one operating layer.'
                  : 'Setup, daily missions, guide answers, and one Daily Benchmark.'
                : 'Public guide mode. Personal missions unlock after signup.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewSession}
            className="hidden rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.1] hover:text-zinc-50 sm:inline-flex"
          >
            Reset
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

function AIChatSection({
  firstName,
  setupOpen,
  setupDraft,
  setupProfile,
  isAuthenticated,
  isPaid,
  messages,
  transcriptOpen,
  pending,
  error,
  input,
  transcriptRef,
  setupBuild,
  onInput,
  onSend,
  onAction,
  onTranscriptOpen,
  onTranscriptClose,
  onSetupDraft,
  onSaveSetup,
  onCloseSetup,
  onStartSetup,
}) {
  const hasSavedThread = messages.length > 0 && !transcriptOpen;
  const conversationMode = transcriptOpen || pending || error || setupBuild;
  const setupSummary = setupProfile
    ? `${setupProfile.dailyMinutes} min daily · ${display(setupProfile.focus)} · ${display(setupProfile.benchmark)}`
    : 'Four choices, then PrepOS builds the day.';
  const greeting = setupProfile ? `How can I help, ${firstName}?` : `Set your prep layer, ${firstName}?`;
  const showReadyCard = conversationMode && setupProfile && !messages.length && !pending && !error && !setupBuild;
  const showTranscript = showReadyCard || (transcriptOpen && messages.length > 0) || pending || error || setupBuild;

  return (
    <section className="relative flex min-h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(210,240,0,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(246,247,238,0.22)_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative flex-1 space-y-4 px-3 py-3 sm:px-5 sm:py-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0d08]/88 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
        >
          <div className={`relative px-4 sm:px-6 ${conversationMode ? 'py-4' : 'pb-4 pt-7'}`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_50%_0%,rgba(210,240,0,0.17),transparent_62%)]" />
            <motion.div
              layout
              className={`relative ${conversationMode ? 'flex items-center gap-3 text-left' : 'flex flex-col items-center text-center'}`}
            >
              <PrepOSOrb size={conversationMode ? 48 : 92} label={conversationMode ? '' : 'OS'} active />
              <div className={conversationMode ? 'min-w-0 flex-1' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`${conversationMode ? 'mb-1' : 'mt-5'} inline-flex items-center gap-2 rounded-full border border-volt/20 bg-volt/[0.07] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-volt`}>
                    PrepOS
                  </div>
                  {conversationMode && setupProfile ? (
                    <button
                      type="button"
                      onClick={onTranscriptClose}
                      className="mb-1 inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-100"
                    >
                      Close chat
                    </button>
                  ) : null}
                </div>
                <TypedGreeting
                  text={greeting}
                  className={`${conversationMode ? 'mt-1 text-[22px] sm:text-[24px]' : 'mt-3 text-[26px] sm:text-[34px]'} w-full max-w-[min(560px,100%)] font-display font-black leading-[1.08] text-zinc-50`}
                />
                {!conversationMode ? (
                  <p className="mt-3 max-w-[560px] text-sm leading-6 text-zinc-400">
                    {setupProfile
                      ? 'Your next steps are ready for today. Ask anything, open missions, retune setup, or replan from chat.'
                      : 'Answer a quick setup once, then PrepOS turns your target into daily work.'}
                  </p>
                ) : null}
              </div>
            </motion.div>

            <AnimatePresence initial={false}>
              {!conversationMode ? (
                <motion.div
                  key="prepos-idle-input"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="relative mt-6"
                >
                  <CommandInput
                    input={input}
                    pending={pending}
                    isAuthenticated={isAuthenticated}
                    setupProfile={setupProfile}
                    onInput={onInput}
                    onSend={onSend}
                    onAction={onAction}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {!conversationMode ? (
                <motion.div
                  key="prepos-tiles"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="relative mt-4 grid gap-2 sm:grid-cols-2"
                >
                  <PrepTile
                    icon="spark"
                    title={setupProfile ? 'Setup tuned' : 'Start setup'}
                    body={setupProfile ? 'Done with setup? Continue with chat.' : setupSummary}
                    active={!setupProfile || setupOpen}
                    onClick={setupProfile ? onTranscriptOpen : onStartSetup}
                  />
                  <PrepTile
                    icon="route"
                    title="Mission"
                    body="Daily calendar with target, replay, benchmark, and review."
                    onClick={() => onAction({ type: 'section', section: 'mission' })}
                  />
                  <PrepTile
                    icon="clock"
                    title="Replan"
                    body="Compress or expand today around your available time."
                    onClick={() => onAction({ type: 'replan' })}
                  />
                  <PrepTile
                    icon="radar"
                    title="Review"
                    body={isPaid ? 'Run a deeper mock autopsy.' : 'Open the compact review path.'}
                    onClick={() => onAction({ type: 'section', section: 'review' })}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {showTranscript ? (
                <motion.div
                  ref={transcriptRef}
                  key="prepos-thread"
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 8, height: 0 }}
                  className="mt-4 max-h-[min(48vh,440px)] space-y-3 overflow-y-auto pr-1"
                >
                  {showReadyCard ? <SetupReadyCard setupProfile={setupProfile} onAction={onAction} /> : null}
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} onAction={onAction} />
                  ))}
                  {setupBuild ? <PlanBuildCard stage={setupBuild.stage} profile={setupBuild.profile} /> : null}
                  {error ? <InfoStrip tone="warn">{error}</InfoStrip> : null}
                  {pending ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <TypingLine label="PrepOS is thinking" shining />
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {conversationMode ? (
                <motion.div
                  key="prepos-chat-input"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="relative mt-4"
                >
                  <CommandInput
                    input={input}
                    pending={pending}
                    isAuthenticated={isAuthenticated}
                    setupProfile={setupProfile}
                    compact
                    onInput={onInput}
                    onSend={onSend}
                    onAction={onAction}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>

        {setupOpen && !conversationMode ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <SetupWizard
              draft={setupDraft}
              isAuthenticated={isAuthenticated}
              onDraft={onSetupDraft}
              onSave={onSaveSetup}
              onClose={onCloseSetup}
            />
          </motion.div>
        ) : null}

        {hasSavedThread ? (
          <button
            type="button"
            onClick={onTranscriptOpen}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.045]"
          >
            <span>
              <span className="block text-sm font-bold text-zinc-100">Previous PrepOS thread saved</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">Resume only if you need the old context. The main layer stays clean.</span>
            </span>
            <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-zinc-300">Open</span>
          </button>
        ) : null}

      </div>
    </section>
  );
}

function TypedGreeting({ text, className = '' }) {
  return (
    <h3 className={className} aria-label={text}>
      <span
        key={text}
        className="inline-block max-w-full overflow-hidden whitespace-normal break-words align-bottom sm:whitespace-nowrap"
        style={{
          animation: `prepos-type ${Math.max(0.8, text.length * 0.028)}s steps(${Math.max(1, text.length)}, end) both`,
        }}
      >
        {text}
      </span>
      <motion.span
        aria-hidden="true"
        className="ml-1 inline-block h-[0.9em] w-[2px] translate-y-[0.12em] rounded-full bg-volt"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <style>{`
        @keyframes prepos-type {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
      `}</style>
    </h3>
  );
}

function SetupWizard({ draft, isAuthenticated, onDraft, onSave, onClose }) {
  if (!isAuthenticated) {
    return (
      <div className="rounded-[22px] border border-volt/20 bg-volt/[0.06] p-5">
        <div className="text-[12px] font-bold text-volt">Setup</div>
        <h3 className="mt-1 font-display text-2xl font-black text-zinc-50">Create an account to personalize PrepOS.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Setup uses your subjects, target, mocks, saved questions, and Radar history. Public mode can still explain the site.
        </p>
        <Link href="/signup?source=ai_setup" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950 no-underline">
          Create free account
        </Link>
      </div>
    );
  }

  const update = (patch) => onDraft({ ...draft, ...patch });

  return (
    <div className="rounded-[22px] border border-volt/20 bg-[linear-gradient(180deg,rgba(210,240,0,0.085),rgba(255,255,255,0.025))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-bold text-volt">First setup</div>
          <h3 className="mt-1 font-display text-2xl font-black text-zinc-50">Tune PrepOS to your daily prep.</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Four choices are enough. You can edit this later from the PrepOS tab.
          </p>
        </div>
        <button type="button" className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-bold text-zinc-300" onClick={onClose}>
          Later
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <ChoiceGroup
          label="Target"
          value={draft.target}
          options={TARGET_OPTIONS.map((label) => ({ key: label, label }))}
          onPick={(target) => update({ target })}
        />
        <ChoiceGroup
          label="Daily time"
          value={String(draft.dailyMinutes)}
          options={[20, 45, 60, 90].map((value) => ({ key: String(value), label: `${value} min` }))}
          onPick={(dailyMinutes) => update({ dailyMinutes: Number(dailyMinutes) })}
        />
        <ChoiceGroup
          label="Focus"
          value={draft.focus}
          options={FOCUS_OPTIONS}
          onPick={(focus) => update({ focus })}
        />
        <ChoiceGroup
          label="Benchmark"
          value={draft.benchmark}
          options={[
            { key: 'daily', label: 'Daily' },
            { key: 'speed', label: 'Speed' },
            { key: 'accuracy', label: 'Accuracy' },
            { key: 'weakness', label: 'Weakness' },
          ]}
          onPick={(benchmark) => update({ benchmark })}
        />
      </div>

      <button
        type="button"
        onClick={() => onSave(draft)}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950"
      >
        Build my missions
      </button>
    </div>
  );
}

function ChoiceGroup({ label, value, options, onPick }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onPick(option.key)}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
              value === option.key
                ? 'border-volt/40 bg-volt text-zinc-950'
                : 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-white/18 hover:bg-white/[0.06]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MissionDashboard({
  mission,
  replay,
  context,
  setupProfile,
  planVersion,
  selectedBenchmark,
  missionFocus,
  isPaid,
  usage,
  onAction,
  onOpenBenchmark,
  onSelectBenchmark,
  onReplan,
  onStartSetup,
  onCredits,
}) {
  const benchmark = BENCHMARK_OPTIONS.find((item) => item.id === selectedBenchmark)
    || benchmarkFromSetup(setupProfile)
    || BENCHMARK_OPTIONS[0];
  const access = benchmarkAccess({ benchmark, isPaid, usage });
  const plan = buildDailyPlan({ mission, replay, context, setupProfile, benchmark, planVersion });
  const last = context?.lastMockSummary;
  const weak = context?.weaknessSummary?.weakChapters || [];
  const today = useMemo(
    () => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date()),
    [],
  );

  return (
    <section className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold text-volt">Daily missions</div>
          <h3 className="mt-1 font-display text-2xl font-black leading-tight text-zinc-50 sm:text-3xl">Today&apos;s calendar</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            A simple day: setup, one task, one benchmark, one review. Replan when your time or target changes.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onStartSetup} className="rounded-full bg-white/[0.06] px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.1]">
            Setup
          </button>
          <button type="button" onClick={onReplan} className="rounded-full bg-volt px-3 py-2 text-sm font-black text-zinc-950 shadow-[0_0_24px_rgba(210,240,0,0.15)] transition hover:scale-[1.02]">
            Replan
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-zinc-500">{today}</div>
            <div className="mt-1 font-display text-lg font-black text-zinc-50">{setupProfile?.target || 'Set a CUET target'}</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-300">
            <span className="rounded-full bg-black/25 px-3 py-1">{setupProfile?.dailyMinutes || 30} min</span>
            <span className="rounded-full bg-black/25 px-3 py-1">{display(setupProfile?.focus || 'setup')}</span>
            <span className="rounded-full bg-black/25 px-3 py-1">Plan {planVersion}</span>
          </div>
        </div>

        <div className="relative mt-4 space-y-3">
          {plan.map((item, index) => (
            <MissionBlock
              key={`${item.key}_${index}`}
              item={item}
              index={index}
              total={plan.length}
              active={missionFocus === item.key}
              onAction={onAction}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <div className={`rounded-[22px] border p-4 ${missionFocus === 'benchmark' ? 'border-volt/30 bg-volt/[0.045]' : 'border-white/8 bg-white/[0.025]'}`}>
          <div className="text-[12px] font-bold text-volt">Benchmark guide</div>
          <h4 className="mt-1 font-display text-xl font-black text-zinc-50">{benchmark.name}</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{benchmark.description}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {BENCHMARK_OPTIONS.slice(0, 4).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectBenchmark(option.id)}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  selectedBenchmark === option.id
                    ? 'border-volt/30 bg-volt/[0.06] text-zinc-50'
                    : 'border-white/8 bg-black/20 text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div className="font-bold">{option.shortName || option.name}</div>
                <div className="mt-1 text-xs text-zinc-500">{option.availability}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">{access.message}</span>
            <button
              type="button"
              onClick={() => (access.allowed ? onOpenBenchmark(benchmark.id) : access.kind === 'credits' ? onCredits() : null)}
              disabled={!access.allowed && access.kind !== 'credits'}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                access.allowed
                  ? 'bg-volt text-zinc-950'
                  : access.kind === 'credits'
                    ? 'bg-white/[0.08] text-zinc-100'
                    : 'bg-white/[0.04] text-zinc-500'
              }`}
            >
              {access.allowed ? 'Start benchmark' : access.kind === 'credits' ? 'View credits' : 'Locked'}
            </button>
          </div>
        </div>

        <div className={`rounded-[22px] border p-4 ${missionFocus === 'review' || missionFocus === 'replay' ? 'border-volt/30 bg-volt/[0.045]' : 'border-white/8 bg-white/[0.025]'}`}>
          <div className="text-[12px] font-bold text-volt">Review and replay</div>
          <h4 className="mt-1 font-display text-xl font-black text-zinc-50">
            {last ? 'Last mock recovery' : 'Create the first signal'}
          </h4>
          {last ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Subject" value={display(last.subject)} />
              <Metric label="Score" value={last.score ?? 0} />
              <Metric label="Accuracy" value={`${last.accuracy ?? 0}%`} />
              <Metric label="Unattempted" value={last.unattempted ?? 0} />
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Take one diagnostic. The review layer becomes useful only after there is a real attempt.
            </p>
          )}

          <div className="mt-4 rounded-xl bg-black/20 p-3">
            <div className="text-sm font-bold text-zinc-100">{replay.title}</div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{replay.pattern}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{replay.pass}</p>
          </div>

          {weak.length ? (
            <div className="mt-3 space-y-2">
              {weak.slice(0, 2).map((item) => (
                <div key={`${item.subject}_${item.chapter}`} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-zinc-300">{display(item.subject)}: {item.chapter}</span>
                  <span className="text-zinc-500">{item.accuracy}%</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onAction(replay.action)}
              className="min-h-11 rounded-xl bg-white/[0.07] px-4 text-sm font-bold text-zinc-100"
            >
              {replay.action.label}
            </button>
            <button
              type="button"
              onClick={() => isPaid ? onAction({ type: 'ask', prompt: 'Analyze my last mock.', mode: 'autopsy' }) : onAction({ type: 'navigate', route: '/pricing?reason=mock_autopsy' })}
              className="min-h-11 rounded-xl bg-volt px-4 font-display text-sm font-black text-zinc-950"
            >
              {isPaid ? 'Run autopsy' : 'Upgrade for autopsy'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MissionBlock({ item, active, index, total, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22 }}
      className={`relative grid gap-3 overflow-hidden rounded-2xl border p-3 pl-14 sm:grid-cols-[92px_1fr_auto] sm:items-center sm:pl-14 ${
        active ? 'border-volt/32 bg-volt/[0.055]' : 'border-white/8 bg-black/20'
      }`}
    >
      {index < total - 1 ? (
        <span className="absolute bottom-[-18px] left-[25px] top-11 w-px bg-gradient-to-b from-volt/34 via-white/10 to-transparent" aria-hidden="true" />
      ) : null}
      <span className={`absolute left-[18px] top-5 flex h-4 w-4 items-center justify-center rounded-full border ${
        active ? 'border-volt bg-volt shadow-[0_0_20px_rgba(210,240,0,0.24)]' : 'border-white/16 bg-[#0b0d08]'
      }`} aria-hidden="true">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-zinc-950' : 'bg-zinc-600'}`} />
      </span>
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{item.time}</div>
      <div className="min-w-0">
        <div className="font-display text-[15px] font-black leading-tight text-zinc-50 sm:text-base">{item.title}</div>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{item.body}</p>
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => onAction(item.action)}
          className="min-h-10 rounded-full border border-white/8 bg-white/[0.07] px-3 text-sm font-bold text-zinc-100 transition hover:border-volt/20 hover:bg-white/[0.11]"
        >
          {item.action.label}
        </button>
      ) : null}
    </motion.div>
  );
}

function GuideSection({ currentPage, isAuthenticated, isPaid, wallet, aiTotal, notice, onAction, onPack }) {
  return (
    <section className="space-y-5 p-5">
      <div>
        <div className="text-[12px] font-bold text-volt">Tools</div>
        <h3 className="mt-1 font-display text-3xl font-black text-zinc-50">The useful layer.</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Routes, credits, and feature explanations live here so PrepOS and Missions stay clean.
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="font-display text-base font-black text-zinc-50">{currentPage.title}</div>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{currentPage.body}</p>
        <button
          type="button"
          onClick={() => onAction(currentPage.primary)}
          className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.1]"
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
      <div className="font-display text-base font-black text-zinc-50">PrepOS credits</div>
      <p className="mt-1 text-sm leading-6 text-zinc-400">
        Standard guidance uses your monthly PrepOS allowance. Deeper autopsy and DU-target work spends more.
      </p>
      {isAuthenticated ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Balance" value={aiTotal ?? wallet?.total ?? 0} />
          <Metric label="Included" value={`${wallet?.includedRemaining ?? 0}/${wallet?.includedMonthlyCredits ?? (isPaid ? 50 : 10)}`} />
          <Metric label="Bonus" value={wallet?.bonusCredits ?? 0} />
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-black/20 p-3 text-sm leading-6 text-zinc-400">
          Create an account to unlock your monthly PrepOS allowance.
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
              <span className="text-xs font-bold text-volt">₹{pack.amount}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{pack.description}</p>
          </button>
        ))}
      </div>
      {notice ? (
        <InfoStrip tone="warn">
          {notice} <Link href="/pricing/prepos?source=assistant" className="font-bold text-volt no-underline">Open PrepOS credits</Link>
        </InfoStrip>
      ) : null}
    </div>
  );
}

function SectionRail({ activeSection, setActiveSection }) {
  return (
    <nav className="grid border-t border-white/8 bg-[#090a08] px-2 py-2" style={{ gridTemplateColumns: `repeat(${HUB_SECTIONS.length}, minmax(0, 1fr))` }}>
      {HUB_SECTIONS.map((section) => (
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

function CommandInput({ input, pending, isAuthenticated, setupProfile, compact = false, onInput, onSend, onAction }) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);
  const trimmed = input.trim();
  const showPalette = focused && trimmed.startsWith('/');
  const filteredCommands = useMemo(() => {
    if (!showPalette) return PREPOS_COMMANDS;
    return PREPOS_COMMANDS.filter((command) => (
      command.prefix.startsWith(trimmed.toLowerCase()) ||
      command.label.toLowerCase().includes(trimmed.slice(1).toLowerCase())
    ));
  }, [showPalette, trimmed]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(168, Math.max(48, node.scrollHeight))}px`;
  }, [input, focused]);

  function submit() {
    if (!trimmed || pending) return;
    onSend(input);
  }

  function chooseCommand(command) {
    onInput('');
    setFocused(false);
    onAction(command.action);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setFocused(false);
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <motion.form
      initial={false}
      animate={{
        borderRadius: focused || input || compact ? 24 : 30,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="relative w-full max-w-full border border-white/10 bg-black/30 p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <AnimatePresence>
        {showPalette && filteredCommands.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="mb-2 overflow-hidden rounded-2xl border border-white/10 bg-[#080a07]/95 p-1 shadow-2xl backdrop-blur-xl"
          >
            {filteredCommands.map((command) => (
              <button
                key={command.prefix}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseCommand(command)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-volt/[0.08] text-volt">
                  <Icon name={command.icon} style={{ width: 15, height: 15 }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-100">{command.label}</span>
                  <span className="block text-xs text-zinc-500">{command.body}</span>
                </span>
                <span className="font-mono text-xs text-zinc-500">{command.prefix}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center sm:flex">
          <PrepOSOrb size={28} active={focused || pending} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`${compact ? 'sr-only' : 'mb-2 flex'} flex-wrap items-center justify-between gap-2 px-1 sm:px-2`}>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
              {setupProfile ? 'Command layer' : 'Setup first, or ask directly'}
            </span>
            <span className="hidden text-[11px] font-semibold text-zinc-600 sm:inline">
              Enter sends · Shift Enter breaks
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAuthenticated ? (compact ? 'Reply to PrepOS...' : 'Ask PrepOS...') : 'Ask MockMob...'}
            className="block max-h-[168px] min-h-12 w-full resize-none overflow-y-auto rounded-2xl border border-transparent bg-white/[0.035] px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-volt/25 focus:bg-white/[0.05]"
          />
        </div>
        <button
          type="submit"
          disabled={!trimmed || pending}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-volt text-zinc-950 shadow-[0_0_24px_rgba(210,240,0,0.18)] transition hover:scale-[1.02] disabled:scale-100 disabled:bg-white/[0.08] disabled:text-zinc-600"
          aria-label="Send message to PrepOS"
        >
          <Icon name="arrow" style={{ width: 17, height: 17 }} />
        </button>
      </div>

      {!compact ? <div className="mt-2 grid grid-cols-2 gap-2 px-1 pb-1 sm:flex sm:flex-wrap">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => onSend(prompt.prompt, prompt.mode)}
            className="min-h-10 rounded-full border border-white/8 bg-white/[0.035] px-3 py-2 text-center text-xs font-semibold text-zinc-400 transition hover:border-volt/20 hover:bg-volt/[0.07] hover:text-zinc-100 sm:min-h-0 sm:w-auto sm:text-left"
          >
            {prompt.label}
          </button>
        ))}
      </div> : null}
    </motion.form>
  );
}

function PrepTile({ icon, title, body, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-3 text-left transition ${
        active
          ? 'border-volt/28 bg-volt/[0.07]'
          : 'border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          active ? 'bg-volt text-zinc-950' : 'bg-black/28 text-zinc-500 group-hover:text-volt'
        }`}>
          <Icon name={icon} style={{ width: 15, height: 15 }} />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-black text-zinc-50">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">{body}</span>
        </span>
      </div>
    </button>
  );
}

function SetupReadyCard({ setupProfile, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex max-w-[94%] gap-3"
    >
      <PrepOSOrb size={32} active />
      <div className="min-w-0 rounded-2xl rounded-tl-md border border-white/8 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-zinc-300">
        <div className="font-display text-base font-black text-zinc-50">Your setup is tuned.</div>
        <p className="mt-1">
          How can I help you today? Your {setupProfile.dailyMinutes}-minute plan is ready: missions, replan, benchmark, and review can all start from this chat.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAction({ type: 'section', section: 'mission' })} className="rounded-xl bg-white/[0.07] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.11]">
            Open missions
          </button>
          <button type="button" onClick={() => onAction({ type: 'setup' })} className="rounded-xl bg-white/[0.07] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.11]">
            Retune setup
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ChatMessage({ message, onAction }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md bg-volt px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_12px_32px_rgba(210,240,0,0.12)]"
      >
        {message.text}
      </motion.div>
    );
  }
  const response = message.response || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex max-w-[94%] gap-3"
    >
      <PrepOSOrb size={30} active />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/8 bg-white/[0.035] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
        <div className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">PrepOS</div>
        <p className="text-sm leading-6 text-zinc-200">{response.reply || message.text}</p>
        {response.reason ? <p className="mt-2 text-xs leading-5 text-zinc-500">{response.reason}</p> : null}
        {Array.isArray(response.cards) && response.cards.length ? (
          <div className="mt-3 space-y-2">
            {response.cards.slice(0, response.cardLimit || 2).map((card, index) => (
              <div key={`${card.title}_${index}`} className="rounded-xl border border-white/6 bg-black/22 p-3">
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
                className="rounded-xl bg-white/[0.07] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.11]"
              >
                {action.label || labelForModelAction(action)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function PlanBuildCard({ stage = 0, profile }) {
  const activeStage = Math.min(stage, PLAN_BUILD_STEPS.length - 1);
  const progress = `${((activeStage + 1) / PLAN_BUILD_STEPS.length) * 100}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex max-w-[94%] gap-3"
    >
      <PrepOSOrb size={30} active />
      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl rounded-tl-md border border-volt/18 bg-[linear-gradient(180deg,rgba(210,240,0,0.075),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-volt">Building plan</div>
            <div className="mt-1 text-sm font-bold text-zinc-100">{display(profile?.target || 'CUET target')}</div>
          </div>
          <div className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-zinc-400">
            {profile?.dailyMinutes || 45} min
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-volt shadow-[0_0_18px_rgba(210,240,0,0.45)]"
            initial={false}
            animate={{ width: progress }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-4 grid gap-2">
          {PLAN_BUILD_STEPS.map((step, index) => (
            <div
              key={step}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                index <= activeStage
                  ? 'border-volt/18 bg-volt/[0.055] text-zinc-200'
                  : 'border-white/6 bg-black/18 text-zinc-600'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${index <= activeStage ? 'bg-volt' : 'bg-zinc-700'}`} />
              {step}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TypingLine({ label, shining = false }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-zinc-500">
      {shining ? <ShiningText text={label} /> : <span>{label}</span>}
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

function buildSetupPlanResponse({ setupProfile, context, user, pathname, benchmarkId, planVersion }) {
  const setupContext = context
    ? { ...context, setupProfile }
    : { setupProfile };
  const mission = buildTodayMission({ context: setupContext, user, pathname });
  const replay = buildMistakeReplayPlan(setupContext);
  const benchmark = BENCHMARK_OPTIONS.find((item) => item.id === benchmarkId)
    || benchmarkFromSetup(setupProfile)
    || BENCHMARK_OPTIONS[0];
  const plan = buildDailyPlan({
    mission,
    replay,
    context: setupContext,
    setupProfile,
    benchmark,
    planVersion,
  });
  const planLine = plan
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join(' ');

  return {
    reply: `Done. I built a ${setupProfile.dailyMinutes}-minute ${display(setupProfile.focus)} plan for ${display(setupProfile.target)}. ${planLine} Your next steps are ready here in chat. Ask me to replan, explain the mission, open the benchmark, or review the last mock.`,
    reason: `Setup saved: benchmark ${display(setupProfile.benchmark)}, focus ${display(setupProfile.focus)}, target ${display(setupProfile.target)}.`,
    cardLimit: 4,
    cards: plan.slice(0, 4).map((item) => ({
      title: `${item.time} - ${item.title}`,
      body: item.body,
    })),
    actions: [
      { label: 'Continue in chat', type: 'ask', prompt: 'What should I do first today?' },
      { label: 'Open Missions', type: 'section', section: 'mission' },
    ],
  };
}

function buildDailyPlan({ mission, replay, context, setupProfile, benchmark, planVersion }) {
  const minutes = Number(setupProfile?.dailyMinutes) || 45;
  const shortDay = minutes <= 30;
  const subject = context?.selectedSubjects?.[0];
  const last = context?.lastMockSummary;
  const rotated = planVersion % 2 === 0;
  const missionBlock = {
    key: 'mission',
    time: shortDay ? '10 min' : '20 min',
    title: mission.title,
    body: mission.line,
    action: mission.action,
  };
  const benchmarkBlock = {
    key: 'benchmark',
    time: shortDay ? '8 min' : '12 min',
    title: benchmark?.name || 'Daily Benchmark',
    body: benchmark?.purpose || 'One pressure check to expose the next leak.',
    action: { label: 'Choose benchmark', type: 'section', section: 'benchmark' },
  };
  const reviewBlock = {
    key: 'review',
    time: shortDay ? '5 min' : '10 min',
    title: last ? 'Review the last leak' : 'Create review signal',
    body: last
      ? `Last mock: ${display(last.subject)}, ${last.accuracy ?? 0}% accuracy, ${last.unattempted ?? 0} unattempted.`
      : 'Take one diagnostic so review stops being generic.',
    action: { label: last ? 'Open review' : 'Take diagnostic', type: last ? 'section' : 'navigate', section: 'review', route: '/dashboard?mission=diagnostic' },
  };
  const replayBlock = {
    key: 'replay',
    time: shortDay ? '7 min' : '12 min',
    title: replay.ready ? replay.title : 'Replay needs data',
    body: replay.ready ? replay.pattern : replay.reason,
    action: replay.ready ? { label: 'Open replay', type: 'section', section: 'replay' } : replay.action,
  };
  const setupBlock = {
    key: 'setup',
    time: '2 min',
    title: subject ? `${display(subject)} is the base` : 'Finish setup',
    body: subject
      ? `Target: ${setupProfile?.target || 'CUET growth'}. Focus: ${display(setupProfile?.focus || 'daily work')}.`
      : 'Pick your CUET subjects so AI can stop guessing.',
    action: subject ? null : { label: 'Set subjects', type: 'navigate', route: '/onboarding?edit=true' },
  };

  return rotated
    ? [setupBlock, benchmarkBlock, missionBlock, reviewBlock]
    : [setupBlock, missionBlock, replayBlock, benchmarkBlock, reviewBlock].slice(0, shortDay ? 4 : 5);
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

function routeForModelAction(action) {
  switch (action.action) {
    case 'create_next_mock':
      return '/dashboard?source=ai';
    case 'show_admission_path':
      return '/admission-compass';
    case 'start_revision_queue':
    case 'explain_mistake':
      return '/saved?source=ai';
    case 'upgrade_plan':
      return '/pricing?reason=ai';
    case 'buy_credits':
      return '/pricing/prepos?source=assistant';
    default:
      return null;
  }
}

function labelForModelAction(action) {
  if (action.action === 'buy_credits') return 'View credits';
  if (action.action === 'upgrade_plan') return 'View Premium';
  if (action.action === 'launch_ai_rival') return 'Open Benchmark';
  if (action.action === 'create_trap_drill') return 'Open Replay';
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

function benchmarkFromSetup(setupProfile) {
  const id = BENCHMARK_BY_SETUP[setupProfile?.benchmark];
  return BENCHMARK_OPTIONS.find((item) => item.id === id);
}

function normalizeSection(value) {
  if (value === 'ask') return 'ai';
  const ids = new Set(HUB_SECTIONS.map((section) => section.id));
  return ids.has(value) ? value : 'ai';
}

function parseSetupProfile(raw) {
  if (!raw) return null;
  try {
    return normalizeSetup(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizeSetup(value) {
  const minutes = Number(value?.dailyMinutes);
  const focus = FOCUS_OPTIONS.some((item) => item.key === value?.focus) ? value.focus : SETUP_DEFAULTS.focus;
  const benchmark = ['daily', 'speed', 'accuracy', 'weakness'].includes(value?.benchmark) ? value.benchmark : SETUP_DEFAULTS.benchmark;
  const target = TARGET_OPTIONS.includes(value?.target) ? value.target : SETUP_DEFAULTS.target;
  return {
    target,
    dailyMinutes: Number.isFinite(minutes) ? Math.min(120, Math.max(15, minutes)) : SETUP_DEFAULTS.dailyMinutes,
    focus,
    benchmark,
    updatedAt: value?.updatedAt || Date.now(),
  };
}

function display(value) {
  return String(value || 'None').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}
