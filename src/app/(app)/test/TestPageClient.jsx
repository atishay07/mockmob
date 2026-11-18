"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo, useSyncExternalStore } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageSpinner, ErrorState, NoticeState } from '@/components/ui/Skeleton';
import ArenaCompanion from '@/components/brand/ArenaCompanion';
import { api, apiGet, apiPost } from '@/lib/fetcher';
import { firstMockNotice, isFirstMockRefusal } from '@/lib/firstMockNotice.mjs';
import { forgetFirstFullMock } from '@/lib/useFirstFullMock';
import { useAuth } from '@/components/AuthProvider';
import { startMobPaper } from '@/components/mob/useMob';
import { startSundayMock } from '@/components/sunday/useSunday';
import { RUNNER_CODES, runnerProblem as sundayProblem } from '@/lib/sundayMock.mjs';
import { VoteControls } from '@/components/questions/VoteControls';
import { fineTuneScope, getMode, isValidModeId, practiceCreditCost, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { progressFromEvents, resumableDraft } from '@/../data/session_draft';
import { LATE_WINDOW_MS, answeredCount, claimedElsewhere, draftsToSweep, isSentMark, lateDraft, legacyDraftKey, newestProgress, paperDraftKey, sentMark, sentMarkMatches, storedDrafts } from '@/lib/paper/draft.mjs';
import { canOpenPaper, creditsProblem, elsewhereNotice, foreignNotice, lateNotice, placeWords, practiceHref, practiceHrefFromTest, startProblem, submitProblem, timeUpNotice, waitingCopy } from '@/lib/paper/problems.mjs';
import { loginPathFor } from '@/lib/auth-redirect';
import { plainOptionTexts } from '@/../data/option_text';
import './nta-classic.css';
import './practice-run.css';
import MobiReact from '@/components/brand/MobiReact';
import { useExamIntegrity, IntegrityOverlay } from '@/components/arena/ExamIntegrityGuard';
import NtaInstructions from '@/components/arena/NtaInstructions';
import { nextEvent, onScreenQid, endReason, captureMeta, usePresenceCapture } from '@/lib/runnerCapture';
import { shownName } from '@/lib/displayName.mjs';
import { CAP_NAMES, KEY_ROWS, keyAction } from '@/lib/paper/runnerKeys.mjs';
import { CROSS_OUT_WORDS, NO_CROSS_OUTS, bringBack, crossOutKey, crossOutKeysToClear, isCrossedOut, parseCrossOut, serialiseCrossOut, toggleCrossOut } from '@/lib/paper/crossOut.mjs';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, Strikethrough, X } from 'lucide-react';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Keys (18 Nov 2026, MockMob style only; src/lib/paper/runnerKeys.mjs decides what a key does). The Keys key and its list show
// only where a hardware keyboard is likely; the one-time hint beside it goes for good once the list is opened or a paper ends.
const KEYS_MEDIA = '(hover: hover) and (pointer: fine)';
const KEYS_HINT_KEY = 'mm:keysHint:v1';
const subscribeKeysMedia = (callback) => {
  const query = typeof window !== 'undefined' ? window.matchMedia?.(KEYS_MEDIA) : null;
  query?.addEventListener?.('change', callback);
  return () => query?.removeEventListener?.('change', callback);
};
const keysMediaSnapshot = () => !!window.matchMedia?.(KEYS_MEDIA)?.matches;
// The paper's crossed-out options as this tab kept them (their own sessionStorage entry, src/lib/paper/crossOut.mjs). Read once,
// when the runner opens; storage that cannot be read gives none.
function readCrossOuts(storageKey) {
  if (!storageKey || typeof window === 'undefined') return NO_CROSS_OUTS;
  try { return parseCrossOut(window.sessionStorage.getItem(storageKey)); } catch { return NO_CROSS_OUTS; }
}

// NTA style (5 Nov 2026, web-1105-runner): NTA's CBT screen as its own guidelines describe it (CUET (UG) 2025 Information
// Bulletin, Appendix V), in NTA's words and capitals. The home page draws the same screen (src/components/landing/ExamScreen.jsx,
// EXAM.nta in homeCopy.mjs); examPreviewParity.test.mjs holds the two word for word.
const NTA = {
  exam: 'CUET (UG)',
  questionPaper: 'Question Paper',
  candidate: 'Candidate Name',
  subjectName: 'Subject Name',
  remaining: 'Remaining Time',
  question: (n) => `Question ${n}:`,
  save: 'Save & Next',
  markNext: 'Mark for Review & Next',
  clearResponse: 'Clear Response',
  submit: 'Submit',
  paletteTitle: 'Question Palette',
  hidePalette: 'Hide the Question Palette',
  showPalette: 'Show the Question Palette',
  notSavedYet: 'Not saved yet',
  savedState: 'Saved',
};
// The section summary above the palette: NTA's five symbols, in NTA's order and words.
const NTA_LEGEND = [
  ['notvisited', 'Not Visited'],
  ['visited', 'Not Answered'],
  ['answered', 'Answered'],
  ['marked', 'Marked for Review'],
  ['marked-answered', 'Answered & Marked for Review (will be considered for evaluation)'],
];
const ntaStateName = (state) => (NTA_LEGEND.find(([key]) => key === state)?.[1] || state).replace(/ \(.*\)$/, '');
// NTA's submit summary (its own mock at nta.ac.in/Quiz, seen 17 Nov 2026): the counts in this order, then "Are you sure".
const NTA_SUMMARY = ['answered', 'visited', 'marked', 'marked-answered', 'notvisited'];
const NTA_ASK = ['Are you sure you want to submit for final marking?', 'No changes will be allowed after submission.'];
const two = (n) => String(n).padStart(2, '0');
// The runner's clock ticks this long after each second of the countdown turns (the clock effect in TestRunner).
const TICK_AFTER_MS = 20;
// This tab pressed Start on this NTA paper's instructions page (sessionStorage: one tab, kept through a reload).
const ntaStartKey = (generationKey) => `mm:nta:started:${generationKey}`;

// A small modal (NTA style's Question Paper and its submit summary): focus moves in, Tab stays inside, Escape closes, and
// focus goes back to what opened it.
function useModalFocus(open, ref, onClose) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    const dialog = ref.current;
    const opener = document.activeElement;
    (dialog?.querySelector('[data-autofocus]') || dialog?.querySelector('button'))?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled)')].filter((control) => control.tabIndex !== -1);
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected && !opener.disabled) opener.focus?.();
    };
  }, [open, ref]);
}
const subscribeConnection = callback => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
};
const connectionSnapshot = () => navigator.onLine;

// A Mob paper address without its paper key (a stale link): it can never load, so the page says so and offers the one way
// forward, never a retry that repeats the same check (R8 CONT-08). Any other /test address without a key (Repair's "Do this
// next", Saved, Ask Mobi) opens Practice with its set chosen, where the price shows before anything starts (15 Nov B3).
const MOB_LINK_EXPIRED = { kind: 'expired', title: 'This paper link has expired', message: 'Open this week’s paper from your Mob.', keys: [{ label: 'Back to your Mob', href: '/mob', primary: true }] };

const CHIP_LABELS = { answered: 'Answered', marked: 'Marked', 'marked-answered': 'Answered and marked', visited: 'Not answered', notvisited: 'Not visited' };

// Where a device-held paper's answers are, in the words of the device in hand (a touch screen is a phone).
const placeNow = () => placeWords(typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
const newTabId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// A page's keys from a notice model (src/lib/paper/problems.mjs): links, or "open the paper again". The first primary one is
// the volt key; a link to /pricing names its Pro sheet trigger.
function NoticeKeys({ keys }) {
  return <>{keys.map((key) => key.action === 'reload'
    ? <button key={key.label} type="button" onClick={() => window.location.reload()} className={`ui-state__action${key.primary ? ' ui-state__action--primary' : ''}`}>{key.label}</button>
    : <Link key={key.label} href={key.href} className={`ui-state__action${key.primary ? ' ui-state__action--primary' : ''}`} data-pro-feature={key.proFeature}>{key.label}</Link>)}</>;
}
function PaperNotice({ notice }) {
  return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <NoticeState headingLevel={1} title={notice.title} message={notice.message} actions={<NoticeKeys keys={notice.keys} />} />
    </div>
  );
}

function optionLabel(option) {
  return typeof option === 'string' ? option : option?.text ?? String(option ?? '');
}

// R8 PRAC-12: only the first letter is raised ("Medium"); chapter names print exactly as written.
const sentenceCase = (value) => { const text = String(value || ''); return text.charAt(0).toUpperCase() + text.slice(1); };

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function newGenerationKey() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// A Full mock for the subject: started directly for a Premium student (it costs them nothing), set up on
// the dashboard otherwise, where its cost is shown before it starts. One key per refusal, so following
// the link twice reopens the same Full mock.
function fullMockHref(subjectId, isPremium, key) {
  const subject = encodeURIComponent(subjectId || '');
  if (!isPremium) return `/dashboard?subject=${subject}&mode=full`;
  return `/test?subject=${subject}&count=50&mode=full&generationKey=${encodeURIComponent(key)}`;
}

const NTA_LOADING_STEPS = [
  'checking the evidence behind each question',
  'choosing your question mix',
  'creating your session',
];

// The NTA paper's loading screen: the stopwatch the Full mock and NTA start key carries (drawn, so the runner loads no
// image), its hand going round while the paper is built (owner, 15 Oct: "the clock doing a 360"). No glowing dot, no numbered badges; the steps are said once,
// in order, as what is happening (never ticked off, because the page cannot see which one the server is on).
function NtaValidationSpinner({ subjectId }) {
  return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <div className="nta-build" role="status" aria-live="polite">
        <svg className="nta-build__watch" viewBox="0 0 64 72" width="56" height="63" aria-hidden="true" focusable="false">
          <rect x="26" y="2" width="12" height="7" rx="2.5" className="nta-build__crown" />
          <rect x="30" y="8" width="4" height="6" className="nta-build__crown" />
          <circle cx="32" cy="42" r="27" className="nta-build__case" />
          <circle cx="32" cy="42" r="22.5" className="nta-build__face" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <line key={i} x1="32" y1={i % 3 ? 22.5 : 21.5} x2="32" y2={i % 3 ? 25 : 27} transform={`rotate(${i * 30} 32 42)`} className="nta-build__tick" />
          ))}
          <g className="nta-build__hand"><line x1="32" y1="42" x2="32" y2="24.5" /></g>
          <circle cx="32" cy="42" r="2.6" className="nta-build__pin" />
        </svg>
        <div className="min-w-0">
          <h1 className="nta-build__title">Building your {displayLabel(subjectId)} paper</h1>
          <p className="nta-build__line">Right now we are {NTA_LOADING_STEPS.join(', then ')}.</p>
          <p className="nta-build__line nta-build__line--quiet">This can take up to 30 seconds. Your timer starts when the questions are ready.</p>
        </div>
      </div>
    </div>
  );
}

function passageKeyFor(question) {
  return question?.passageGroupId || question?.passage_group_id || question?.group_id || question?.passageId || question?.passage_id || '';
}

function passageTextFor(question) {
  return question?.passageText || question?.passage_text || '';
}

function passageTitleFor(question) {
  return question?.passageTitle || question?.passage_title || question?.passageType || question?.passage_type || 'Reading Comprehension';
}

function getQuestionBlock(questions, index) {
  const current = questions[index];
  const key = passageKeyFor(current);
  const passageText = passageTextFor(current);
  if (!key || !passageText) {
    return {
      isPassage: false,
      passageKey: '',
      passageText: '',
      passageTitle: '',
      startIdx: index,
      endIdx: index,
      entries: current ? [{ question: current, index }] : [],
    };
  }

  const entries = questions
    .map((question, questionIndex) => ({ question, index: questionIndex }))
    .filter((entry) => passageKeyFor(entry.question) === key)
    .sort((a, b) => Number(a.question.orderIndex || 0) - Number(b.question.orderIndex || 0) || a.index - b.index);

  const indices = entries.map((entry) => entry.index);
  return {
    isPassage: true,
    passageKey: key,
    passageText,
    passageTitle: passageTitleFor(current),
    startIdx: Math.min(...indices),
    endIdx: Math.max(...indices),
    entries,
  };
}

// NTA style shows one question at a time, as the exam does (a passage question keeps its passage beside it), so its "page" is
// that one question: Previous, Save & Next and the record of what was on screen all go question by question there.
function soloBlock(questions, index) {
  const current = questions[index];
  const key = passageKeyFor(current);
  const passageText = passageTextFor(current);
  const isPassage = !!(key && passageText);
  return {
    isPassage,
    passageKey: isPassage ? key : '',
    passageText: isPassage ? passageText : '',
    passageTitle: isPassage ? passageTitleFor(current) : '',
    startIdx: index,
    endIdx: index,
    entries: current ? [{ question: current, index }] : [],
  };
}
const blockFor = (questions, index, solo) => (solo ? soloBlock(questions, index) : getQuestionBlock(questions, index));

function visitedForBlock(questions, index, solo = false) {
  const block = blockFor(questions, index, solo);
  return Object.fromEntries(block.entries.filter((entry) => entry.question?.id).map((entry) => [entry.question.id, true]));
}

function normalizeQuestionPayload(payload) {
  if (Array.isArray(payload)) return { questions: payload, meta: null };
  if (payload && Array.isArray(payload.questions)) {
    return { questions: payload.questions, meta: payload.meta || null };
  }
  return { questions: [], meta: payload?.meta || null };
}

// Practice runner (every mode except NTA): swipe, strike-out and the submit sheet.
const SWIPE_COMMIT_PX = 72;
const SWIPE_FLICK = 0.45; // px per ms
const LONG_PRESS_MS = 460;
const STRIKE_NOTE_KEY = 'mm:strikeNote:v1';
// R8 PRAC-05: the two answered states sit together and add up to the header's "N answered"; a marked question with no
// answer says so, so no label reads as a second, smaller count of the same thing. The rows always sum to the paper.
const LEGEND = [
  ['answered', 'Answered'],
  ['marked-answered', 'Answered and marked'],
  ['marked', 'Marked, no answer'],
  ['visited', 'Not answered'],
  ['notvisited', 'Not visited'],
];
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rubberBand = (dx) => Math.sign(dx) * 64 * (1 - 1 / (Math.abs(dx) / 160 + 1));

// Mobi on the practice submit sheet (never a mock, never NTA): reads the sheet, then one gesture.
function SheetMobi({ act }) {
  const alt = act === 'reading' ? 'Mobi reading your answer sheet.' : act === 'nod' ? 'Mobi nodding: every question is answered.' : act === 'point' ? 'Mobi pointing at the first question not answered.' : 'Mobi tilting its head at the questions marked for review.';
  return <div className="pr-mobi"><MobiReact act={act === 'reading' ? 'read' : act} size={60} label={alt} /></div>;
}

function resolveRunnerDurationSec(mode, questions) {
  return resolveDurationSec(mode, questions);
}

function TestRunner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, status: authStatus, refreshSession } = useAuth();

  const subjectId = searchParams.get('subject');
  const modeIdRaw = searchParams.get('mode') || 'quick';
  const modeId = isValidModeId(modeIdRaw) ? modeIdRaw : 'quick';
  const mode = getMode(modeId);
  // An older link may carry a chapter or a level its mode does not take (fineTuneScope); the server refuses those, so
  // they are left off here and the paper is the mode's own.
  const scope = fineTuneScope(modeId);
  const chapter = scope.chapters ? searchParams.get('chapter') || null : null;
  const chapters = scope.chapters ? searchParams.get('chapters') || null : null;
  const difficulty = scope.difficulty ? searchParams.get('difficulty') || null : null;
  const requestedCount = parseInt(searchParams.get('count') || '10', 10);
  const count = resolveCount(mode, requestedCount);
  const generationKey = searchParams.get('generationKey');
  const isNtaMode = modeId === 'nta';
  // An NTA-mode paper opens in NTA style (owner LK297, 17 Nov 2026: the faithful twin); ?interface=mockmob keeps MockMob's
  // screen for a student who chose it. Either can be switched inside the paper.
  const [examInterface, setExamInterface] = useState(() => searchParams.get('interface') === 'mockmob' ? 'mockmob' : 'nta');
  const classicInterface = isNtaMode && examInterface === 'nta';
  const classicRef = useRef(classicInterface);
  useEffect(() => { classicRef.current = classicInterface; }, [classicInterface]);
  // NTA style only (exam-true saving, LK297): a choice made but not yet saved by Save & Next or Mark for Review & Next. It lives
  // in this page alone, never in the draft, the events or the submit, so a reload, a second tab, the offline queue and the
  // clock running out all see saved answers only. One question is on screen at a time, so at most one choice is held.
  const [heldChoice, setHeldChoice] = useState(null); // { qid, option }
  const heldRef = useRef(null);
  const dropHeld = useCallback(() => { if (!heldRef.current) return; heldRef.current = null; setHeldChoice(null); }, []);
  // The instructions page comes before an NTA paper's clock (N1): the paper is asked for only after Start.
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [startTick, setStartTick] = useState(0);
  const startPressedRef = useRef(false);

  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visited, setVisited] = useState({});
  const [marked, setMarked] = useState({});
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  // The submit banner's sentence (a failed submit; the paper stays on screen). errorLink: its key when it is not a retry.
  const [error, setError] = useState(null);
  const [errorLink, setErrorLink] = useState(null);
  // A paper that cannot open, or can no longer be sent: a notice from src/lib/paper/problems.mjs drawn instead of the paper.
  const [problem, setProblem] = useState(null);
  // The same paper open in a newer tab ({ open: true }) or sent from one ({ sentId }) (B12): this tab stops.
  const [elsewhere, setElsewhere] = useState(null);
  // An NTA paper the bank cannot supply: { message, fullMockKey }.
  const [refusal, setRefusal] = useState(null);
  // A full mock quoted free that is not free now (release 11 verifier L1): { title, message, price, retry }. Nothing was charged.
  const [notFree, setNotFree] = useState(null);
  // A Mob's Full mock together a Free member is short of credits for (owner D174): the server's sentence. Nothing charged.
  const [mobShort, setMobShort] = useState(null);
  const [selectionMeta, setSelectionMeta] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [pendingSubmission,setPendingSubmission] = useState(false);
  const online = useSyncExternalStore(subscribeConnection, connectionSnapshot, () => true);
  const autoSubmitTried = useRef(false);
  const [showVoteCoach, setShowVoteCoach] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  // The paper notice opens by default on wide screens only: on a phone it would push the first question below the fold.
  const [noticeOpen, setNoticeOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
  const mobilePaletteTriggerRef = useRef(null);
  const mobilePaletteCloseRef = useRef(null);
  const mobilePaletteDialogRef = useRef(null);
  const fullscreenTarget = useRef(null);
  const finishExamRef = useRef(null);
  const practiceRun = !isNtaMode;
  const isMockMode = isNtaMode || modeId === 'full';
  // Hand-off between questions: the block being left, drawn under the incoming one until it fades.
  const [ghost, setGhost] = useState(null); // { startIdx, dir, from, n }
  const [navDir, setNavDir] = useState(1);
  const idxRef = useRef(0);
  const liveRef = useRef(null);
  const swipeRef = useRef(null);
  const suppressClickRef = useRef(false);
  // Crossed-out options (MockMob style), { key, map } for this paper: kept in this tab's own sessionStorage entry, so a reload of
  // the same paper keeps them (src/lib/paper/crossOut.mjs); never in the draft, never sent, never part of what is scored. Each
  // cross-out and restore is also recorded as a strike event, read only after submit (the Mistake Lab's "You crossed out B, the
  // key, at 0:41"), as before.
  // Keyed by the student too (review, 18 Nov): a Sunday Mock's key is the same for everyone, and a shared computer's tab may
  // carry one student's marks to the next.
  const crossUser = user?.id || null;
  const crossKey = useMemo(() => crossOutKey({ userId: crossUser, generationKey, sessionId: searchParams.get('sessionId') }), [crossUser, generationKey, searchParams]);
  const [struck, setStruck] = useState(() => ({ key: crossKey, map: readCrossOuts(crossKey) }));
  const struckRef = useRef(struck);
  // The student is known once sign-in answers, so the paper's key can arrive after the first render: its marks are read then.
  useEffect(() => {
    if (struckRef.current.key === crossKey) return;
    const next = { key: crossKey, map: readCrossOuts(crossKey) };
    struckRef.current = next;
    setStruck(next);
  }, [crossKey]);
  // The cross-out tool: on for one question at a time (the question's id), off on every new page, so a tap meant as an answer on
  // the next question is never taken as a cross-out.
  const [crossTool, setCrossTool] = useState(null);
  // Crossing out the chosen answer was refused: { qid, n }. The line stays until the next cross-out or page.
  const [crossNote, setCrossNote] = useState(null);
  // The option just crossed out ('qid:option'): only its line draws; marks already there (a reload, a page come back to) do not.
  const [freshStrike, setFreshStrike] = useState(null);
  // The keys list (MockMob style, where a hardware keyboard is likely) and its one-time hint.
  const keysUi = useSyncExternalStore(subscribeKeysMedia, keysMediaSnapshot, () => false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [keysHint] = useState(() => { try { return typeof window !== 'undefined' && !window.localStorage.getItem(KEYS_HINT_KEY); } catch { return false; } });
  const [keysHintGone, setKeysHintGone] = useState(false);
  const keysAnchorRef = useRef(null);
  // The paper's own box (the question area): a new page scrolls to its top, and an option pressed by its key is found in it.
  const paperRef = useRef(null);
  const pressRef = useRef(null);
  const lastStrikeAt = useRef(0);
  const [strikeNote, setStrikeNote] = useState(() => {
    if (typeof window === 'undefined' || modeId === 'nta') return false;
    try { return !window.localStorage.getItem(STRIKE_NOTE_KEY); } catch { return false; }
  });
  const [undoClear, setUndoClear] = useState(null); // { qid, answer, number, n }
  const [paletteFilter, setPaletteFilter] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mobiAct, setMobiAct] = useState('reading');
  const reviewDialogRef = useRef(null);
  const reviewReturnRef = useRef(null);
  // Leaving a running paper (R8 PRAC-02, PRAC-07): the X and any app link outside the paper (the desktop sidebar, the top
  // bar) open the product's own sheet instead of the browser's grey dialog. null when closed, else where Leave goes.
  const [exitTo, setExitTo] = useState(null);
  const exitDialogRef = useRef(null);
  const [ackSeq, setAckSeq] = useState(0);
  const [lastAnswerSeq, setLastAnswerSeq] = useState(0);
  // NTA style only: the palette's > fold (wide screens), the submit summary and the Question Paper view.
  const [ntaPaletteOpen, setNtaPaletteOpen] = useState(true);
  const [ntaSummaryOpen, setNtaSummaryOpen] = useState(false);
  const [paperViewOpen, setPaperViewOpen] = useState(false);
  const ntaPaneRef = useRef(null);
  const ntaTopRef = useRef(null);
  const ntaEndRef = useRef(null);
  const ntaSummaryRef = useRef(null);
  const paperViewRef = useRef(null);

  // The start receipt is added to the address after the server answers; it must not look like a new launch.
  const launchKey = useMemo(() => { const p = new URLSearchParams(searchParams.toString()); p.delete('startReceipt'); return p.toString(); }, [searchParams]);

  const userId = user?.id;
  const sessionIdParam = searchParams.get('sessionId');
  const launchMob = searchParams.get('mob') === '1';
  // One draft per paper, keyed by its generation key (or the session a resume link names), so a second paper never
  // overwrites a live one (15 Nov B2c). The key drafts had before is read once for the same paper, never written.
  const legacyKey = useMemo(
    () => legacyDraftKey(userId, { subject: subjectId, chapter: chapters || chapter, count, difficulty: difficulty || 'auto', modeId }),
    [userId, subjectId, chapter, chapters, count, difficulty, modeId],
  );
  const key = useMemo(
    () => paperDraftKey(userId, { generationKey, sessionId: sessionIdParam }) || legacyKey,
    [userId, generationKey, sessionIdParam, legacyKey],
  );
  // This tab's claim on the paper (B12): the newest tab to open a paper owns its draft.
  const tabIdRef = useRef(null);
  if (tabIdRef.current == null) tabIdRef.current = newTabId();
  const claimRef = useRef(null);
  // Set once the paper is sent: nothing may write its draft again.
  const sentRef = useRef(false);
  const elsewhereRef = useRef(null);
  useEffect(() => { elsewhereRef.current = elsewhere; }, [elsewhere]);
  // The balance the page last had, for the "not enough credits" sentence when the price cannot be read again.
  const balanceRef = useRef(null);
  useEffect(() => { balanceRef.current = Number.isFinite(user?.creditBalance) ? user.creditBalance : null; }, [user?.creditBalance]);
  // Where Practice sets this paper up again, and where sign-in brings the student back.
  const practiceLink = useMemo(() => practiceHrefFromTest(new URLSearchParams(launchKey)), [launchKey]);

  const answersRef = useRef(answers);
  const markedRef = useRef(marked);
  const eventsRef = useRef([]);
  const startedRef = useRef(0);
  const endsAtRef = useRef(null);
  // One event of the paper's record (src/lib/runnerCapture.js). value: the option index (or null) for an answer,
  // true or false for a mark, how the question was reached for a visit, { option, on } for a strike, the reason
  // for an end. Recording never touches React state, so nothing on the page changes because of it.
  const recordEvent = useCallback((qid, type, value) => {
    const event = nextEvent(eventsRef.current, { startedAt: startedRef.current, now: Date.now(),
      limitMs: endsAtRef.current ? endsAtRef.current - startedRef.current : undefined }, qid, type, value);
    if (event) eventsRef.current.push(event);
    return event;
  }, []);
  // A page coming on screen (data/paper_trace.js rule 5): on a passage set every other question of the set is shown
  // with it, so each is recorded as opened (via 'set') first; then the question in focus, with how it was reached.
  const recordPage = useCallback((list, index, via) => {
    const focus = list?.[index];
    if (!focus?.id) return;
    for (const entry of blockFor(list, index, classicRef.current).entries) {
      if (entry.question?.id && entry.question.id !== focus.id) recordEvent(entry.question.id, 'visit', 'set');
    }
    recordEvent(focus.id, 'visit', via);
  }, [recordEvent]);
  // A device-held session has no server row; the server's signed start time rides in the address so a
  // reload that lost the saved draft is given the same clock, never a new one.
  const rememberStart = useCallback((receipt) => {
    if (!receipt || typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('startReceipt') === receipt) return;
      url.searchParams.set('startReceipt', receipt);
      window.history.replaceState(null, '', url);
    } catch { /* the address is a convenience; the saved draft still resumes this device */ }
  }, []);
  const questionsRef = useRef(questions);
  const submittedRef = useRef(false);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { markedRef.current = marked; }, [marked]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { endsAtRef.current = endsAt; }, [endsAt]);
  // The paper is live: started, not yet submitted, and before the deadline. Away, back and strike events are
  // recorded only then.
  const paperLive = useCallback(() => !!startedRef.current && !submittedRef.current && !!endsAtRef.current && Date.now() < endsAtRef.current, []);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!subjectId) return;

    const launch = new URLSearchParams(launchKey);
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      setErrorLink(null);
      setProblem(null);
      setElsewhere(null);
      setRefusal(null);
      setNotFree(null);
      setMobShort(null);
      setSelectionMeta(null);
      setPendingSubmission(false);
      setAwaitingStart(false);
      autoSubmitTried.current = false;
      submittedRef.current = false;
      sentRef.current = false;
      claimRef.current = null;
      if (!canOpenPaper(launch)) {
        if (!alive) return;
        // A practise-this-chapter link (Repair, Saved, Ask Mobi) carries no paper key: Practice sets it up, price first (B3).
        if (launch.get('mob') === '1') { setProblem(MOB_LINK_EXPIRED); setLoading(false); }
        else router.replace(practiceHrefFromTest(launch));
        return;
      }
      const match = { generationKey, sessionId: launch.get('sessionId') };
      const claim = () => { claimRef.current = { tab: tabIdRef.current, at: Date.now() }; };

      if (typeof window !== 'undefined') {
        try {
          // Drafts whose time and keep are over go first, so storage never fills with old papers (this one is kept).
          for (const gone of draftsToSweep(storedDrafts(window.localStorage, userId), userId, Date.now(), { keep: key })) window.localStorage.removeItem(gone);
        } catch { /* storage blocked: nothing to sweep */ }
        try {
          let raw = window.localStorage.getItem(key);
          let saved = raw ? JSON.parse(raw) : null;
          // A paper started before drafts had one key each is still read from its old key, once, for the same paper.
          if (!saved && legacyKey !== key) {
            raw = window.localStorage.getItem(legacyKey);
            const old = raw ? JSON.parse(raw) : null;
            if (old && (resumableDraft(old, match) || lateDraft(old, match, Date.now()))) saved = old;
          }
          // Sent already (Back from the result, or another tab sent it): its result, never an error (B5).
          if (isSentMark(saved) && sentMarkMatches(saved, match)) {
            if (!alive) return;
            router.replace(`/result/${encodeURIComponent(saved.attemptId)}`);
            return;
          }
          // A draft of this paper that can still be sent reopens with its answers; past the deadline the time-up submit
          // sends them (B1). One whose time and grace are over but whose answers never left is reopened too and sent: the
          // server takes it as a late paper for 7 days after the timer (B8). The server's view never replaces it.
          const late = !!saved && lateDraft(saved, match, Date.now());
          if (saved && (late || resumableDraft(saved, match))) {
            if (!alive) return;
            setQuestions(saved.questions);
            eventsRef.current = saved.events || [];
            startedRef.current = saved.startedAt;
            answersRef.current = saved.answers || {};
            setAnswers(saved.answers || {});
            setVisited(saved.visited || {});
            setMarked(saved.marked || {});
            markedRef.current = saved.marked || {};
            const resumeIdx = typeof saved.idx === 'number' ? Math.min(saved.idx, saved.questions.length - 1) : 0;
            // Marks saved before they were recorded as events are added to the event log now, so the
            // server learns them too.
            if (!saved.pendingSubmission && Date.now() < saved.endsAt) {
              const recorded = progressFromEvents(eventsRef.current, saved.questions).marked;
              for (const qid of Object.keys(saved.marked || {})) if (!recorded[qid]) recordEvent(qid, 'mark', true);
              // The paper reopened on this device, on the question it was left on (last, so the time from here
              // is credited to that question).
              recordPage(saved.questions, resumeIdx, 'resume');
            }
            rememberStart(saved.selectionMeta?.startReceipt);
            setSelectionMeta(saved.selectionMeta || null);
            // The clock is read with its deadline, so its first frame is right (freshClock).
            setNow(Date.now());
            setEndsAt(saved.endsAt);
            setIdx(resumeIdx);
            setPendingSubmission(saved.pendingSubmission === true);
            claim();
            setLoading(false);
            return;
          }
        } catch {
          // Corrupted local progress should not block a fresh test load.
        }
      }

      // NTA mode opens on its instructions page (N1): nothing is asked of the server, so no clock runs, until Start. A paper
      // already running goes straight back to its clock: one with a saved draft (above), a session id, or the start receipt a
      // reload keeps in the address. Review, 17 Nov: or a Start already pressed in this tab (ntaStartKey) whose paper had not
      // arrived when the page reloaded: the server keeps that first start's clock for the same paper (practiceSessions.js, L8),
      // so the instructions page again would say the minutes start at Start while they were already running.
      const runningReceipt = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('startReceipt');
      let startedHere = false;
      try { startedHere = !!generationKey && window.sessionStorage.getItem(ntaStartKey(generationKey)) === '1'; } catch { /* storage blocked */ }
      if (isNtaMode && !startPressedRef.current && !launch.get('sessionId') && !runningReceipt && !startedHere) {
        if (!alive) return;
        setAwaitingStart(true);
        setLoading(false);
        return;
      }

      try {
        const qs = new URLSearchParams({ subject: subjectId, count: String(count), mode: modeId, includeMeta: '1' });
        if (chapters) qs.set('chapters', chapters);
        else if (chapter) qs.set('chapter', chapter);
        if (difficulty) qs.set('difficulty', difficulty);
        if (generationKey) qs.set('generationKey', generationKey);
        qs.set('experience', launch.get('recoveryFrom') ? 'recovery' : 'practice');
        if (launch.get('recoveryFrom')) qs.set('recoveryFrom', launch.get('recoveryFrom'));
        // firstFree=1: Practice's quote said this full mock is free, so the server refuses it rather than charge it if it is not now.
        for (const name of ['sessionId','episodeId','purpose','tonightKey','tonightMinutes','variant','firstFree']) if (launch.get(name)) qs.set(name, launch.get(name));
        // Same key, saved draft gone: the receipt in the address makes the server return the original start.
        const receipt = new URLSearchParams(window.location.search).get('startReceipt');
        if (receipt) qs.set('startReceipt', receipt);
        // A Mob paper (/test?mob=1) starts on the Mob's route: the server picks the frozen weekly questions and the key.
        // A Sunday Mock (/test?sunday=1) starts on its own: the server picks this week's paper and the key; only the subject goes.
        const payload = launch.get('mob') === '1' ? await startMobPaper(receipt, { mobId: launch.get('mobId'), extraId: launch.get('extra'), gameId: launch.get('game') })
          : launch.get('sunday') === '1' ? await startSundayMock(subjectId, receipt)
            : await apiPost('/api/sessions', Object.fromEntries(qs));
        if (!alive) return;

        const { questions: loadedQuestions, meta } = normalizeQuestionPayload(payload);
        setSelectionMeta(meta);
        const back = launch.get('mob') === '1' ? { label: 'Back to your Mob', href: '/mob', primary: true }
          : launch.get('sunday') === '1' ? { label: 'Back to Sunday Mock', href: '/sunday', primary: true } : { label: 'Back to Practice', href: practiceLink, primary: true };
        if (!loadedQuestions.length) {
          setProblem({ kind: 'content', title: 'This paper did not open', message: meta?.message || 'No checked questions are available for this selection. Nothing was charged.', keys: [back] });
          setLoading(false);
          return;
        }

        // A 'closest' NTA paper may be a little short; the server has already said why.
        if (isNtaMode && loadedQuestions.length !== 50 && meta?.ntaPaper?.status !== 'closest') {
          setProblem({ kind: 'content', title: 'This paper did not open', message: meta?.message || `Only ${loadedQuestions.length} usable NTA questions are ready for this subject, and an NTA paper needs 50.`, keys: [back] });
          setLoading(false);
          return;
        }

        // Phone clocks drift from the server's. Time the session on this device from
        // when it arrived, using only the server's duration, so event offsets never run
        // ahead of the server's elapsed time and the countdown is not skewed.
        const receivedAt = Date.now();
        const durationMs = Date.parse(payload.expiresAt) - Date.parse(payload.startedAt);
        const serverNow = Number.isFinite(payload.serverNow) ? payload.serverNow : Date.parse(payload.startedAt);
        const remainingMs = Date.parse(payload.expiresAt) - serverNow;
        // A device-held paper served again after its time (inside the upload grace) with no draft of it here: its answers
        // are on another device or gone. Submitting this empty copy would make an empty result final and shut out the
        // device that has them, so nothing is sent (B1).
        if (meta?.sessionTicket && Number.isFinite(remainingMs) && remainingMs <= 0) {
          setProblem(timeUpNotice({ place: placeNow(), practiceHref: practiceLink }));
          setLoading(false);
          return;
        }
        const ends = receivedAt + (Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : resolveRunnerDurationSec(mode, loadedQuestions) * 1000);
        startedRef.current = receivedAt - Math.max(0, serverNow - Date.parse(payload.startedAt));
        eventsRef.current = payload.events || [];
        // A session resumed from the server (new device, cleared storage) has its saved events: the
        // answers, the marks for review, and every question the student visited, answered or marked
        // (so the palette does not show them as "Not visited").
        const restored = progressFromEvents(eventsRef.current, loadedQuestions);
        const restoredVisited = {};
        for (const qid of restored.touched) {
          const at = loadedQuestions.findIndex((question) => question.id === qid);
          if (at >= 0) Object.assign(restoredVisited, visitedForBlock(loadedQuestions, at, classicRef.current));
        }
        // The first question, reached by a resume when the server already holds events for this session.
        recordPage(loadedQuestions, 0, eventsRef.current.length ? 'resume' : undefined);
        setQuestions(loadedQuestions);
        setAnswers(restored.answers);
        setVisited({ ...restoredVisited, ...visitedForBlock(loadedQuestions, 0, classicRef.current) });
        markedRef.current = restored.marked;
        setMarked(restored.marked);
        rememberStart(meta?.startReceipt);
        setIdx(0);
        // freshClock: the time is read with the deadline. `now` was last read when the page opened, and an NTA paper's
        // instructions page may have been open for minutes, so the paper's first frame showed that much more than the hour
        // (01:05:00 after five minutes of reading) until the first tick put it right.
        setNow(Date.now());
        setEndsAt(ends);
        claim();
        setLoading(false);
        if (false) {
          setShowVoteCoach(true);
        }
        refreshSession({ silent: true });
      } catch (e) {
        if (!alive) return;
        if (e?.code === 'MOCK_CREDITS') {
          // Full mock together: the price is on the game card; here, the two ways forward and the way back.
          setMobShort({ message: e.message });
          setLoading(false);
          return;
        }
        if (isFirstMockRefusal(e)) {
          // The free full mock this start was quoted went elsewhere (or could not be checked); nothing was charged. Every surface
          // forgets the free state, and a new quote puts the price on this page before the student starts again.
          forgetFirstFullMock();
          const fresh = e.message === 'FIRST_FULL_MOCK_TAKEN'
            ? await apiGet(`/api/practice/quote?${new URLSearchParams({ subject: subjectId, mode: 'full', count: '50' })}`).catch(() => null)
            : null;
          if (!alive) return;
          setNotFree(firstMockNotice(e, fresh, displayLabel(subjectId)));
          setLoading(false);
          return;
        }
        if (e?.message === 'INSUFFICIENT_CREDITS' || (e?.status === 402 && !/PREMIUM/.test(String(e?.message)))) {
          // Credits ran out between Practice's price and this start (another tab, another device): nothing was charged. The
          // price is read again so the page says it in Practice's words, with today's or tomorrow's included set and Pro (B6).
          const read = (params) => apiGet(`/api/practice/quote?${new URLSearchParams(params)}`).catch(() => null);
          const set = { subject: subjectId, mode: modeId, count: String(count), ...(chapters ? { chapters } : chapter ? { chapters: chapter } : {}) };
          const [quote, daily] = await Promise.all([read(set), read({ subject: subjectId, mode: 'quick', count: '10' })]);
          if (!alive) return;
          setProblem(creditsProblem({ quote, daily, ctx: { subject: subjectId, modeLabel: mode.label, cost: practiceCreditCost(modeId, count), balance: balanceRef.current, practiceHref: practiceLink } }));
          setLoading(false);
          return;
        }
        if (e?.message === 'SESSION_ALREADY_SUBMITTED' && e?.body?.detail?.attemptId) {
          // Back from a result to its paper's address: the result again, never a code (B5).
          router.replace(`/result/${encodeURIComponent(e.body.detail.attemptId)}`);
          return;
        }
        if (launch.get('sunday') === '1' && RUNNER_CODES.has(e?.message)) {
          // A Sunday Mock the server would not open (not open yet, closed, not your subject, time over): the reason in plain words.
          setProblem(sundayProblem(e));
          setLoading(false);
          return;
        }
        if (isNtaMode && e?.body?.message) {
          // The NTA engine explains a refusal in the student's terms; show its sentence as it is.
          // A refusal the question bank decides (detail.retryable false, src/lib/server/ntaPaper.js) comes back
          // the same on every retry, so it gets a way forward instead of "Try again"; a build that ran out of
          // time may still succeed on a retry.
          if (e.body.detail?.retryable === false) setRefusal({ message: e.body.message, fullMockKey: newGenerationKey() });
          else setProblem(startProblem(new Error(e.body.message), { practiceHref: practiceLink }));
          setLoading(false);
          return;
        }
        // Every other refusal is a sentence and a way forward, never the server's code (B6, B10).
        setProblem(startProblem(e, {
          practiceHref: practiceLink, modeLabel: mode.label, isNta: isNtaMode, isMob: launch.get('mob') === '1',
          loginHref: loginPathFor(`${window.location.pathname}${window.location.search}`),
        }));
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [subjectId, chapter, chapters, difficulty, count, mode, modeId, generationKey, key, legacyKey, userId, practiceLink, authStatus, refreshSession, router, isNtaMode, recordEvent, recordPage, rememberStart, launchKey, startTick]);

  // The instructions page's Start (N1). The press is the browser's permission for fullscreen, so the exam space opens now and
  // the paper arrives in it (the guard then needs no second dialog); then the paper is asked for, and its clock starts.
  const startNtaPaper = useCallback(() => {
    if (startPressedRef.current) return;
    startPressedRef.current = true;
    // Kept for this tab, so a reload before the paper arrives goes back to the running clock, not to the instructions page.
    try { if (generationKey) window.sessionStorage.setItem(ntaStartKey(generationKey), '1'); } catch { /* storage blocked */ }
    const target = fullscreenTarget.current;
    try {
      if (target?.requestFullscreen && document.fullscreenEnabled !== false && !document.fullscreenElement) target.requestFullscreen().catch(() => {});
    } catch { /* no fullscreen here: the guard's own dialog asks to stay in this window */ }
    setStartTick((n) => n + 1);
  }, [generationKey]);

  // The saved draft is also kept here, so an away can be written at once: a tab being closed may never render again.
  const draftRef = useRef(null);
  // Every write of the draft goes through here: never after the paper is sent, never over a newer tab's claim on the same
  // paper (that tab owns it now, B12), and on a full storage the old papers are swept and the write tried once more.
  const writeDraft = useCallback((draftKey, draft) => {
    if (sentRef.current || elsewhereRef.current || !claimRef.current || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      const stored = raw ? JSON.parse(raw) : null;
      if (claimedElsewhere(stored, claimRef.current)) {
        setElsewhere(isSentMark(stored) ? { sentId: stored.attemptId } : { open: true });
        return;
      }
    } catch { /* an unreadable draft is replaced */ }
    const value = JSON.stringify({ ...draft, owner: claimRef.current.tab, claimedAt: claimRef.current.at, savedAt: Date.now() });
    try { window.localStorage.setItem(draftKey, value); }
    catch {
      try {
        for (const gone of draftsToSweep(storedDrafts(window.localStorage, userId), userId, Date.now(), { keep: draftKey })) window.localStorage.removeItem(gone);
        window.localStorage.setItem(draftKey, value);
      } catch { /* private mode or a full storage: the paper goes on, held in this page */ }
    }
  }, [userId]);
  useEffect(() => {
    if (loading || !endsAt || typeof window === 'undefined') return;
    const draft = {
      v: 2,
      questions,
      answers,
      visited,
      marked,
      selectionMeta,
      generationKey,
      events: eventsRef.current,
      startedAt: startedRef.current,
      endsAt,
      idx,
      pendingSubmission,
      // What "Resume your paper" on Practice and Today needs (src/lib/paper/resume.mjs): the address with its key and receipt.
      paper: {
        href: `/test${window.location.search}`,
        subject: displayLabel(subjectId),
        mode: isNtaMode ? 'NTA mode' : launchMob ? 'Mob paper' : mode.label,
      },
    };
    draftRef.current = { key, draft };
    writeDraft(key, draft);
  }, [questions, answers, visited, marked, selectionMeta, endsAt, idx, key, loading, generationKey, pendingSubmission, writeDraft, subjectId, isNtaMode, launchMob, mode.label]);
  const saveEventsNow = useCallback(() => {
    const saved = draftRef.current;
    if (!saved || typeof window === 'undefined') return;
    writeDraft(saved.key, { ...saved.draft, events: eventsRef.current });
  }, [writeDraft]);

  // Another tab of this paper (B12): a newer claim, or a send, written to the same draft stops this tab at once.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key !== key || !event.newValue || sentRef.current) return;
      try {
        const stored = JSON.parse(event.newValue);
        if (claimedElsewhere(stored, claimRef.current)) setElsewhere(isSentMark(stored) ? { sentId: stored.attemptId } : { open: true });
      } catch { /* not a draft */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, loading]);

  useEffect(() => {
    if (!selectionMeta?.sessionId || selectionMeta.sessionTicket || loading) return;
    let busy=false; let alive=true;
    const sync=async()=>{
      if (busy || submittedRef.current || Date.now() > endsAt || !eventsRef.current.length) return;
      busy=true;
      const sentSeq = eventsRef.current.at(-1)?.seq || 0;
      try {
        await api('/api/sessions',{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({sessionId:selectionMeta.sessionId,events:eventsRef.current})});
        if(alive){setSyncStatus('saved');setAckSeq((seen) => Math.max(seen, sentSeq));}
      } catch { if(alive)setSyncStatus('pending'); }
      finally { busy=false; }
    };
    const timer=setInterval(sync,1500); window.addEventListener('online',sync);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',sync);};
  },[selectionMeta?.sessionId,selectionMeta?.sessionTicket,loading,endsAt]);

  useEffect(() => { idxRef.current = idx; }, [idx]);
  // via: how the question was reached (next, previous, palette, swipe); none for a question picked inside a passage.
  const gotoQuestion = useCallback((nextIdx, { from = 0, via } = {}) => {
    const safe = Math.max(0, Math.min(questionsRef.current.length - 1, nextIdx));
    const solo = classicRef.current;
    // NTA style: leaving a question by Previous, the palette or an arrow key does NOT save a choice made on it (NTA's own
    // instructions, point 7a); the choice is let go and the question keeps what was saved. A press that stays on the question
    // (its own palette number, the left arrow on question 1) leaves it, so nothing on screen goes for nothing.
    if (solo && safe !== idxRef.current) dropHeld();
    const newPage = questionsRef.current.length > 0
      && blockFor(questionsRef.current, idxRef.current, solo).startIdx !== blockFor(questionsRef.current, safe, solo).startIdx;
    // A new page starts with the cross-out tool off and no refusal line (MockMob style; nothing else changes).
    if (newPage) { setCrossTool(null); setCrossNote(null); setFreshStrike(null); }
    if (practiceRun && questionsRef.current.length) {
      const leaving = getQuestionBlock(questionsRef.current, idxRef.current).startIdx;
      const arriving = getQuestionBlock(questionsRef.current, safe).startIdx;
      if (leaving !== arriving) {
        const dir = arriving > leaving ? 1 : -1;
        setNavDir(dir);
        setStrikeNote(false);
        // Rapid Next and Previous presses each count; the newest hand-off replaces the last.
        if (!prefersReducedMotion()) setGhost((prev) => ({ startIdx: leaving, dir, from, n: (prev?.n || 0) + 1 }));
      }
    }
    idxRef.current = safe;
    setIdx(safe);
    // A new page records every question it shows; inside the same page only the question now in focus.
    if (newPage) recordPage(questionsRef.current, safe, via);
    else if (questionsRef.current[safe]) recordEvent(questionsRef.current[safe].id, 'visit', via);
    const patch = visitedForBlock(questionsRef.current, safe, solo);
    setVisited((prev) => ({ ...prev, ...patch }));
  }, [recordEvent, recordPage, practiceRun, dropHeld]);

  // One clock, read from the deadline (owner N8, 17 Oct: "the timer is sometimes working and sometimes it's not"). The page ticks
  // just after each whole second of the countdown, so every second shows for a full second: no 250 ms beat that made some
  // seconds look short and others stall. Coming back to the tab (a background tab's timers are slowed) reads the clock at once
  // and lines the ticks up again.
  // Review, 17 Nov: a tick lands TICK_AFTER_MS after the turn, not 1 ms. A timer may fire a little early, and the wall clock the
  // page reads (Date.now) and the clock timers run on can drift apart by a few milliseconds a minute, so a tick 1 ms after the turn
  // could slide to just before it, and that second then showed for two (a stall). Each tick also checks where it landed and lines
  // up again when it has slid too early or too late, so no second is skipped or held.
  useEffect(() => {
    if (!endsAt) return undefined;
    let align = null;
    let every = null;
    const tick = () => setNow(Date.now());
    const untilTurn = () => (((endsAt - Date.now()) % 1000) + 1000) % 1000;
    const start = () => {
      clearTimeout(align); clearInterval(every);
      tick();
      align = setTimeout(() => { tick(); every = setInterval(step, 1000); }, untilTurn() + TICK_AFTER_MS);
    };
    const step = () => {
      tick();
      const since = (1000 - untilTurn()) % 1000;
      if (since < TICK_AFTER_MS / 2 || since > TICK_AFTER_MS * 5) start();
    };
    start();
    const onVis = () => { if (!document.hidden) start(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(align); clearInterval(every);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [endsAt]);

  // Time away from the paper (spec 6, item 2), in every mode, recorded and nothing else: the page, the timer and the
  // NTA guard (which keeps its own listener and still counts the warning) do exactly what they did before. An away
  // is written to the saved draft at once, so a reload on this device still knows when the student left.
  const presenceRef = useRef(null);
  const recordPresence = useCallback((type) => {
    if (!paperLive()) return;
    if (type === 'back' ? presenceRef.current !== 'away' : presenceRef.current === 'away') return;
    if (!recordEvent(onScreenQid(eventsRef.current, questionsRef.current[idxRef.current]?.id), type)) return;
    presenceRef.current = type;
    if (type === 'away') saveEventsNow();
  }, [paperLive, recordEvent, saveEventsNow]);
  usePresenceCapture(!loading && !!endsAt, recordPresence);

  useEffect(() => {
    // Nothing runs on the instructions page yet, so leaving it asks nothing.
    if (loading || awaitingStart || submittedRef.current) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your test is in progress. Leaving will save your spot but lose focus.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [loading, awaitingStart]);

  // The phone's Back during a running paper (15 Nov B2a). On the first tap or key inside the paper (a user gesture, so
  // Android Chrome keeps the entry) one guard entry is pushed on top of the paper's own; Back then lands on the paper's
  // entry, the guard goes back on and the Leave sheet opens. It comes off before the result replaces the paper, on a
  // confirmed Leave, and when the paper can no longer be sent, so it never traps anyone.
  const guardRef = useRef(false);
  const armGuard = useCallback(() => {
    if (guardRef.current || submittedRef.current || sentRef.current || typeof window === 'undefined') return;
    try {
      if (!window.history.state?.mmPaperGuard) window.history.pushState({ mmPaperGuard: true }, '');
      guardRef.current = true;
    } catch { /* no history: Back leaves as before, and the paper can be resumed */ }
  }, []);
  const releaseGuard = useCallback(() => new Promise((resolve) => {
    const onGuard = typeof window !== 'undefined' && !!window.history.state?.mmPaperGuard;
    guardRef.current = false;
    if (!onGuard) { resolve(); return; }
    let done = false;
    let timer = null;
    const finish = () => { if (done) return; done = true; window.removeEventListener('popstate', finish); clearTimeout(timer); resolve(); };
    window.addEventListener('popstate', finish);
    timer = setTimeout(finish, 400);
    try { window.history.back(); } catch { finish(); }
  }), []);

  const integrityKey = `${key}:integrity:${selectionMeta?.sessionId || generationKey || endsAt}`;
  // reason: 'submit' (the student), 'time_up' (the timer) or 'nta_strikes' (the third NTA warning). A retry passes
  // none (or a click event) and keeps the reason of the end already recorded.
  const submitTest = useCallback(async (reason) => {
    if (submittedRef.current || sentRef.current || elsewhereRef.current) return;
    if (!user) return;
    submittedRef.current = true;
    // NTA style: a choice never saved is not sent (time-up, the third warning, or Yes on the summary that named it), so it leaves
    // the screen now. Held offline, the paper on screen then shows only what will be sent, never a choice that looks counted.
    dropHeld();
    setSubmitting(true);
    setMobilePaletteOpen(false);
    setNtaSummaryOpen(false); // NTA style: a time-up or third-warning submit closes its summary too
    // How the paper ended is its last event. A retry adds no second end unless something happened after the first.
    // Capture is data only and runs before the submit's own error handling, so it may never throw here: a throw would
    // leave the paper marked as submitting with nothing sent.
    let endedBy = null;
    try {
      const last = eventsRef.current.at(-1);
      endedBy = last?.type === 'end' ? last.reason : endReason(eventsRef.current, reason);
      if (last?.type !== 'end') recordEvent(onScreenQid(eventsRef.current, questionsRef.current[idxRef.current]?.id), 'end', endedBy);
    } catch {
      // The submit goes ahead without the end event; the server stores no end and the Lab says "at least".
    }

    // The newest progress on this device for this paper: this tab's, unless the stored draft went further (a submit never
    // carries fewer answers than the newest draft here).
    let progress = { answers: answersRef.current, events: eventsRef.current };
    try {
      const raw = window.localStorage.getItem(key);
      progress = newestProgress({ sessionId: selectionMeta?.sessionId, answers: answersRef.current, events: eventsRef.current }, raw ? JSON.parse(raw) : null);
    } catch { /* storage unreadable: this tab's own progress */ }

    try {
      const data = await apiPost('/api/attempts', {
        sessionId: selectionMeta?.sessionId,
        sessionTicket: selectionMeta?.sessionTicket,
        answers: progress.answers,
        events: progress.events.filter(e => e.at <= endsAt - startedRef.current),
        ...captureMeta({ startedAt: startedRef.current, endedBy }),
      });
      sentRef.current = true;
      await finishExamRef.current?.();
      // The draft becomes a small sent mark, so Back to this address opens the result (B5) and another tab knows (B12).
      try {
        window.localStorage.setItem(key, JSON.stringify(sentMark({ attemptId: data.id, endsAt, generationKey, sessionId: sessionIdParam, now: Date.now() })));
        window.localStorage.removeItem(integrityKey); window.localStorage.removeItem(`${key}:integrity`);
        if (legacyKey !== key) window.localStorage.removeItem(legacyKey);
      } catch {}
      try { window.sessionStorage.setItem('mm:postTest', '1'); } catch {}
      // The paper is over: its crossed-out options go with it, and the keys hint has been seen on a whole paper.
      try { if (crossKey) window.sessionStorage.removeItem(crossKey); window.localStorage.setItem(KEYS_HINT_KEY, '1'); } catch {}
      try { await refreshSession({ silent: true }); } catch {}
      // The Back guard comes off first, then the result takes the paper's place in history: Back from the result goes to
      // where the paper was started, never to the paper again.
      await releaseGuard();
      router.replace(`/result/${data.id}`);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setErrorLink(null);
      const place = placeNow();
      const said = submitProblem(e, { place, offline: !navigator.onLine, loginHref: loginPathFor(`${window.location.pathname}${window.location.search}`) });
      if (said.kind !== 'offline') console.warn('[runner] submit failed:', e?.message || e);
      if (said.kind === 'offline') {
        // Held on the device; it sends itself when the connection is back. The banner's words follow the clock (waitingCopy).
        setPendingSubmission(true);
        setError(null);
      } else if (said.kind === 'late' || said.kind === 'foreign') {
        // Past the deadline and the upload grace (B8), or another account's paper (B10): this paper cannot be sent from
        // here, so the page says so plainly, keeps the answers on the device and offers a new paper. Never "try again".
        setPendingSubmission(false);
        await releaseGuard();
        setProblem(said.kind === 'late'
          ? lateNotice({ answered: answeredCount(progress.answers), place, practiceHref: practiceLink })
          : foreignNotice({ practiceHref: practiceLink }));
      } else {
        setPendingSubmission(false);
        setError(said.message);
        if (said.link) setErrorLink(said.link);
      }
    }
  }, [user, key, legacyKey, integrityKey, router, refreshSession, selectionMeta, endsAt, recordEvent, generationKey, sessionIdParam, practiceLink, releaseGuard, dropHeld, crossKey]);
  const submitForStrikes = useCallback(() => submitTest('nta_strikes'), [submitTest]);

  // NTA mode only: leaving the tab is a strike; the third submits the session.
  const integrity = useExamIntegrity({ enabled: isNtaMode && !loading && !!endsAt, storageKey: integrityKey, fullscreenTarget, onTerminate: submitForStrikes });
  const canAnswer = integrity.canAnswer;
  useEffect(() => { finishExamRef.current = integrity.finish; }, [integrity.finish]);
  // This paper's crossed-out options (a map kept for another paper is never this one's), and the one place they change: in this
  // page first, then this tab's own entry. Never the draft, never a request.
  const crossMap = useCallback(() => (struckRef.current.key === crossKey ? struckRef.current.map : readCrossOuts(crossKey)), [crossKey]);
  const keepCrossOuts = useCallback((map) => {
    const next = { key: crossKey, map };
    struckRef.current = next;
    setStruck(next);
    if (!crossKey) return;
    try {
      const text = serialiseCrossOut(map);
      if (text) window.sessionStorage.setItem(crossKey, text);
      else window.sessionStorage.removeItem(crossKey);
    } catch { /* storage blocked or full: the marks stay in this page */ }
  }, [crossKey]);
  // Picking a crossed-out option brings it back (as the app does): the restore is recorded as a strike, on false, just
  // before the answer. Only a MockMob-style screen crosses options out, so on NTA style's screen this finds nothing to restore.
  const restoreStrike = useCallback((qid, option) => {
    const before = crossMap();
    const after = bringBack(before, qid, option);
    if (after === before) return;
    keepCrossOuts(after);
    if (paperLive()) recordEvent(qid, 'strike', { option, on: false });
  }, [crossMap, keepCrossOuts, paperLive, recordEvent]);
  const chooseAnswer = useCallback((qid, answer) => {
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return false;
    // A cross-out is a pencil mark: a fault in it may never stop the answer, so it is let go.
    if (answer !== null) { try { restoreStrike(qid, answer); } catch { /* the answer goes ahead */ } }
    recordEvent(qid, 'answer', answer);
    setLastAnswerSeq(eventsRef.current.at(-1)?.seq || 0);
    setAnswers(prev => {
      const next = { ...prev }; if (answer === null) delete next[qid]; else next[qid] = answer;
      answersRef.current = next; return next;
    });
    return true;
  }, [canAnswer, recordEvent, pendingSubmission, endsAt, submitting, restoreStrike]);

  // NTA style: choosing an option only holds it (NTA: "To save your answer, you MUST click on the Save & Next button"). Nothing
  // is recorded until a key saves it.
  const holdChoice = useCallback((qid, option) => {
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return false;
    heldRef.current = { qid, option };
    setHeldChoice({ qid, option });
    return true;
  }, [canAnswer, pendingSubmission, endsAt, submitting]);
  // Save & Next and Mark for Review & Next: the held choice becomes the saved answer (one answer event, as a tap is elsewhere).
  const saveHeld = useCallback((qid) => {
    const held = heldRef.current;
    if (!held || held.qid !== qid) return;
    dropHeld();
    if (answersRef.current[qid] !== held.option) chooseAnswer(qid, held.option);
  }, [chooseAnswer, dropHeld]);
  // Clear Response, or the chosen option pressed again: the choice and any saved answer go at once, so the screen never shows a
  // blank question that still counts.
  const clearChoice = useCallback((qid) => {
    dropHeld();
    if (answersRef.current[qid] !== undefined) chooseAnswer(qid, null);
  }, [chooseAnswer, dropHeld]);
  // A press on an option in NTA style (or its number key): the option shown as chosen, pressed again, clears it (NTA: "click on
  // the button of the chosen option again"); any other is held.
  const pickNta = useCallback((qid, option) => {
    const held = heldRef.current;
    const shown = held?.qid === qid ? held.option : answersRef.current[qid];
    if (shown === option) clearChoice(qid);
    else holdChoice(qid, option);
  }, [clearChoice, holdChoice]);
  // The switch between the two screens keeps saved answers and the clock; a choice not saved in NTA style is let go.
  // MockMob style's keys list and cross-out tool close with it (crossed-out options stay for when MockMob style comes back).
  const switchInterface = useCallback((next) => { dropHeld(); setKeysOpen(false); setCrossTool(null); setCrossNote(null); setExamInterface(next); }, [dropHeld]);

  // Mark for review is recorded like an answer: an event in the session log, so it is saved on the
  // server and comes back when the session is resumed on another device or after storage is cleared.
  const setMark = useCallback((qid, value) => {
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return;
    if (!!markedRef.current[qid] === value) return;
    recordEvent(qid, 'mark', value);
    const next = { ...markedRef.current };
    if (value) next[qid] = true; else delete next[qid];
    markedRef.current = next;
    setMarked(next);
  }, [canAnswer, recordEvent, pendingSubmission, endsAt, submitting]);

  const toggleStrike = useCallback((qid, option) => {
    // Only while an answer could change too: never once the paper is sending, held, over, or locked by an NTA warning.
    if (!canAnswer() || submittedRef.current || submitting || pendingSubmission || (endsAt && Date.now() >= endsAt)) return false;
    const question = questionsRef.current.find((item) => item.id === qid);
    // The chosen option is never crossed out (as in the app): the answer stays and the page says why. Picking a crossed-out
    // one brings it back (chooseAnswer).
    const { state, outcome } = toggleCrossOut(crossMap(), qid, option, { chosen: answersRef.current[qid], optionCount: question?.options?.length || 0 });
    if (outcome === 'refused') { setCrossNote((prev) => ({ qid, n: (prev?.n || 0) + 1 })); return false; }
    if (outcome !== 'crossed' && outcome !== 'restored') return false;
    lastStrikeAt.current = Date.now();
    setStrikeNote(false);
    setCrossNote(null);
    setFreshStrike(outcome === 'crossed' ? `${qid}:${option}` : null);
    keepCrossOuts(state);
    if (paperLive()) recordEvent(qid, 'strike', { option, on: outcome === 'crossed' });
    return true;
  }, [canAnswer, submitting, pendingSubmission, endsAt, crossMap, keepCrossOuts, paperLive, recordEvent]);
  // The tool row's Cross out key (and X): on for this question, or off.
  const toggleCrossTool = useCallback((qid) => {
    setCrossNote(null);
    setFreshStrike(null);
    setStrikeNote(false);
    setCrossTool((current) => (current === qid ? null : qid));
  }, []);
  // A press on an option, by a tap, a click or its key: a cross-out while the tool is on (or with Shift), else the answer, by the
  // one handler a tap always used. Inside a passage set the answered question becomes current, so Clear and Mark act on it.
  const pressOption = useCallback((question, questionIndex, option, cross) => {
    if (cross) return toggleStrike(question.id, option);
    const chosen = chooseAnswer(question.id, option);
    if (questionIndex !== idxRef.current) gotoQuestion(questionIndex);
    return chosen;
  }, [toggleStrike, chooseAnswer, gotoQuestion]);
  // An option pressed by its key takes focus, so it shows the same chosen (or crossed-out) state a tap leaves, and a screen
  // reader says it.
  const focusOption = useCallback((qid, option) => {
    const target = [...(paperRef.current?.querySelectorAll('.nta-option') || [])].find((el) => el.getAttribute('data-option') === `${qid}:${option}`);
    target?.focus?.();
  }, []);
  // The keys list: opening it once retires the hint for good.
  const retireKeysHint = useCallback(() => {
    setKeysHintGone(true);
    try { window.localStorage.setItem(KEYS_HINT_KEY, '1'); } catch { /* the hint may show once more */ }
  }, []);
  const toggleKeys = useCallback(() => { setKeysOpen((open) => !open); retireKeysHint(); }, [retireKeysHint]);

  // The submit sheet (and the NTA submit check) sits over the question in focus. Opening it is recorded as a visit with
  // via 'sheet', so the time spent deciding to submit is credited to no question (data/paper_trace.js rule 6); going
  // back to the paper without submitting is a plain visit to the question in focus. Data only: nothing on the page
  // changes because of either.
  const recordSheet = useCallback((open) => {
    if (!paperLive()) return;
    // It runs just before the NTA submit check and the sheet opening: capture may never stop either.
    try {
      recordEvent(onScreenQid(eventsRef.current, questionsRef.current[idxRef.current]?.id), 'visit', open ? 'sheet' : undefined);
    } catch {
      // The record misses this sheet; the submit and the page go ahead exactly as without capture.
    }
  }, [paperLive, recordEvent]);
  const closeReview = useCallback(() => {
    setReviewOpen(false);
    recordSheet(false);
  }, [recordSheet]);
  // NTA style's submit summary is the NTA submit check: opening it is the same 'sheet' visit, closing it the plain one.
  const closeNtaSummary = useCallback(() => {
    setNtaSummaryOpen(false);
    recordSheet(false);
  }, [recordSheet]);
  const closePaperView = useCallback(() => setPaperViewOpen(false), []);
  useModalFocus(ntaSummaryOpen && classicInterface, ntaSummaryRef, closeNtaSummary);
  useModalFocus(paperViewOpen && classicInterface, paperViewRef, closePaperView);
  const closeExit = useCallback(() => setExitTo(null), []);
  useModalFocus(!!exitTo, exitDialogRef, closeExit);
  // While the paper runs, a click on any app link outside it asks first, as the X does: one rule on phone and desktop. A
  // real tab close keeps the browser's own beforeunload guard. Modified clicks (new tab) and other-site links pass through.
  const paperRunning = !loading && questions.length > 0;
  useEffect(() => {
    if (!paperRunning) return undefined;
    const onClick = (event) => {
      if (submittedRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target?.closest?.('a[href]');
      if (!link || fullscreenTarget.current?.contains(link) || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setExitTo(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [paperRunning]);

  // The Back guard while the paper runs (B2a; armGuard and releaseGuard above). An NTA warning on screen is a modal of its
  // own, so Back then only keeps the student on the paper.
  const integrityAlertRef = useRef(null);
  useEffect(() => { integrityAlertRef.current = integrity.alert; }, [integrity.alert]);
  const guardLive = paperRunning && !problem && !elsewhere;
  useEffect(() => {
    if (!guardLive || typeof window === 'undefined') return undefined;
    if (window.history.state?.mmPaperGuard) guardRef.current = true; // reopened on its own guard entry (a reload)
    const path = window.location.pathname;
    const arm = () => armGuard();
    const onPop = () => {
      if (!guardRef.current) return;
      // Back went past the paper (the browser skipped entries): nothing to hold.
      if (window.location.pathname !== path || new URLSearchParams(window.location.search).get('generationKey') !== generationKey) { guardRef.current = false; return; }
      try { window.history.pushState({ mmPaperGuard: true }, ''); } catch { guardRef.current = false; return; }
      if (submittedRef.current || (isNtaMode && integrityAlertRef.current)) return;
      setExitTo((open) => open || '/dashboard');
    };
    document.addEventListener('click', arm, true);
    document.addEventListener('keydown', arm, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', arm, true);
      document.removeEventListener('keydown', arm, true);
      window.removeEventListener('popstate', onPop);
    };
  }, [guardLive, armGuard, generationKey, isNtaMode]);
  // A notice in the paper's place (it cannot be sent from here, or it is open in another tab): the guard comes off.
  useEffect(() => { if (problem || elsewhere) releaseGuard(); }, [problem, elsewhere, releaseGuard]);
  // An NTA paper that could not open after Start (which opened fullscreen) says why in the normal window, not in the exam space.
  // Only before any question arrived: once a paper runs, its exam space is the integrity guard's to keep.
  const opened = questions.length > 0;
  useEffect(() => {
    if (opened || !(problem || elsewhere || refusal || notFree || mobShort) || typeof document === 'undefined' || !document.fullscreenElement) return;
    document.exitFullscreen?.().catch(() => {});
  }, [opened, problem, elsewhere, refusal, notFree, mobShort]);
  const leavePaper = useCallback(async () => {
    const to = exitTo;
    setExitTo(null);
    await releaseGuard();
    router.push(to);
  }, [exitTo, releaseGuard, router]);

  const timeLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  // A paper held for a connection sends itself when the connection is back, and once at once when it reopens online. Past the
  // upload grace it is still tried once: the server decides, and a refusal ends in the plain notice, never a retry loop (B8).
  const pendingTriedRef = useRef(false);
  useEffect(() => {
    if (!pendingSubmission) { pendingTriedRef.current = false; return undefined; }
    const reconnect = () => submitTest();
    if (!pendingTriedRef.current && navigator.onLine && !loading) { pendingTriedRef.current = true; submitTest(); }
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [pendingSubmission, submitTest, loading]);
  useEffect(() => {
    if (!endsAt || elsewhere || problem) return;
    if (timeLeft <= 0 && !submittedRef.current && !loading && !autoSubmitTried.current){autoSubmitTried.current=true;submitTest('time_up');}
  }, [timeLeft, endsAt, loading, submitTest, elsewhere, problem]);

  // Another paper opened in this tab: the crossed-out options kept for any other paper go (this paper's own stay).
  useEffect(() => {
    if (loading || !questions.length || !crossKey || typeof window === 'undefined') return;
    try {
      const store = window.sessionStorage;
      const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
      for (const gone of crossOutKeysToClear(keys, { keep: crossKey })) store.removeItem(gone);
    } catch { /* storage blocked: nothing was kept to clear */ }
  }, [loading, questions.length, crossKey]);

  useEffect(() => {
    // Review, 18 Nov: a notice in the paper's place (it cannot be sent from here, or a newer tab has it) takes no key, so nothing
    // is answered or recorded on a paper that is not on screen.
    if (loading || !questions.length || problem || elsewhere) return;
    const onKeyDown = (event) => {
      // NTA style keeps exactly the keys it had (1 to 4 hold a choice as a press does; the arrows move without saving) and gets
      // none of MockMob's: it is the exam hall's twin.
      if (classicRef.current) {
        if (!canAnswer()) return;
        const tag = event.target?.tagName;
        if (mobilePaletteOpen || ntaSummaryOpen || paperViewOpen || exitTo || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        const block = blockFor(questionsRef.current, idx, true);
        if (reviewOpen) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          gotoQuestion(block.startIdx - 1, { via: 'previous' });
        } else if (event.key === 'ArrowRight' && block.endIdx < questionsRef.current.length - 1) {
          event.preventDefault();
          gotoQuestion(block.endIdx + 1, { via: 'next' });
        } else if (/^[1-4]$/.test(event.key)) {
          event.preventDefault();
          const active = questionsRef.current[idx];
          // Only an option the question has: an answer index the server would refuse would stop the whole paper being sent.
          if (active?.id && Number(event.key) <= (active.options?.length || 0)) pickNta(active.id, Number(event.key) - 1);
        }
        return;
      }
      // MockMob style: src/lib/paper/runnerKeys.mjs says what a key does; this only does it.
      const active = questionsRef.current[idx];
      const page = blockFor(questionsRef.current, idx, false);
      const ends = endsAtRef.current;
      const action = keyAction(event, {
        style: 'mockmob',
        started: !!startedRef.current && !!ends,
        loading: false,
        submitting: submitting || pendingSubmission,
        ended: submittedRef.current || sentRef.current || (!!ends && Date.now() >= ends),
        dialogOpen: !canAnswer() || reviewOpen || !!exitTo || ntaSummaryOpen || paperViewOpen,
        paletteOpen: mobilePaletteOpen,
        keysOpen: keysOpen && keysUi,
        keysUi,
        crossTool: !!active?.id && crossTool === active.id,
        optionCount: active?.options?.length || 0,
        canMark: true,
        atFirst: page.startIdx === 0,
        atLast: page.endIdx >= questionsRef.current.length - 1,
      });
      if (!action) return;
      event.preventDefault();
      // keys: dispatch. Each action runs the handler its own control runs. None sends, ends or leaves the paper or confirms a
      // dialog: runnerKeys has no such action, and Next on the last page is no action at all.
      const name = action.name;
      if (name === 'choose' || name === 'cross') {
        if (!active?.id) return;
        pressOption(active, idx, action.option, name === 'cross');
        focusOption(active.id, action.option);
      } else if (name === 'next') gotoQuestion(page.endIdx + 1, { via: 'next' });
      else if (name === 'previous') gotoQuestion(page.startIdx - 1, { via: 'previous' });
      else if (name === 'mark') { if (active?.id) setMark(active.id, !markedRef.current[active.id]); }
      else if (name === 'tool') { if (active?.id) toggleCrossTool(active.id); }
      else if (name === 'keys') toggleKeys();
      else if (name === 'close-keys') setKeysOpen(false);
      else if (name === 'close-palette') setMobilePaletteOpen(false);
      // keys: dispatch end
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, questions.length, problem, elsewhere, idx, gotoQuestion, pickNta, mobilePaletteOpen, ntaSummaryOpen, paperViewOpen, exitTo, canAnswer, reviewOpen, submitting, pendingSubmission, keysOpen, keysUi, crossTool, pressOption, focusOption, setMark, toggleCrossTool, toggleKeys]);

  // The keys list closes on a press anywhere outside the Keys key and the list (it is not a modal: focus is not held and a press
  // behind it works; only the keys wait, except ? and Esc, until it closes).
  useEffect(() => {
    if (!keysOpen) return undefined;
    const onDown = (event) => { if (!keysAnchorRef.current?.contains(event.target)) setKeysOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [keysOpen]);

  useEffect(() => {
    if (!mobilePaletteOpen) return undefined;
    const dialog = mobilePaletteDialogRef.current;
    if (!dialog) return undefined;
    const trigger = mobilePaletteTriggerRef.current;

    const onDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobilePaletteOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
        .filter((control) => control.getAttribute('aria-hidden') !== 'true');
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    mobilePaletteCloseRef.current?.focus();
    document.addEventListener('keydown', onDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', onDialogKeyDown);
      trigger?.focus();
    };
  }, [mobilePaletteOpen]);

  // A new question or passage set starts at its top, below the sticky header.
  const shownBlockRef = useRef(null);
  const currentBlockStart = questions.length ? blockFor(questions, idx, classicInterface).startIdx : null;
  useEffect(() => {
    if (currentBlockStart == null) return;
    if (shownBlockRef.current != null && shownBlockRef.current !== currentBlockStart) {
      const paper = paperRef.current;
      if (paper && paper.getBoundingClientRect().top < 120) paper.scrollIntoView({ block: 'start' });
      // NTA style on a wide screen: the question area scrolls on its own, and a new question starts at its top.
      if (ntaPaneRef.current) ntaPaneRef.current.scrollTop = 0;
    }
    shownBlockRef.current = currentBlockStart;
  }, [currentBlockStart]);

  // The chosen answer is drawn on its own option (practice-run.css: an ink that grows from the letter, clipped to the
  // option), so nothing travels between options and only one outlined box is ever on screen (owner F10).

  // Press and hold (or right-click) an option to cross it out.
  const cancelPress = useCallback(() => {
    clearTimeout(pressRef.current?.timer);
    pressRef.current = null;
  }, []);
  const startPress = useCallback((event, qid, option) => {
    if (event.button > 0) return;
    cancelPress();
    pressRef.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
      pressRef.current = null;
      suppressClickRef.current = true;
      if (toggleStrike(qid, option)) navigator.vibrate?.(8);
    }, LONG_PRESS_MS) };
  }, [cancelPress, toggleStrike]);
  const movePress = useCallback((event) => {
    const press = pressRef.current;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
  }, [cancelPress]);
  const strikeFromMenu = useCallback((event, qid, option) => {
    event.preventDefault();
    if (Date.now() - lastStrikeAt.current < 800) return; // the long press already did it
    cancelPress();
    toggleStrike(qid, option);
  }, [cancelPress, toggleStrike]);

  // The strike note shows once on this device.
  const strikeNoteVisible = practiceRun && strikeNote && !loading && questions.length > 0;
  useEffect(() => {
    if (!strikeNoteVisible) return;
    try { window.localStorage.setItem(STRIKE_NOTE_KEY, '1'); } catch { /* the note may show again; harmless */ }
  }, [strikeNoteVisible]);

  // The outgoing block leaves when its fade ends; this timer covers a page whose animations are paused.
  useEffect(() => {
    if (!ghost) return undefined;
    const timer = setTimeout(() => setGhost((current) => (current?.n === ghost.n ? null : current)), 420);
    return () => clearTimeout(timer);
  }, [ghost]);

  // 'Answer cleared. Undo' stays for four seconds.
  useEffect(() => {
    if (!undoClear) return undefined;
    const timer = setTimeout(() => setUndoClear(null), 4000);
    return () => clearTimeout(timer);
  }, [undoClear]);

  // Submit sheet: Mobi reads it, then reacts once; Escape closes; Tab stays inside.
  useEffect(() => {
    if (!reviewOpen) return undefined;
    const dialog = reviewDialogRef.current;
    const timer = setTimeout(() => setMobiAct('react'), prefersReducedMotion() ? 0 : 900);
    dialog?.querySelector('[data-autofocus]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeReview(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled)')].filter((control) => control.tabIndex !== -1);
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      reviewReturnRef.current?.focus?.();
    };
  }, [reviewOpen, closeReview]);

  if (!subjectId) return (
    <div className="container-narrow max-w-3xl pt-10">
      <ErrorState title="No subject picked" message="Pick a subject to start a paper." />
      <div className="mt-4">
        {/* A Mob paper that could not start leads back to the Mob, where the reason and the next step already are. */}
        {searchParams.get('mob') === '1' ? (
          <Button variant="outline" onClick={() => router.push('/mob')}>
            <Icon name="home" /> Back to your Mob
          </Button>
        ) : (
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <Icon name="home" /> Go to Practice
          </Button>
        )}
      </div>
    </div>
  );

  if (authStatus === 'loading') return <PageSpinner label="Loading test..." />;
  // NTA mode: the instructions page, then the paper being built, are drawn in the runner's own frame (the same element the
  // paper is drawn in), so the fullscreen Start opened stays open while the questions arrive.
  if (isNtaMode && awaitingStart && !loading) return (
    <div ref={fullscreenTarget} className="nta-runner" data-interface="nta" data-phase="instructions">
      <NtaInstructions
        subject={displayLabel(subjectId)}
        questions={mode.fixedCount}
        minutes={Math.round(mode.fixedDurationSec / 60)}
        marking={mode.marking}
        screen={examInterface}
        backHref={practiceLink}
        onStart={startNtaPaper}
      />
    </div>
  );
  if (loading && isNtaMode) return (
    <div ref={fullscreenTarget} className="nta-runner" data-interface={examInterface} data-phase="building">
      <NtaValidationSpinner subjectId={subjectId} />
    </div>
  );
  if (loading) return <div className="container-narrow px-4 pt-10"><ArenaCompanion pose="attentive" title="One question at a time.">Opening your session. Your timer appears when the questions are ready; Mobi stays outside while you answer.</ArenaCompanion><p role="status">Loading practice…</p></div>;

  if (refusal) return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <NoticeState
        headingLevel={1}
        title={`No NTA paper for ${displayLabel(subjectId)} yet`}
        message={refusal.message}
        actions={<>
          <Link href={fullMockHref(subjectId, user?.isPremium === true, refusal.fullMockKey)} className="ui-state__action ui-state__action--primary">Start a Full mock</Link>
          <Link href="/dashboard" className="ui-state__action">Back to Practice</Link>
        </>}
      />
    </div>
  );

  if (notFree) return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <NoticeState
        headingLevel={1}
        title={notFree.title}
        message={<>{notFree.message}{notFree.price ? <> <b>{notFree.price}</b></> : null}</>}
        actions={<>
          {notFree.retry
            ? <button type="button" onClick={() => window.location.reload()} className="ui-state__action ui-state__action--primary">Try again</button>
            : <Link href={`/dashboard?subject=${encodeURIComponent(subjectId || '')}&mode=full`} className="ui-state__action ui-state__action--primary">Set up a full mock</Link>}
          <Link href="/dashboard" className="ui-state__action">Back to Practice</Link>
        </>}
      />
    </div>
  );

  if (mobShort) return (
    <div className="container-narrow max-w-3xl px-4 pt-10">
      <NoticeState
        headingLevel={1}
        title="Not enough credits for this full mock"
        message={mobShort.message}
        actions={<>
          <Link href="/wallet" className="ui-state__action ui-state__action--primary">Add credits</Link>
          <Link href="/pricing" className="ui-state__action" data-pro-feature="mob_full_mock">Get Pro</Link>
          <Link href="/mob" className="ui-state__action">Back to your Mob</Link>
        </>}
      />
    </div>
  );

  // A paper that cannot open or can no longer be sent (B3, B5, B6, B8, B10), and a paper open in a newer tab (B12): a
  // sentence and a way forward in the paper's place.
  if (problem) return <PaperNotice notice={problem} />;
  if (elsewhere) return <PaperNotice notice={elsewhereNotice({ sentId: elsewhere.sentId })} />;

  if (!questions.length) return <PaperNotice notice={{ title: 'This paper did not open', message: 'No questions came back for it. Nothing was charged.', keys: [{ label: 'Back to Practice', href: practiceLink, primary: true }] }} />;

  const q = questions[idx];
  const block = blockFor(questions, idx, classicInterface);
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((idx + 1) / questions.length) * 100;
  const answered = Object.keys(answers).filter((answerId) => answers[answerId] !== undefined).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const notVisitedCount = questions.filter((question) => !visited[question.id]).length;
  const pendingCount = questions.length - answered;
  const lowTime = timeLeft < 60;
  const isLastBlock = block.endIdx >= questions.length - 1;
  // This paper's crossed-out options (MockMob style), and whether the paper still takes a press (the keys list closes, and its
  // key rests, once it is sending, held or over).
  const crossMarks = struck.key === crossKey ? struck.map : NO_CROSS_OUTS;
  const paperOver = submitting || pendingSubmission || timeLeft <= 0;
  const keysShown = keysUi && keysOpen && !paperOver;
  // The submit banner's words: a paper held for a connection says what happens next (waitingCopy); any other failed send,
  // its sentence (submitProblem). Never a code.
  const submitNote = pendingSubmission
    ? waitingCopy({ ticket: !!selectionMeta?.sessionTicket, msLeft: endsAt - now, msToLateEnd: endsAt + LATE_WINDOW_MS - now, place: placeNow() })
    : error;
  // A Mob paper (/test?mob=1) is the Mob's weekly paper, not Quick practice, whatever the mode in the address says.
  const attemptLabel = isNtaMode ? 'NTA mode' : searchParams.get('mob') === '1' ? 'Mob paper' : mode.label;
  // A Sunday Mock (/test?sunday=1) is this week's Sunday paper, not a Full mock, in the header.
  const headerLabel = searchParams.get('sunday') === '1' ? 'Sunday Mock' : attemptLabel;
  const subjectLabel = displayLabel(subjectId);

  const chipStateFor = (qid) => {
    const isAnswered = answers[qid] !== undefined;
    const isMarked = !!marked[qid];
    const isVisited = !!visited[qid];
    if (isMarked && isAnswered) return 'marked-answered';
    if (isMarked) return 'marked';
    if (isAnswered) return 'answered';
    if (isVisited) return 'visited';
    return 'notvisited';
  };

  const toggleMarked = (qid) => setMark(qid, !markedRef.current[qid]);

  const clearAnswer = (qid) => {
    const before = answersRef.current[qid];
    const cleared = chooseAnswer(qid, null);
    if (practiceRun && before !== undefined && cleared) {
      const number = questions.findIndex((question) => question.id === qid) + 1;
      setUndoClear((prev) => ({ qid, answer: before, number, n: (prev?.n || 0) + 1 }));
    }
  };
  const undoClearAnswer = () => {
    if (!undoClear) return;
    chooseAnswer(undoClear.qid, undoClear.answer);
    setUndoClear(null);
  };

  // Ready: every question answered and the server has acknowledged the last answer (a session
  // held on this device has no server save until submission, so its device save is the save).
  const serverSaves = !!selectionMeta?.sessionId && !selectionMeta?.sessionTicket;
  const allReady = practiceRun && questions.length > 0 && pendingCount === 0 && !submitting && !pendingSubmission
    && (!serverSaves || ackSeq >= lastAnswerSeq);
  const firstBlank = questions.findIndex((question) => answers[question.id] === undefined);

  const openReview = () => {
    // Opened from the palette sheet (which closes now): focus comes back to the Palette key, not to a key that is gone.
    const from = document.activeElement;
    reviewReturnRef.current = mobilePaletteDialogRef.current?.contains(from) ? mobilePaletteTriggerRef.current : from;
    setMobiAct('reading');
    setMobilePaletteOpen(false);
    if (!reviewOpen) recordSheet(true);
    setReviewOpen(true);
  };

  // NTA style: the submit check is NTA's section summary (the five counts in NTA's symbols) over the paper, then Submit.
  const openNtaSummary = () => {
    setMobilePaletteOpen(false);
    if (!ntaSummaryOpen) recordSheet(true);
    setNtaSummaryOpen(true);
  };

  // Every submit check is an in-app sheet: NTA style keeps NTA's section summary; the MockMob interface (Quick practice, a
  // Full mock, and an NTA paper drawn in the MockMob interface) uses the same submit sheet with its counts (R8 PRAC-02).
  const confirmAndSubmit = () => {
    if (classicInterface) { openNtaSummary(); return; }
    openReview();
  };

  const goNext = () => {
    if (isLastBlock) confirmAndSubmit();
    else gotoQuestion(block.endIdx + 1, { via: 'next' });
  };
  // NTA style: the key pressed decides the question's status (NTA's guidelines: Save & Next saves the answer, Mark for Review
  // & Next marks it for review), so Save & Next leaves the question unmarked; it is the one way to take a mark off here. It saves
  // the choice on screen (exam-true saving: nothing else does) and opens the next question. On the last question it saves and
  // stays, as NTA's own mock does (seen 17 Nov 2026); Submit is at the foot of the Question Palette.
  const saveAndNext = () => {
    saveHeld(q.id);
    setMark(q.id, false);
    if (!isLastBlock) gotoQuestion(block.endIdx + 1, { via: 'next' });
  };
  // NTA's grey circle arrows: down to the end of the question area, up to its top.
  const scrollQuestion = (toEnd) => {
    const target = toEnd ? ntaEndRef.current : ntaTopRef.current;
    target?.scrollIntoView?.({ block: toEnd ? 'end' : 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // Swipe between questions on touch: the question follows the finger, commits past 72 px or on a
  // fast flick, rubber-bands at the first question, and on the last one a commit opens the submit sheet.
  const springBack = () => {
    const el = liveRef.current;
    if (!el) return;
    el.classList.add('is-springing');
    el.style.transform = '';
    setTimeout(() => el.classList.remove('is-springing'), 320);
  };
  const onStagePointerDown = (event) => {
    suppressClickRef.current = false;
    if (event.pointerType !== 'touch' || !event.isPrimary || reviewOpen) return;
    swipeRef.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, axis: null, dx: 0, shown: 0, lastX: event.clientX, lastT: event.timeStamp, v: 0 };
  };
  const onStagePointerMove = (event) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x0;
    const dy = event.clientY - gesture.y0;
    if (!gesture.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (gesture.axis === 'x') { cancelPress(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is a convenience */ } }
    }
    if (gesture.axis !== 'x') return;
    const dt = event.timeStamp - gesture.lastT;
    if (dt > 0) gesture.v = (event.clientX - gesture.lastX) / dt;
    gesture.lastX = event.clientX; gesture.lastT = event.timeStamp;
    gesture.dx = dx;
    gesture.shown = dx > 0 && block.startIdx === 0 ? rubberBand(dx) : dx < 0 && isLastBlock ? dx * 0.5 : dx;
    if (liveRef.current) liveRef.current.style.transform = `translate3d(${gesture.shown}px, 0, 0)`;
  };
  const onStagePointerEnd = (event) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    swipeRef.current = null;
    if (gesture.axis !== 'x') return;
    suppressClickRef.current = true;
    const commit = event.type === 'pointerup' && (Math.abs(gesture.dx) > SWIPE_COMMIT_PX || (Math.abs(gesture.v) > SWIPE_FLICK && Math.abs(gesture.dx) > 24));
    if (commit && gesture.dx < 0 && !isLastBlock) gotoQuestion(block.endIdx + 1, { from: gesture.shown, via: 'swipe' });
    else if (commit && gesture.dx > 0 && block.startIdx > 0) gotoQuestion(block.startIdx - 1, { from: gesture.shown, via: 'swipe' });
    else { springBack(); if (commit && gesture.dx < 0 && isLastBlock && !submitting) openReview(); }
  };
  const onStageClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };



  // NTA style: saves the choice on screen too (NTA: "to save your answer for the current question, mark it for review"), so a
  // question answered and marked is evaluated; one marked with no answer is not.
  const markAndNext = () => {
    saveHeld(q.id);
    setMark(q.id, true);
    if (!isLastBlock) gotoQuestion(block.endIdx + 1, { via: 'next' });
  };

  const renderQuestion = (question, questionIndex) => {
    // MockMob style's cross-out (18 Nov): the tool is on for this question, and the one line under its options (room kept for
    // it, so nothing below moves when it appears): a refusal, the tool's line, or the one-time note.
    const crossOn = crossTool === question.id;
    const slot = crossNote?.qid === question.id ? 'refused' : crossOn ? 'on' : strikeNoteVisible && question.id === q.id ? 'note' : '';
    return (
    <section
      key={question.id}
      className={`nta-question-block ${question.id === q.id ? 'is-active' : ''}`}
      aria-labelledby={`question-title-${question.id}`}
    >
      <div className="nta-question-meta">
        <div>
          <span className="nta-question-number">Question {questionIndex + 1}</span>
          <span className={`nta-chip nta-chip--${chipStateFor(question.id)}`}>
            {CHIP_LABELS[chipStateFor(question.id)]}
          </span>
        </div>
        <div className="nta-question-actions">
          <button type="button" className="nta-text-button" onClick={() => toggleMarked(question.id)}>
            <Icon name="flag" /> {marked[question.id] ? 'Unmark' : 'Mark'}
          </button>
          {/* The cross-out tool: outlined at rest, filled ink while on (volt stays the primary key's). Both labels share one cell,
              so the key keeps one width and nothing in the row moves when it turns on. */}
          <button
            type="button"
            className="nta-text-button pr-cross"
            aria-pressed={crossOn}
            disabled={pendingSubmission || timeLeft <= 0 || submitting}
            onClick={() => { toggleCrossTool(question.id); if (questionIndex !== idx) gotoQuestion(questionIndex); }}
          >
            <Strikethrough aria-hidden="true" focusable="false" />
            <span className="pr-cross__label"><span>{crossOn ? 'Crossing out' : 'Cross out'}</span><span className="pr-cross__room" aria-hidden="true">Crossing out</span></span>
          </button>
          {/* R8 PRAC-06: after Clear, the same key reads "Undo clear" for four seconds, a drain line under its label, then goes
              back to Clear. Nothing floats over the options while the student picks again. */}
          {(() => {
            // One key, so focus stays on it when the label changes.
            const undoing = practiceRun && undoClear?.qid === question.id;
            return (
              <button
                type="button"
                className={`nta-text-button${undoing ? ' pr-undo-key' : ''}`}
                onClick={undoing ? undoClearAnswer : () => clearAnswer(question.id)}
                aria-label={undoing ? `Undo clear: restore the answer to question ${undoClear.number}` : undefined}
              >
                {undoing ? <><span className="pr-label" key={`u${undoClear.n}`}>Undo clear</span><i className="pr-undo-drain" key={`d${undoClear.n}`} aria-hidden="true" /></> : 'Clear'}
              </button>
            );
          })()}
          {!isNtaMode && (
            <VoteControls
              questionId={question.id}
              initialScore={question.score}
              initialUserVote={question.userVote}
              compact
              onVoteApplied={(vote) => {
                setQuestions((prev) => prev.map((item) => (
                  item.id === question.id
                    ? { ...item, score: vote.score, upvotes: vote.upvotes, downvotes: vote.downvotes, userVote: vote.userVote }
                    : item
                )));
              }}
            />
          )}
        </div>
      </div>

      <h2 id={`question-title-${question.id}`} className="nta-question-text">
        {question.question}
      </h2>

      <div className="nta-options" role="group" aria-label={`Options for question ${questionIndex + 1}`}>
        {question.options.map((opt, optionIndex) => {
          const selected = answers[question.id] === optionIndex;
          const letter = OPTION_LETTERS[optionIndex] || optionIndex + 1;
          // The chosen answer never shows crossed out (choosing brings an option back).
          const isStruck = !selected && isCrossedOut(crossMarks, question.id, optionIndex);
          // Press and hold (or right-click) an option to cross it out, outside NTA mode (whose rules say right-click is off);
          // Shift+click anywhere. Shortcuts only: the tool is the visible way.
          const pressProps = practiceRun ? {
            onPointerDown: (event) => startPress(event, question.id, optionIndex),
            onPointerMove: movePress,
            onPointerUp: cancelPress,
            onPointerCancel: cancelPress,
            onPointerLeave: cancelPress,
            onContextMenu: (event) => strikeFromMenu(event, question.id, optionIndex),
          } : {};
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              data-option={`${question.id}:${optionIndex}`}
              className={`nta-option ${selected ? 'is-selected' : ''} ${isStruck ? 'is-struck' : ''}${isStruck && freshStrike === `${question.id}:${optionIndex}` ? ' is-striking' : ''}`}
              {...pressProps}
              onClick={(event) => pressOption(question, questionIndex, optionIndex, crossOn || event.shiftKey)}
              aria-pressed={selected}
              disabled={pendingSubmission || timeLeft <= 0 || submitting}
            >
              {isStruck ? <span className="pr-sr">{`Option ${letter}, crossed out. `}</span> : null}
              <span className="nta-option-letter" aria-hidden={isStruck || undefined}>{letter}{isStruck ? <X className="pr-cross-x" aria-hidden="true" focusable="false" /> : null}</span>
              <span className="nta-option-text">{plainOptionTexts(question.options)[optionIndex] ?? optionLabel(opt)}</span>
            </button>
          );
        })}
      </div>
      <p className={`pr-slot${slot === 'note' ? ' pr-note' : ''}${slot === 'refused' ? ' is-refused' : ''}`} role="status">
        {/* A refusal said again is a new line, so a screen reader says it again. */}
        {slot === 'refused' ? <span key={`refused-${crossNote.n}`}>{CROSS_OUT_WORDS.refused}</span> : slot === 'on' ? CROSS_OUT_WORDS.on : slot === 'note' ? 'Press and hold an option to cross it out.' : ''}
      </p>
    </section>
    );
  };

  // The block being left, drawn without controls so nothing in it can be focused or pressed.
  const renderGhost = () => {
    if (!ghost || ghost.startIdx === block.startIdx || !questions[ghost.startIdx]) return null;
    const left = getQuestionBlock(questions, ghost.startIdx);
    return (
      <div
        key={`ghost-${ghost.n}`}
        className="pr-ghost"
        aria-hidden="true"
        style={{ '--pr-dir': ghost.dir, '--pr-from': `${ghost.from || 0}px` }}
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setGhost((current) => (current?.n === ghost.n ? null : current)); }}
      >
        {left.isPassage && (
          <div className="nta-passage">
            <div className="nta-passage-head"><span>Passage</span><strong>{left.passageTitle}</strong></div>
            <p>{left.passageText}</p>
          </div>
        )}
        <div className="nta-question-list">
          {left.entries.map(({ question, index }) => (
            <div key={question.id} className="nta-question-block">
              <div className="nta-question-meta"><div><span className="nta-question-number">Question {index + 1}</span></div></div>
              <p className="nta-question-text">{question.question}</p>
              <div className="nta-options">
                {question.options.map((opt, optionIndex) => (
                  <div key={optionIndex} className={`nta-option ${answers[question.id] === optionIndex ? 'is-ghost-selected' : ''}`}>
                    <span className="nta-option-letter">{OPTION_LETTERS[optionIndex] || optionIndex + 1}</span>
                    <span className="nta-option-text">{plainOptionTexts(question.options)[optionIndex] ?? optionLabel(opt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const legendCounts = Object.fromEntries(LEGEND.map(([state]) => [state, 0]));
  for (const question of questions) legendCounts[chipStateFor(question.id)] += 1;
  const filterMatches = paletteFilter ? questions.map((question, index) => (chipStateFor(question.id) === paletteFilter ? index : -1)).filter((index) => index >= 0) : [];
  const nextMatch = filterMatches.length ? (filterMatches.find((index) => index > idx) ?? filterMatches[0]) : -1;
  const goToNextMatch = () => { gotoQuestion(nextMatch, { via: 'palette' }); setMobilePaletteOpen(false); };
  const renderLegend = () => (
    <div className="pr-legend" role="group" aria-label="Show questions by state">
      {LEGEND.map(([state, label]) => (
        <button key={state} type="button" aria-pressed={paletteFilter === state} onClick={() => setPaletteFilter((current) => (current === state ? null : state))}>
          <i className={`legend ${state}`} aria-hidden="true" /> {label} <b>{legendCounts[state]}</b>
        </button>
      ))}
      {paletteFilter && (nextMatch >= 0
        ? <button type="button" className="pr-goto" key={`goto-${paletteFilter}`} onClick={goToNextMatch}>Go to question {nextMatch + 1}</button>
        : <p className="pr-note" role="status">No questions in this state.</p>)}
    </div>
  );
  const nextLabel = isLastBlock ? (submitting ? 'Submitting...' : 'Submit test') : 'Next';
  const mobileNextLabel = isLastBlock ? (submitting ? 'Submitting...' : 'Submit') : 'Next';
  const morph = (label) => (practiceRun ? <span className="pr-label" key={label}>{label}</span> : label);

  const renderPalette = (compact = false) => (
    <div className={compact ? 'nta-palette-grid is-compact' : 'nta-palette-grid'}>
      {questions.map((question, questionIndex) => {
        const state = chipStateFor(question.id);
        return (
          <button
            key={question.id}
            type="button"
            className={`nta-palette-chip nta-palette-chip--${state} ${questionIndex === idx ? 'is-current' : ''} ${practiceRun && paletteFilter && paletteFilter !== state ? 'is-dimmed' : ''}`}
            onClick={() => {
              gotoQuestion(questionIndex, { via: 'palette' });
              setMobilePaletteOpen(false);
            }}
            aria-label={`Question ${questionIndex + 1}, ${classicInterface ? ntaStateName(state) : state.replace('-', ' and ')}`}
            aria-current={classicInterface && questionIndex === idx ? 'step' : undefined}
          >
            {questionIndex + 1}
          </button>
        );
      })}
    </div>
  );

  // The paper's notices (a short bank, and how this NTA paper differs from the real one): above the paper in both interfaces.
  const notices = <>
    {selectionMeta?.insufficientHighQualityPool && (
      <div className="nta-alert" role="status">
        <Icon name="alert" />
        <span>{selectionMeta.message || `Only ${questions.length} verified questions passed the NTA quality gate for this selection.`}</span>
      </div>
    )}

    {isNtaMode && selectionMeta?.ntaPaper?.status === 'closest' && selectionMeta.ntaPaper.items?.length > 0 && (
      <details className="nta-alert nta-paper-notice" open={noticeOpen} onToggle={(event) => setNoticeOpen(event.currentTarget.open)}>
        <summary>
          <Icon name="alert" />
          <span>How this paper differs from the real CUET paper ({selectionMeta.ntaPaper.items.length})</span>
        </summary>
        <ul>{selectionMeta.ntaPaper.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>
    )}
  </>;
  const hasNotices = !!selectionMeta?.insufficientHighQualityPool || (isNtaMode && selectionMeta?.ntaPaper?.status === 'closest' && selectionMeta.ntaPaper.items?.length > 0);

  // ---- NTA style: NTA's CBT screen (CUET (UG) 2025 Information Bulletin, Appendix V) ----------------------------------
  // The exam's name, then the Question Paper icon, the candidate block with the Remaining Time and the profile image top
  // right; the section on the top bar; the question area with NTA's grey circle arrows and its three keys; the Question
  // Palette on the right with the section summary above it and the > fold at its left. Phones keep the palette as a sheet.
  const ntaName = shownName(user?.name, user?.email);
  const ntaTime = `${two(Math.floor(timeLeft / 3600))}:${two(Math.floor(timeLeft / 60) % 60)}:${two(timeLeft % 60)}`;
  const ntaKeyLabel = submitting ? 'Submitting...' : NTA.save;
  // What NTA style shows as chosen: a held choice on this question, else its saved answer.
  const shownAnswer = (qid) => (heldChoice?.qid === qid ? heldChoice.option : answers[qid]);
  // Clear Response on the question in focus.
  const clearOnScreen = () => clearChoice(q.id);
  const renderNtaLegend = () => (
    <ul className="nta-n-legend" aria-label="Section summary">
      {NTA_LEGEND.map(([state, label]) => (
        <li key={state}><span className={`nta-n-sym nta-n-sym--${state}`}>{legendCounts[state]}</span><span>{label}</span></li>
      ))}
    </ul>
  );
  const renderNtaQuestion = (question, questionIndex) => {
    const texts = plainOptionTexts(question.options);
    return (
      <section key={question.id} className={`nta-question-block ${question.id === q.id ? 'is-active' : ''}`} aria-labelledby={`question-title-${question.id}`}>
        <h2 id={`question-title-${question.id}`} className="nta-question-text">{question.question}</h2>
        <div className="nta-options" role="group" aria-label={`Options for question ${questionIndex + 1}`}>
          {question.options.map((opt, optionIndex) => {
            // The choice on screen: held (not saved yet) or saved. Pressing it again clears it (pickNta).
            const selected = shownAnswer(question.id) === optionIndex;
            return (
              <button
                key={`${question.id}-${optionIndex}`}
                type="button"
                className={`nta-option ${selected ? 'is-selected' : ''}`}
                onClick={() => pickNta(question.id, optionIndex)}
                aria-pressed={selected}
                disabled={pendingSubmission || timeLeft <= 0 || submitting}
              >
                <span className="nta-n-radio" aria-hidden="true" />
                <span className="nta-n-num">{optionIndex + 1}.</span>
                <span className="nta-option-text">{texts[optionIndex] ?? optionLabel(opt)}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };
  const renderClassic = () => <>
    <header className="nta-n-head">
      <strong className="nta-n-exam">{NTA.exam}</strong>
      <div className="nta-n-tools">
        <button type="button" className="nta-n-paper" onClick={() => setPaperViewOpen(true)} aria-haspopup="dialog">
          <FileText aria-hidden="true" /><span>{NTA.questionPaper}</span>
        </button>
        <dl className="nta-n-cand">
          {ntaName ? <div className="nta-n-cand__name"><dt>{NTA.candidate}</dt><dd>{ntaName}</dd></div> : null}
          <div className="nta-n-cand__subject"><dt>{NTA.subjectName}</dt><dd>{subjectLabel}</dd></div>
          <div className="nta-n-cand__time">
            <dt>{NTA.remaining}</dt>
            <dd><span className={`nta-timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label={`${NTA.remaining}: ${mins} minutes ${secs} seconds`}><span>{ntaTime}</span></span></dd>
          </div>
        </dl>
        <i className="nta-n-photo" aria-hidden="true" />
      </div>
    </header>
    <div className="nta-n-sections">
      <span className="nta-n-tab" aria-current="true">{subjectLabel}</span>
    </div>
    {hasNotices ? <div className="nta-n-notices">{notices}</div> : null}

    <div className="nta-n-body" data-palette={ntaPaletteOpen ? 'open' : 'closed'}>
      <div className="nta-paper nta-n-main" ref={paperRef}>
        <div className="nta-n-qhead">
          <h1>{NTA.question(idx + 1)}</h1>
          {/* On a phone the palette is folded away, so a chosen option and a saved answer would look the same: say which it
              is, beside the question number (a status line the real exam does not need; its palette is always on show). */}
          <span className="nta-n-saved" data-state={heldChoice?.qid === q.id ? 'held' : answers[q.id] !== undefined ? 'saved' : 'none'} role="status" aria-live="polite">
            {heldChoice?.qid === q.id ? NTA.notSavedYet : answers[q.id] !== undefined ? NTA.savedState : ''}
          </span>
          <button type="button" className="nta-n-arrow" onClick={() => scrollQuestion(true)} aria-label="Go to the end of the question"><ArrowDown aria-hidden="true" /></button>
        </div>
        <div className="nta-n-pane" ref={ntaPaneRef} data-passage={block.isPassage ? 'true' : undefined}>
          <span ref={ntaTopRef} className="nta-n-edge" aria-hidden="true" />
          {block.isPassage && (
            <article className="nta-passage" aria-label="Passage">
              <div className="nta-passage-head"><span>Passage</span><strong>{block.passageTitle}</strong></div>
              <p>{block.passageText}</p>
            </article>
          )}
          <div className="nta-question-list">
            {block.entries.map((entry) => renderNtaQuestion(entry.question, entry.index))}
          </div>
          <div className="nta-n-paneend">
            <button type="button" className="nta-n-arrow" onClick={() => scrollQuestion(false)} aria-label="Go to the top of the question"><ArrowUp aria-hidden="true" /></button>
          </div>
          <span ref={ntaEndRef} className="nta-n-edge" aria-hidden="true" />
        </div>
        <div className="nta-navigation">
          <button type="button" className="nta-nav-button nta-classic-review" onClick={markAndNext}>{NTA.markNext}</button>
          <button type="button" className="nta-nav-button" onClick={clearOnScreen}>{NTA.clearResponse}</button>
          <button type="button" className="nta-nav-button nta-n-prev" disabled={block.startIdx === 0} onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}>Previous</button>
          <button type="button" className="nta-nav-button nta-n-save" onClick={saveAndNext} disabled={submitting}>{ntaKeyLabel}</button>
        </div>
      </div>

      <button type="button" className="nta-n-fold" aria-expanded={ntaPaletteOpen} aria-controls="nta-n-palette" aria-label={ntaPaletteOpen ? NTA.hidePalette : NTA.showPalette} onClick={() => setNtaPaletteOpen((open) => !open)}>
        {ntaPaletteOpen ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
      </button>
      <aside id="nta-n-palette" className="nta-review-panel nta-n-palette" aria-label={NTA.paletteTitle} hidden={!ntaPaletteOpen}>
        {renderNtaLegend()}
        <p className="nta-n-section">{subjectLabel}</p>
        <p className="nta-n-title">{NTA.paletteTitle}</p>
        {renderPalette()}
        <button type="button" className="nta-submit-button" onClick={confirmAndSubmit} disabled={submitting}>{submitting ? 'Submitting...' : NTA.submit}</button>
      </aside>
    </div>

    <div className="nta-mobile-actions">
      <button type="button" disabled={block.startIdx === 0} onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}>Previous</button>
      <button type="button" onClick={clearOnScreen} disabled={shownAnswer(q.id) === undefined}>{NTA.clearResponse}</button>
      <button ref={mobilePaletteTriggerRef} type="button" onClick={() => setMobilePaletteOpen(true)} aria-label={`Question palette, ${answered} of ${questions.length} answered`}>{NTA.paletteTitle}</button>
      <button type="button" className="nta-m-review" onClick={markAndNext}>{NTA.markNext}</button>
      <button type="button" className="is-primary nta-m-save" onClick={saveAndNext} disabled={submitting}>{ntaKeyLabel}</button>
    </div>

    {mobilePaletteOpen && (
      <div ref={mobilePaletteDialogRef} className="nta-mobile-sheet" role="dialog" aria-modal="true" aria-label={NTA.paletteTitle}>
        <button className="nta-sheet-backdrop" type="button" tabIndex={-1} aria-label="Close palette" onClick={() => setMobilePaletteOpen(false)} />
        <div className="nta-sheet-panel">
          <div className="nta-sheet-head">
            <strong>{NTA.paletteTitle}</strong>
            <button ref={mobilePaletteCloseRef} type="button" className="nta-icon-button" onClick={() => setMobilePaletteOpen(false)} aria-label="Close palette">
              <Icon name="x" />
            </button>
          </div>
          {renderNtaLegend()}
          <p className="nta-n-section">{subjectLabel}</p>
          {renderPalette(true)}
          <button type="button" className="nta-submit-button" onClick={confirmAndSubmit} disabled={submitting}>{submitting ? 'Submitting...' : NTA.submit}</button>
        </div>
      </div>
    )}

    {ntaSummaryOpen && !submitting && (
      // NTA's Exam Summary (its own mock, seen 17 Nov 2026): the counts in a table, then "Are you sure" with Yes and No. Phones get
      // the same table turned on its side (one row a status), so nothing scrolls sideways.
      // The unsaved-choice line is part of the dialog's description, so a screen reader says it with the question, not only on sight.
      <div ref={ntaSummaryRef} className="nta-n-dialog nta-n-summary" role="dialog" aria-modal="true" aria-labelledby="nta-n-summary-title" aria-describedby={heldChoice && heldChoice.qid === q.id ? 'nta-n-summary-held nta-n-summary-ask' : 'nta-n-summary-ask'}>
        <div className="nta-n-dialog__backdrop" aria-hidden="true" />
        <div className="nta-n-dialog__panel">
          <h2 id="nta-n-summary-title" className="nta-n-dialog__title">Exam Summary</h2>
          <p className="nta-n-section">{subjectLabel}</p>
          <table className="nta-n-table nta-n-table--wide">
            <thead>
              <tr>
                <th scope="col">No. of Questions</th>
                {NTA_SUMMARY.map((state) => <th key={state} scope="col"><span className={`nta-n-sym nta-n-sym--${state} nta-n-sym--tiny`} aria-hidden="true" />{NTA_LEGEND.find(([key]) => key === state)[1]}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{questions.length}</td>
                {NTA_SUMMARY.map((state) => <td key={state}>{legendCounts[state]}</td>)}
              </tr>
            </tbody>
          </table>
          <table className="nta-n-table nta-n-table--tall">
            <tbody>
              <tr><th scope="row">No. of Questions</th><td>{questions.length}</td></tr>
              {NTA_SUMMARY.map((state) => (
                <tr key={state}><th scope="row"><span className={`nta-n-sym nta-n-sym--${state} nta-n-sym--tiny`} aria-hidden="true" />{NTA_LEGEND.find(([key]) => key === state)[1]}</th><td>{legendCounts[state]}</td></tr>
              ))}
            </tbody>
          </table>
          {/* MockMob's one addition: a choice on screen that was never saved is named, so Yes never drops it unseen. */}
          {heldChoice && heldChoice.qid === q.id ? <p id="nta-n-summary-held" className="nta-n-dialog__held" role="note">Your choice on Question {idx + 1} is not saved. Choose No, then Save &amp; Next to keep it.</p> : null}
          <p id="nta-n-summary-ask" className="nta-n-dialog__ask">{NTA_ASK[0]}<br />{NTA_ASK[1]}</p>
          <div className="nta-n-dialog__keys">
            <button type="button" className="nta-n-dialog__submit" onClick={() => { setNtaSummaryOpen(false); submitTest('submit'); }}>Yes</button>
            <button type="button" className="nta-n-dialog__back" data-autofocus onClick={closeNtaSummary}>No</button>
          </div>
        </div>
      </div>
    )}

    {paperViewOpen && (
      <div ref={paperViewRef} className="nta-n-dialog nta-n-paperview" role="dialog" aria-modal="true" aria-labelledby="nta-n-paperview-title">
        <div className="nta-n-dialog__backdrop" aria-hidden="true" onClick={closePaperView} />
        <div className="nta-n-dialog__panel">
          <div className="nta-n-dialog__head">
            <h2 id="nta-n-paperview-title" className="nta-n-dialog__title">{NTA.questionPaper}</h2>
            <button type="button" className="nta-n-dialog__close" data-autofocus onClick={closePaperView} aria-label={`Close the ${NTA.questionPaper}`}><X aria-hidden="true" /></button>
          </div>
          <p className="nta-n-section">{subjectLabel}</p>
          <ol className="nta-n-paperview__list">
            {questions.map((question, questionIndex) => {
              const groupKey = passageKeyFor(question);
              const opensPassage = groupKey && passageTextFor(question) && questions.findIndex((other) => passageKeyFor(other) === groupKey) === questionIndex;
              const texts = plainOptionTexts(question.options);
              return (
                <li key={question.id}>
                  {opensPassage ? <div className="nta-passage"><div className="nta-passage-head"><span>Passage</span><strong>{passageTitleFor(question)}</strong></div><p>{passageTextFor(question)}</p></div> : null}
                  <p className="nta-n-paperview__q"><b>{NTA.question(questionIndex + 1)}</b> {question.question}</p>
                  <ol className="nta-n-paperview__options">
                    {question.options.map((opt, optionIndex) => <li key={optionIndex}><span>{optionIndex + 1}.</span> {texts[optionIndex] ?? optionLabel(opt)}</li>)}
                  </ol>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    )}
  </>;

  return (
    <div ref={fullscreenTarget} className={practiceRun ? 'nta-runner pr-run' : 'nta-runner'} data-interface={classicInterface ? 'nta' : 'mockmob'}>
      {/* R8 PRAC-16: while all is well (online, saving) the note is for screen readers only; it shows when offline, waiting or held. */}
      <div role="status" className={`runner-sync-state${!pendingSubmission && online && syncStatus !== 'pending' ? ' is-quiet' : ''}`}>{pendingSubmission ? 'Waiting for server confirmation. Answers are held on this device until the submission window ends.' : !online ? 'You are offline. Answers stay on this device and the timer continues. Reconnect before submitting.' : selectionMeta?.sessionTicket ? 'Saved on this device. Stay online to submit.' : syncStatus === 'pending' ? 'Waiting for connection. Answers stay on this device; synchronize before the timer ends.' : 'Practice saves to your account while online.'}</div>
      {isNtaMode ? <IntegrityOverlay alert={integrity.alert} onResume={integrity.resume} onRetry={() => submitTest()} submitting={submitting} error={submitNote} supported={integrity.supported} entering={integrity.entering} fullscreenError={integrity.fullscreenError} /> : null}
      {/* A paper not sent yet: what happened and the one way forward. Held for a connection, it sends itself, and the server
          takes it late for 7 days after the timer (B8); after that there is no retry key, only a new paper. */}
      {submitNote && integrity.alert?.phase !== 'terminated' && (
        <div role="alert" className="runner-submit-error">
          <p>{submitNote}</p>
          {errorLink
            ? <Link href={errorLink.href}>{errorLink.label}</Link>
            : !pendingSubmission || now < endsAt + LATE_WINDOW_MS ? <button type="button" onClick={() => submitTest()} disabled={submitting}>Try sending again</button> : <Link href={practiceLink}>Start a new paper</Link>}
        </div>
      )}
      {showVoteCoach && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="glass volt-soft max-w-lg w-full p-5 md:p-6 relative overflow-hidden">
            <div className="eyebrow mb-3">{'Quality loop'}</div>
            <h2 className="heading text-[24px] mb-3">Help clean the question bank</h2>
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              If a question feels out of syllabus, wrongly keyed, or unfairly hard, downvote it. Repeated downvotes push weak questions out of active mocks.
            </p>
            <Button
              variant="volt"
              className="w-full"
              onClick={() => {
                window.localStorage.setItem('mm_vote_coach_seen', '1');
                setShowVoteCoach(false);
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {isNtaMode && <div className="nta-interface-toolbar">
        <span>Practice interface</span>
        <div role="group" aria-label="Test interface">
          <button type="button" aria-pressed={!classicInterface} onClick={() => switchInterface('mockmob')}>MockMob</button>
          <button type="button" aria-pressed={classicInterface} onClick={() => switchInterface('nta')}>NTA style</button>
        </div>
        <small>Switch anytime. Saved answers and the timer stay.</small>
      </div>}
      {classicInterface ? renderClassic() : <>
      <header className="nta-test-header">
        <div className="nta-header-left">
          {!isNtaMode && <button
            type="button"
            className="nta-icon-button"
            onClick={() => setExitTo('/dashboard')}
            aria-label="Exit test"
          >
            <Icon name="x" />
          </button>}
          <div className="nta-title-stack">
            <span>{headerLabel}</span>
            <strong>{subjectLabel}</strong>
          </div>
        </div>

        <div className="nta-header-progress">
          <div className="nta-progress-row">
            <span>Question {idx + 1} of {questions.length}</span>
            <span>{answered} answered</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        {/* The timer group: the Keys key at its left on a device with a hardware keyboard (MockMob style only; NTA style draws its
            own header), with its one-time hint, whose room stays for the rest of the paper so the timer never moves. */}
        <div className="rk-group">
          {keysUi ? (
            <div ref={keysAnchorRef} className="rk-anchor">
              {keysHint ? <span id="rk-hint" className="rk-hint" data-gone={keysHintGone || paperOver ? '' : undefined} aria-hidden={keysHintGone || paperOver || undefined}>Press ? for keys</span> : null}
              <button
                type="button"
                className="rk-keys"
                aria-expanded={keysShown}
                aria-controls={keysShown ? 'rk-panel' : undefined}
                aria-describedby={keysHint && !keysHintGone && !paperOver ? 'rk-hint' : undefined}
                disabled={paperOver}
                onClick={toggleKeys}
              >
                Keys
              </button>
              {keysShown ? (
                <div id="rk-panel" className="rk-panel" role="region" aria-labelledby="rk-title">
                  <h2 id="rk-title" className="rk-title">Keys for this paper</h2>
                  <dl className="rk-list">
                    {KEY_ROWS.map((row) => (
                      <div key={row.words} className="rk-row">
                        <dt>
                          {/* One group of caps per line when they wrap: "A B C D", then "or 1 2 3 4". */}
                          {row.caps.map((group, g) => (
                            <span key={group.join('')} className="rk-caps">
                              {g > 0 ? <span className="rk-or">or</span> : null}
                              {group.map((cap) => (
                                <kbd key={cap} className="rk-cap">{CAP_NAMES[cap] ? <><span aria-hidden="true">{cap}</span><span className="pr-sr">{CAP_NAMES[cap]}</span></> : cap}</kbd>
                              ))}
                            </span>
                          ))}
                        </dt>
                        <dd>{row.words}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={`nta-timer ${lowTime ? 'is-low' : ''}`} role="timer" aria-label={`Time remaining: ${mins} minutes ${secs} seconds`}>
            <Icon name="clock" />
            <span>{mins}:{secs.toString().padStart(2, '0')}</span>
          </div>
        </div>
      </header>

      <div className="nta-shell">
        {notices}

        <div className="nta-grid">
          <div className="nta-paper" ref={paperRef}>
            <div className="nta-paper-head">
              <div>
                <span className="nta-kicker">MockMob CUET Test Console</span>
                <h1>{block.isPassage ? `Questions ${block.startIdx + 1} to ${block.endIdx + 1}` : `Question ${idx + 1}`}</h1>
              </div>
              <div className="nta-paper-tags">
                <span>{q.chapter}</span>
                {q.difficulty && <span>{sentenceCase(q.difficulty)}</span>}
              </div>
            </div>

            {(() => {
              const content = <>
                {block.isPassage && (
                  <article className="nta-passage" aria-label="Passage">
                    <div className="nta-passage-head">
                      <span>Passage</span>
                      <strong>{block.passageTitle}</strong>
                    </div>
                    <p>{block.passageText}</p>
                  </article>
                )}

                <div className="nta-question-list" data-single={block.isPassage ? undefined : ''}>
                  {block.entries.map((entry) => renderQuestion(entry.question, entry.index))}
                </div>
              </>;
              if (!practiceRun) return content;
              return (
                <div
                  className="pr-stage"
                  onPointerDown={onStagePointerDown}
                  onPointerMove={onStagePointerMove}
                  onPointerUp={onStagePointerEnd}
                  onPointerCancel={onStagePointerEnd}
                  onClickCapture={onStageClickCapture}
                >
                  {renderGhost()}
                  <div key={`block-${block.startIdx}`} ref={liveRef} className="pr-live" data-entering={ghost ? '' : undefined} style={{ '--pr-dir': navDir }}>
                    {content}
                  </div>
                </div>
              );
            })()}

            <div className="nta-navigation">
              <button
                type="button"
                className="nta-nav-button"
                disabled={block.startIdx === 0}
                onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}
              >
                <Icon name="chevL" /> Previous
              </button>
              <button
                type="button"
                className={`nta-nav-button ${isLastBlock ? 'is-primary' : ''} ${allReady && isLastBlock ? 'is-ready' : ''}`}
                onClick={goNext}
                disabled={submitting}
              >
                {morph(nextLabel)}
                {!isLastBlock && <Icon name="chevR" />}
              </button>
            </div>
          </div>

          <aside className="nta-review-panel" aria-label="Question review panel">
            {/* R8 PRAC-05: in a practice run the legend below counts every state, so the four tiles (whose Answered and Marked
                overlap) would show a second, disagreeing set of numbers. The header keeps the one total. */}
            <div className="nta-panel-section">
              <span className="nta-kicker">Review</span>
              {practiceRun ? <strong className="nta-panel-total">{answered}/{questions.length} answered</strong> : <div className="nta-summary-grid">
                <div><strong>{answered}</strong><span>Answered</span></div>
                <div><strong>{markedCount}</strong><span>Marked</span></div>
                <div><strong>{pendingCount}</strong><span>Pending</span></div>
                <div><strong>{notVisitedCount}</strong><span>Not visited</span></div>
              </div>}
            </div>
            {renderPalette()}
            {practiceRun ? renderLegend() : <div className="nta-legend">
              <span><i className="legend answered" /> Answered</span>
              <span><i className="legend marked" /> Marked</span>
              <span><i className="legend visited" /> Not answered</span>
              <span><i className="legend notvisited" /> Not visited</span>
              <span><i className="legend marked-answered" /> Answered & marked for review</span>
            </div>}
            <button type="button" className={`nta-submit-button ${allReady ? 'is-ready' : ''}`} onClick={confirmAndSubmit} disabled={submitting}>
              {morph(submitting ? 'Submitting...' : 'Submit test')}
            </button>
          </aside>
        </div>
      </div>

      <div className="nta-mobile-actions">
        <button type="button" disabled={block.startIdx === 0} onClick={() => gotoQuestion(block.startIdx - 1, { via: 'previous' })}>
          <Icon name="chevL" /> Prev
        </button>
        <button ref={mobilePaletteTriggerRef} type="button" onClick={() => setMobilePaletteOpen(true)} aria-label={`Question palette, ${answered} of ${questions.length} answered`}>
          {morph(allReady ? 'All answered' : 'Palette')}
        </button>
        <button type="button" className={`is-primary ${allReady && isLastBlock ? 'is-ready' : ''}`} onClick={goNext} disabled={submitting}>
          {morph(mobileNextLabel)} {!isLastBlock && <Icon name="chevR" />}
        </button>
      </div>

      {mobilePaletteOpen && (
        <div ref={mobilePaletteDialogRef} className="nta-mobile-sheet" role="dialog" aria-modal="true" aria-label="Question palette">
          <button className="nta-sheet-backdrop" type="button" tabIndex={-1} aria-label="Close palette" onClick={() => setMobilePaletteOpen(false)} />
          <div className="nta-sheet-panel">
            <div className="nta-sheet-head">
              <div>
                <span className="nta-kicker">Review palette</span>
                <strong>{answered}/{questions.length} answered</strong>
              </div>
              <button ref={mobilePaletteCloseRef} type="button" className="nta-icon-button" onClick={() => setMobilePaletteOpen(false)} aria-label="Close palette">
                <Icon name="x" />
              </button>
            </div>
            {!practiceRun && <div className="nta-summary-grid">
              <div><strong>{answered}</strong><span>Answered</span></div>
              <div><strong>{markedCount}</strong><span>Marked</span></div>
              <div><strong>{pendingCount}</strong><span>Pending</span></div>
              <div><strong>{notVisitedCount}</strong><span>Not visited</span></div>
            </div>}
            {renderPalette(true)}
            {practiceRun && renderLegend()}
            <button type="button" className={`nta-submit-button ${allReady ? 'is-ready' : ''}`} onClick={confirmAndSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit test'}
            </button>
          </div>
        </div>
      )}
      </>}

      {practiceRun && <span className="pr-sr" role="status">{allReady ? `All ${questions.length} answered${serverSaves ? ' and saved' : ''}. Ready to submit.` : ''}</span>}

      {practiceRun && <span className="pr-sr" role="status">{undoClear ? `Answer cleared. Undo clear is on the Clear key for four seconds.` : ''}</span>}

      {!classicInterface && reviewOpen && (
        <div ref={reviewDialogRef} className="pr-sheet" role="dialog" aria-modal="true" aria-labelledby="pr-sheet-title">
          <button className="pr-sheet__backdrop" type="button" tabIndex={-1} aria-label="Close" onClick={closeReview} />
          <div className="pr-sheet__panel">
            <h2 id="pr-sheet-title">{isMockMode ? 'Submit this mock?' : 'Submit this practice?'}</h2>
            <dl className="pr-sheet__counts">
              <div><dt>Answered</dt><dd>{answered}</dd></div>
              <div><dt>No answer</dt><dd>{pendingCount}</dd></div>
              <div><dt>Marked</dt><dd>{markedCount}</dd></div>
            </dl>
            <div className={isMockMode ? 'pr-sheet__say is-plain' : 'pr-sheet__say'}>
              {!isMockMode && <SheetMobi act={mobiAct === 'reading' ? 'reading' : pendingCount > 0 ? 'point' : markedCount > 0 ? 'tilt' : 'nod'} />}
              {pendingCount > 0 && firstBlank >= 0
                ? <button type="button" className="pr-sheet__go" onClick={() => { setReviewOpen(false); gotoQuestion(firstBlank, { via: 'palette' }); }}>{pendingCount} with no answer. Go to {firstBlank + 1}?</button>
                : <p>{markedCount > 0 ? `${markedCount} marked for review. Every question has an answer.` : `All ${questions.length} answered.`}</p>}
            </div>
            <div className="pr-sheet__actions">
              <button type="button" data-autofocus onClick={closeReview}>Keep answering</button>
              <button type="button" className="is-primary" disabled={submitting} onClick={() => { setReviewOpen(false); submitTest('submit'); }}>Submit now</button>
            </div>
          </div>
        </div>
      )}

      {exitTo && (
        <div ref={exitDialogRef} className="pr-sheet pr-sheet--exit" role="dialog" aria-modal="true" aria-labelledby="pr-exit-title" aria-describedby="pr-exit-line">
          <button className="pr-sheet__backdrop" type="button" tabIndex={-1} aria-label="Keep answering" onClick={closeExit} />
          <div className="pr-sheet__panel">
            <h2 id="pr-exit-title">{isMockMode ? 'Leave this mock?' : 'Leave this practice?'}</h2>
            {/* 15 Nov B2d: true in this build: the draft stays on the device until the timer and its upload grace end, and
                Practice's "Resume your paper" row (src/components/practice/ResumePaper.jsx) opens it again. */}
            <p id="pr-exit-line" className="pr-sheet__line">{answered > 0 ? `Your ${answered === 1 ? 'answer stays' : `${answered} answers stay`} ${placeNow()} until the timer ends.` : 'Nothing is answered yet.'} The timer keeps running while you are away. You can resume from Practice.</p>
            <div className="pr-sheet__actions">
              <button type="button" onClick={leavePaper}>Leave</button>
              <button type="button" className="is-primary" data-autofocus onClick={closeExit}>Keep answering</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .nta-runner {
          min-height: 100vh;
          background:
            radial-gradient(circle at 20% 0%, rgba(210,240,0,.055), transparent 30%),
            linear-gradient(180deg, #0a0a0a, #0d0e0b 58%, #090a08);
          color: var(--text-primary);
        }
        .nta-test-header {
          position: sticky;
          top: 0;
          z-index: 35;
          min-height: 74px;
          display: grid;
          grid-template-columns: minmax(230px, .8fr) minmax(260px, 1fr) auto;
          align-items: center;
          gap: 18px;
          padding: 12px clamp(18px, 2vw, 28px);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: var(--a-topbar, rgba(8,9,7,.92));
          backdrop-filter: blur(18px);
        }
        .nta-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .nta-title-stack {
          display: grid;
          gap: 1px;
          min-width: 0;
        }
        .nta-title-stack span,
        .nta-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--text-subtle);
        }
        .nta-title-stack strong {
          font-family: var(--font-display);
          font-size: 17px;
          line-height: 1.15;
          color: var(--a-ink, #f4f6ed);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nta-icon-button {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.035));
          color: var(--a-ink-2, #d4d4d8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .nta-icon-button:hover { border-color: var(--a-line-hover, rgba(255,255,255,.22)); color: var(--a-ink, #fff); }
        .nta-header-progress {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .nta-progress-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--text-subtle);
        }
        .nta-timer {
          min-width: 122px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 8px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.035));
          color: var(--a-ink, #f4f6ed);
          font-family: var(--font-mono);
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .nta-timer.is-low {
          border-color: rgba(248,113,113,.45);
          background: rgba(248,113,113,.1);
          color: var(--a-bad-text, #fca5a5);
        }
        .nta-shell {
          width: min(100%, 1340px);
          margin: 0 auto;
          padding: 22px clamp(16px, 2.2vw, 30px) 116px;
        }
        .nta-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 16px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid rgba(251,191,36,.28);
          background: rgba(251,191,36,.08);
          color: var(--a-warn-text, #fde68a);
          font-size: 13px;
          line-height: 1.5;
        }
        .nta-paper-notice { display: block; }
        .nta-paper-notice summary {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          cursor: pointer;
          font-weight: 600;
        }
        .nta-paper-notice summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 4px; }
        .nta-paper-notice ul { margin: 6px 0 2px; padding-left: 30px; list-style: disc; }
        .nta-paper-notice li + li { margin-top: 4px; }
        .nta-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 292px;
          gap: 22px;
          align-items: start;
        }
        .nta-paper {
          scroll-margin-top: 92px;
          width: 100%;
          max-width: 930px;
          justify-self: end;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-topbar, rgba(15,16,13,.94));
          box-shadow: 0 18px 70px rgba(0,0,0,.28);
          overflow: hidden;
        }
        .nta-paper-head {
          min-height: 76px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          padding: 20px 22px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: var(--a-hover, rgba(255,255,255,.025));
        }
        .nta-paper-head h1 {
          margin: 4px 0 0;
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1.15;
          color: var(--a-ink, #f8faf0);
        }
        .nta-paper-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        .nta-paper-tags span {
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 6px;
          color: var(--a-ink-2, #d4d4d8);
          padding: 6px 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .nta-passage {
          margin: 22px;
          padding: 18px;
          border: 1px solid rgba(210,240,0,.18);
          border-radius: 8px;
          background: rgba(210,240,0,.035);
        }
        .nta-passage-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--a-accent-text, var(--volt));
        }
        .nta-passage-head strong {
          color: var(--a-ink, #f4f6ed);
          letter-spacing: .08em;
        }
        .nta-passage p {
          margin: 0;
          color: var(--a-ink-2, #d4d4d8);
          font-size: 15px;
          line-height: 1.8;
          max-width: 72ch;
        }
        .nta-question-list {
          display: grid;
        }
        .nta-question-block {
          padding: 22px;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .nta-passage + .nta-question-list .nta-question-block:first-child {
          border-top: 0;
        }
        .nta-question-block.is-active {
          background: linear-gradient(90deg, rgba(210,240,0,.035), transparent 36%);
        }
        .nta-question-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .nta-question-meta > div:first-child,
        .nta-question-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .nta-question-number {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--a-accent-text, var(--volt));
        }
        .nta-chip {
          border-radius: 6px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          padding: 4px 7px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .09em;
          text-transform: uppercase;
          color: var(--a-ink-3, #a1a1aa);
        }
        .nta-chip--answered { color: var(--a-good-text, #86efac); border-color: rgba(74,222,128,.38); background: rgba(74,222,128,.08); }
        .nta-chip--marked,
        .nta-chip--marked-answered { color: var(--a-purple-text, #c4b5fd); border-color: rgba(168,85,247,.42); background: rgba(168,85,247,.1); }
        .nta-chip--visited { color: var(--a-bad-text, #fca5a5); border-color: rgba(248,113,113,.34); background: rgba(248,113,113,.08); }
        .nta-text-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.025));
          color: var(--a-ink-2, #d4d4d8);
          padding: 0 10px;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .nta-text-button:hover { border-color: var(--a-line-hover, rgba(255,255,255,.24)); color: var(--a-ink, #fff); }
        .nta-question-text {
          margin: 0 0 18px;
          max-width: 74ch;
          color: var(--a-ink, #f8faf0);
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 750;
          line-height: 1.55;
          letter-spacing: 0;
        }
        .nta-options {
          display: grid;
          gap: 10px;
        }
        .nta-option {
          width: 100%;
          min-height: 54px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
          border: 1px solid var(--a-line, rgba(255,255,255,.11));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.018));
          color: var(--a-ink-2, #e4e4e7);
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }
        .nta-option:hover {
          border-color: var(--a-line-hover, rgba(255,255,255,.26));
          background: var(--a-hover, rgba(255,255,255,.035));
        }
        .nta-option.is-selected {
          border-color: rgba(210,240,0,.72);
          background: rgba(210,240,0,.08);
        }
        .nta-option-letter {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--a-hover, rgba(255,255,255,.06));
          color: var(--a-ink-3, #a1a1aa);
          font-family: var(--font-display);
          font-weight: 900;
        }
        .nta-option.is-selected .nta-option-letter {
          background: var(--volt);
          color: #050600;
        }
        .nta-option-text {
          min-width: 0;
          font-size: 14px;
          line-height: 1.55;
        }
        .nta-navigation {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 22px 22px;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .nta-nav-button,
        .nta-submit-button,
        .nta-mobile-actions button {
          min-height: 44px;
          border: 1px solid var(--a-line, rgba(255,255,255,.12));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.03));
          color: var(--a-ink, #f4f6ed);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .nta-nav-button:disabled,
        .nta-mobile-actions button:disabled,
        .nta-submit-button:disabled {
          opacity: .35;
          cursor: not-allowed;
        }
        .nta-nav-button.is-primary,
        .nta-submit-button,
        .nta-mobile-actions button.is-primary {
          border-color: var(--a-accent-text, var(--volt));
          background: var(--volt);
          color: #050600;
        }
        .nta-review-panel {
          position: sticky;
          top: 96px;
          display: grid;
          gap: 14px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          border-radius: 8px;
          background: var(--a-topbar, rgba(15,16,13,.94));
          padding: 14px;
          box-shadow: 0 18px 70px rgba(0,0,0,.22);
        }
        .nta-panel-section {
          display: grid;
          gap: 10px;
        }
        .nta-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .nta-summary-grid div {
          min-height: 58px;
          display: grid;
          align-content: center;
          gap: 4px;
          border: 1px solid var(--a-line, rgba(255,255,255,.08));
          border-radius: 8px;
          background: var(--a-hover, rgba(255,255,255,.025));
          padding: 9px;
        }
        .nta-summary-grid strong {
          color: var(--a-ink, #f8faf0);
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .nta-summary-grid span {
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .nta-palette-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .nta-palette-grid.is-compact {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
        .nta-palette-chip {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          min-height: 44px;
          border-radius: 7px;
          border: 1px solid var(--a-line, rgba(255,255,255,.1));
          background: var(--a-hover, rgba(255,255,255,.04));
          color: var(--a-ink-3, #a1a1aa);
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .nta-palette-chip.is-current {
          outline: 2px solid var(--volt);
          outline-offset: 2px;
        }
        .nta-palette-chip--answered {
          background: rgba(74,222,128,.16);
          border-color: rgba(74,222,128,.5);
          color: var(--a-good-text, #86efac);
        }
        .nta-palette-chip--visited {
          background: rgba(248,113,113,.1);
          border-color: rgba(248,113,113,.42);
          color: var(--a-bad-text, #fca5a5);
        }
        .nta-palette-chip--marked,
        .nta-palette-chip--marked-answered {
          background: rgba(168,85,247,.14);
          border-color: rgba(168,85,247,.5);
          color: var(--a-purple-text, #c4b5fd);
        }
        .nta-palette-chip--marked-answered::after {
          content: '';
          position: absolute;
          right: 5px;
          bottom: 5px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #86efac;
          box-shadow: 0 0 0 1px rgba(0,0,0,.65);
        }
        .nta-legend {
          display: grid;
          gap: 6px;
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .05em;
        }
        .nta-legend span {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .legend {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          border: 1px solid var(--a-line, rgba(255,255,255,.14));
          display: inline-block;
        }
        .legend.answered { background: rgba(74,222,128,.16); border-color: rgba(74,222,128,.5); }
        .legend.marked { background: rgba(168,85,247,.14); border-color: rgba(168,85,247,.5); }
        .legend.visited { background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.42); }
        .legend.notvisited { background: var(--a-hover, rgba(255,255,255,.04)); }
        .nta-mobile-actions,
        .nta-mobile-sheet {
          display: none;
        }
        @media (max-width: 1180px) {
          .nta-grid {
            grid-template-columns: minmax(0, 1fr) 270px;
          }
          .nta-paper {
            max-width: none;
          }
        }
        @media (max-width: 1023px) {
          .nta-test-header {
            grid-template-columns: 1fr auto;
            gap: 12px;
            min-height: auto;
            padding: 10px 12px;
          }
          .nta-header-progress {
            grid-column: 1 / -1;
            order: 3;
          }
          .nta-title-stack strong {
            max-width: 48vw;
          }
          .nta-timer {
            min-width: 108px;
          }
          .nta-shell {
            padding: 14px 12px 96px;
          }
          .nta-grid {
            display: block;
          }
          .nta-review-panel {
            display: none;
          }
          .nta-paper-head {
            align-items: flex-start;
            flex-direction: column;
            padding: 16px;
          }
          .nta-paper-head h1 {
            font-size: 20px;
          }
          .nta-paper-tags {
            justify-content: flex-start;
          }
          .nta-passage {
            margin: 16px;
            padding: 14px;
          }
          .nta-passage p {
            font-size: 14px;
            line-height: 1.75;
          }
          .nta-question-block {
            padding: 16px;
          }
          .nta-question-meta {
            align-items: flex-start;
            flex-direction: column;
          }
          .nta-question-text {
            font-size: 18px;
            line-height: 1.55;
          }
          .nta-option {
            min-height: 48px;
          }
          .nta-navigation {
            display: none;
          }
          .nta-mobile-actions {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 42;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid rgba(255,255,255,.1);
            background: var(--a-topbar, rgba(8,9,7,.94));
            backdrop-filter: blur(16px);
          }
          .nta-mobile-actions button {
            min-width: 0;
            padding: 0 10px;
            font-size: 12px;
          }
          .nta-mobile-sheet {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 80;
          }
          .nta-sheet-backdrop {
            position: absolute;
            inset: 0;
            border: 0;
            background: rgba(0,0,0,.62);
          }
          .nta-sheet-panel {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            max-height: min(78vh, 620px);
            max-height: min(78dvh, 620px);
            overflow: auto;
            border-radius: 14px 14px 0 0;
            border: 1px solid var(--a-line, rgba(255,255,255,.12));
            background: var(--a-raised, #0f100d);
            padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
            display: grid;
            gap: 14px;
          }
          .nta-sheet-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .nta-sheet-head strong {
            display: block;
            margin-top: 3px;
            font-family: var(--font-display);
            font-size: 18px;
            color: var(--a-ink, #fff);
          }
        }
        @media (max-width: 520px) {
          .nta-palette-grid.is-compact {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .nta-question-actions {
            width: 100%;
          }
          .nta-text-button {
            flex: 1;
            justify-content: center;
            min-height: 44px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nta-option,
          .nta-icon-button,
          .nta-nav-button,
          .nta-submit-button {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function TestPageClient() {
  return (
    <Suspense fallback={<PageSpinner label="Loading test..." />}>
      <TestRunner />
    </Suspense>
  );
}
