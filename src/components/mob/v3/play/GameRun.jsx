"use client";
// R1 to R6, a Mob game run on the web (MOB-BUILD-SPEC-V3 5.3; motion M4, M5, M5b, M6, M6b in 5.6).
//
// What a student sees, in order: the paper ruler with full-body Folds (theirs, and friends' recorded runs as
// ghosts walking by their real arrival times), "Question 3 of 5" with "+5 if right, -1 if wrong", the question at
// 17/26, options A to D, and "Skip" and "Lock in B". After the server answers: "Right." with a drawn tick and +5,
// or "Not this one." on their own option only (the right option is never marked before the game closes, F1).
// Then "You played all 5." with the server's marks and "See the podium".
//
// Truth: every mark is the server's. The page computes only where the ghosts stand and the pace chip (spec R4).
// Answers retry with the same question and pick (the server keeps the first), and "Saving your answer" shows
// only after 600 ms with no reply.
//
// Live rooms (Phase B): LiveRoom passes `live` once the countdown lands. The ruler then shows the members in the room
// moving on the server's progress broadcasts instead of ghosts, the header says who is in the room, each answer the
// API acknowledges moves your Fold for everyone, and the end waits for the room ("Riya is still playing").
//
// A timed race (D167) is the same run with a clock instead of a count: a 3, 2, 1 before /run (the server starts the
// clock there), "Question 7" with the time left, one question served at a time (the answer's `next`), your option
// showing right or not for a moment before the next one rises (no Next key: the clock is running), friends' runs as
// ghosts by questions answered, and "You answered 14 in 5 minutes." at the end. The podium and moments are the same.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { mobGameApi, withRetry } from './playApi';
import { PlayFold } from './PlayFold';
import { RulerRace } from './RulerRace';
import { COPY, LETTERS, errorSentence, nextQuestionIndex, paceChip, rightStreak, rulerRacers, stopwatch, ghostAt } from './playModel.mjs';
import { FORMAT_COPY, MOCK, RACE_FEEDBACK_MS, isMock, isRace, mockRunnerHref, raceClock, racePace, raceRacers, raceMinutes, raceWindow } from './formats.mjs';
import { LiveCountdown } from '../live/LiveCountdown';
import { BEAT_MS, COUNT_FROM } from '../live/liveModel.mjs';
import '../live/live.css';

const SAVING_AFTER_MS = 600;
const FADE_OUT_MS = 140;
// The race's own 3, 2, 1 before /run: a short "get set", then three beats, Go on the beat after.
const GET_SET_MS = 500;
const prefersReduced = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');

function useNow(active, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}

// `paper`: { subject, mobId, memberId } from the den view, for a full mock's runner link.
export default function GameRun({ gameId, autoStart = false, me = null, hrefs, onGame, live = null, paper = null }) {
  const [phase, setPhase] = useState('loading');
  const [game, setGame] = useState(null);
  const [run, setRun] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [ghosts, setGhosts] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState(null);
  const [sending, setSending] = useState(false);
  const [savingShown, setSavingShown] = useState(false);
  const [result, setResult] = useState(null);
  const [marks, setMarks] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [toast, setToast] = useState(null);
  const [fading, setFading] = useState(false);
  const [nod, setNod] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [goAt, setGoAt] = useState(null); // a race's own 3, 2, 1: when Go lands (this device's clock)
  const [tally, setTally] = useState(null); // a race's finish: { answered, right, wrong, skipped }
  const offset = useRef(0);
  const flagged = useRef(new Set());
  const starting = useRef(false);
  const advanceTimer = useRef(null);
  const gameRef = useRef(null); // the game as the last read gave it, for the callbacks below
  const now = useNow(phase === 'play');

  const race = isRace(game);
  const count = game?.count || questions.length || 5;
  const serverNow = now + offset.current;
  const startedMs = run ? Date.parse(run.startedAt) : 0;
  const t = run ? Math.max(0, serverNow - startedMs) : 0;
  const closesAt = game?.closesAt;
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  // A race: the 3, 2, 1 runs on this page before /run, so the server's clock starts at Go, not during the count.
  const getSet = useCallback(() => {
    setGoAt(Date.now() + GET_SET_MS + COUNT_FROM * BEAT_MS);
    setPhase('getset');
  }, []);

  const begin = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    setPhase('loading');
    setError(null);
    try {
      const body = await mobGameApi.run(gameId);
      offset.current = Date.parse(body.run.serverNow) - Date.now();
      const stored = body.run.answers || [];
      // A race serves its questions one at a time, so its length is the pool on the game, never the questions so far.
      const g0 = gameRef.current;
      const n = isRace(g0) ? (g0.count || 30) : (body.questions?.length || 5);
      setRun(body.run);
      setQuestions(body.questions || []);
      setGhosts(body.ghosts || []);
      setAnswers(stored);
      const t0 = Date.parse(body.run.serverNow) - Date.parse(body.run.startedAt);
      flagged.current = new Set((body.ghosts || []).filter((g) => ghostAt(g, t0, n).finished).map((g) => g.memberId));
      const next = nextQuestionIndex(stored, n);
      if (stored.length) live?.onAnswered?.(stored.length, next >= n);
      setIndex(next);
      if (next >= n) {
        const done = await mobGameApi.finish(gameId).catch(() => null);
        setMarks(done?.run?.marks ?? null);
        setPhase('done');
      } else setPhase('play');
    } catch (e) {
      if (e.code === 'RUN_DONE') {
        const g = await mobGameApi.game(gameId).catch(() => null);
        if (g?.game) { setGame(g.game); setMarks(g.game.you?.marks ?? null); }
        setPhase('done');
      } else if (e.code === 'GAME_CLOSED') {
        setNotice(errorSentence(e));
        setPhase('closed');
      } else {
        setError(errorSentence(e));
        setPhase('failed');
      }
    } finally {
      starting.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const load = useCallback(async () => {
    try {
      const { game: g } = await mobGameApi.game(gameId);
      gameRef.current = g;
      setGame(g);
      onGame?.(g);
      offset.current = Date.parse(g.serverNow) - Date.now();
      // A full mock together is sat in the full-mock runner: this page is only its card, before and after.
      if (isMock(g)) { setMarks(g.you?.marks ?? null); setPhase(g.you?.run === 'finished' ? 'mock-done' : g.closed ? 'closed' : 'mock'); return; }
      if (g.you?.run === 'finished') { setMarks(g.you.marks ?? null); setPhase('done'); return; }
      if (g.closed) { setNotice(COPY.gameClosed); setPhase('closed'); return; }
      if (g.you?.run === 'playing') { await begin(); return; }
      // A race counts 3, 2, 1 here first (a live room has already counted everyone in together).
      if (autoStart) { if (isRace(g) && !live) getSet(); else await begin(); return; }
      setPhase('ready');
    } catch (e) {
      setError(errorSentence(e));
      setPhase('failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, autoStart, begin, onGame, getSet]);

  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);

  // A ghost reaching the flag during your run (M6): a quiet toast, never a count of who is still playing.
  useEffect(() => {
    // A race has no flag: its clock ends it, so a ghost never "reaches the flag".
    if (phase !== 'play' || !run || live || race) return undefined;
    const started = Date.parse(run.startedAt);
    const h = setInterval(() => {
      const at = Date.now() + offset.current - started;
      for (const g of ghosts) {
        if (flagged.current.has(g.memberId) || !ghostAt(g, at, count).finished) continue;
        flagged.current.add(g.memberId);
        setToast({ key: `${g.memberId}`, text: COPY.ghostFinished(g.name) });
      }
    }, 250);
    return () => clearInterval(h);
  }, [ghosts, phase, count, run, live, race]);
  useEffect(() => {
    if (!toast) return undefined;
    const h = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(h);
  }, [toast]);

  const finish = useCallback(async () => {
    setSending(true);
    try {
      const body = await withRetry(() => mobGameApi.finish(gameId));
      setMarks(body?.run?.marks ?? marks);
      if (body?.run && Number.isFinite(body.run.answered)) setTally(body.run);
      live?.onAnswered?.(count, true);
      setPhase('done');
    } catch (e) {
      setError(errorSentence(e));
    } finally {
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, marks, count]);

  // Out of time: the server counts the rest as skipped.
  const endsMs = run ? Date.parse(run.endsAt) : 0;
  const expired = useRef(false);
  useEffect(() => {
    if (phase === 'play' && run && serverNow > endsMs && !sending && !result && !expired.current) {
      expired.current = true;
      clearTimeout(advanceTimer.current);
      // A race's end is its clock, and its done screen says so; a sprint says the rest count as skipped.
      if (!race) setNotice(COPY.timeUp);
      finish();
    }
  }, [phase, run, serverNow, endsMs, sending, result, finish, race]);

  const send = useCallback(async (p) => {
    if (sending || result || phase !== 'play') return;
    const q = (questions.find((x) => x.q === index) || questions[index])?.q ?? index;
    setSending(true);
    setError(null);
    if (p >= 0) setNod((n) => n + 1);
    const slow = setTimeout(() => setSavingShown(true), SAVING_AFTER_MS);
    try {
      const body = await withRetry(() => mobGameApi.answer(gameId, q, p));
      const entry = { q, pick: p, correct: body.correct, elapsedMs: body.elapsedMs };
      const nextAnswers = [...answers.filter((a) => a.q !== q), entry];
      setAnswers(nextAnswers);
      setMarks(body.marks);
      // A race: the server serves the next question with this answer, and may move the clock's end.
      if (race && body.next && Number.isInteger(body.next.q)) setQuestions((list) => (list.some((x) => x.q === body.next.q) ? list : [...list, body.next]));
      if (race && body.endsAt) setRun((r) => (r ? { ...r, endsAt: body.endsAt } : r));
      const over = race ? Boolean(body.finished) || !body.next : Boolean(body.finished) || nextAnswers.length >= (questions.length || count);
      live?.onAnswered?.(nextAnswers.length, over);
      if (race) {
        // No Next key in a race: your option shows right or not for a moment, then the next question rises.
        if (body.correct !== null) setResult({ ...body, race: true });
        const wait = prefersReduced() ? 260 : RACE_FEEDBACK_MS[body.correct === true ? 'right' : body.correct === false ? 'wrong' : 'skip'];
        clearTimeout(advanceTimer.current);
        advanceTimer.current = setTimeout(() => advance(nextAnswers, over), wait);
      } else if (body.correct === null) {
        // A skip moves straight on; skipping costs nothing.
        advance(nextAnswers, body.finished);
      } else {
        const streak = rightStreak(nextAnswers);
        setResult({ ...body, three: body.correct === true && streak === 3 && !stamped });
        if (body.correct === true && streak === 3) setStamped(true);
      }
    } catch (e) {
      if (e.code === 'RUN_EXPIRED') {
        setMarks(e.detail?.run?.marks ?? marks);
        if (race && e.detail?.run) setTally(e.detail.run);
        else setNotice(errorSentence(e));
        setPhase('done');
      } else setError(errorSentence(e));
    } finally {
      clearTimeout(slow);
      setSavingShown(false);
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, result, phase, questions, index, gameId, answers, stamped, marks, race]);

  function advance(list, finished) {
    const n = race ? count : (questions.length || count);
    const next = nextQuestionIndex(list, n);
    if (finished || next >= n) { finish(); return; }
    setFading(true);
    setTimeout(() => {
      setIndex(next);
      setPick(null);
      setResult(null);
      setFading(false);
    }, FADE_OUT_MS);
  }

  // Keys for a keyboard: A to D or 1 to 4 pick, Enter locks in or moves on.
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const opts = (questions.find((x) => x.q === index) || questions[index])?.options?.length || 4;
      const k = e.key.toUpperCase();
      const n = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : /^[1-9]$/.test(k) ? Number(k) - 1 : -1;
      if (!result && !sending && n >= 0 && n < opts) { setPick(n); e.preventDefault(); }
      else if (e.key === 'Enter') {
        if (result?.race) { clearTimeout(advanceTimer.current); advance(answers, Boolean(result.finished) || !result.next); e.preventDefault(); }
        else if (result) { advance(answers, result.finished); e.preventDefault(); }
        else if (pick !== null && !sending) { send(pick); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const you = useMemo(() => ({
    fold: me?.fold, colour: me?.colour ?? 0, answered: answers.length,
    finished: phase === 'done', arrivedMs: answers.reduce((m, a) => Math.max(m, a.elapsedMs ?? 0), 0),
  }), [me, answers, phase]);
  const liveRacersFor = live?.racersFor;
  const minutes = raceMinutes(game);
  // A race's ruler shows a window that grows in fives with the leader (raceWindow), and nobody stands at a flag.
  const ruler = useMemo(() => {
    if (!race) return { racers: liveRacersFor ? liveRacersFor(you) : rulerRacers({ count, ghosts, you, t }), window: count };
    if (!liveRacersFor) return raceRacers({ ghosts, you, t, minutes, pool: count });
    const list = liveRacersFor(you).map((r) => ({ ...r, finished: false, at: r.finished ? Math.max(1, r.at - 1) : r.at }));
    const window = raceWindow(list.reduce((m, r) => Math.max(m, r.at), 0), count);
    return { racers: list.map((r) => ({ ...r, at: Math.min(window, r.at) })), window };
  }, [race, liveRacersFor, count, ghosts, you, t, minutes]);
  const racers = ruler.racers;
  const pace = live ? null : race ? racePace(answers.length, t, ghosts) : paceChip(answers, ghosts);
  const overlay = goAt ? (
    <LiveCountdown startsAt={goAt} serverNow={Date.now} heads={[{ memberId: 'you', name: 'You', fold: me?.fold, colour: me?.colour ?? 0 }, ...(game?.ghosts || []).slice(0, 4)]}
      headsLabel={COPY.runsToRace((game?.ghosts || []).length)} line={FORMAT_COPY.raceRule(minutes)} count={count}
      onGo={() => { begin(); }} onOver={() => setGoAt(null)} />
  ) : null;
  const shownToast = live ? live.toast : toast;
  const title = game ? COPY.gameTitle(game) : '';
  const youPose = result?.correct === true ? 'cheer' : result?.correct === false ? 'shrug' : 'idle';

  // ---- Loading, failed, ready, closed ----
  if (phase === 'loading' || phase === 'getset') {
    return (
      <section className="mp-run mp-run--loading" aria-busy="true">
        <RunHead title={title} sub={phase === 'getset' ? FORMAT_COPY.getSet : COPY.runLoading} hrefs={hrefs} />
        <div className="mp-ruler mp-skel" aria-hidden="true" />
        <div className="mp-skel mp-skel--line" aria-hidden="true" />
        <div className="mp-skel mp-skel--q" aria-hidden="true" />
        <p className="mp-sr" role="status">{phase === 'getset' ? FORMAT_COPY.getSet : COPY.runLoading}</p>
        {overlay}
      </section>
    );
  }
  if (phase === 'failed') {
    return (
      <section className="mp-run">
        <RunHead title={title} sub="" hrefs={hrefs} />
        <div className="mp-card mp-card--center" role="alert">
          <h2 className="mp-h2">{COPY.loadFailed}</h2>
          <p className="mp-line">{error}</p>
          <div className="mp-keys"><button type="button" className="btn-volt md mp-key-primary" onClick={() => { setPhase('loading'); setError(null); if (game) begin(); else load(); }}>{COPY.tryAgain}</button></div>
        </div>
      </section>
    );
  }
  if (phase === 'closed') {
    return (
      <section className="mp-run">
        <RunHead title={title} sub={COPY.finalLabel} hrefs={hrefs} />
        <div className="mp-card mp-card--center">
          <h2 className="mp-h2">{notice}</h2>
          <div className="mp-keys">
            {game?.podiumReady ? <Link className="btn-volt md mp-key-primary" href={hrefs.podium}>{isMock(game) ? FORMAT_COPY.seeSheets : COPY.seePodium}</Link> : null}
            <Link className="mp-key" href={hrefs.den}>{COPY.backToDen}</Link>
          </div>
        </div>
      </section>
    );
  }
  if ((phase === 'mock' || phase === 'mock-done') && game) {
    const satLine = FORMAT_COPY.satSoFar(game.runs, serverNow);
    const done = phase === 'mock-done';
    const runner = mockRunnerHref({ subject: paper?.subject, mobId: game.mobId || paper?.mobId, gameId, memberId: paper?.memberId || 'me' });
    const shown = Number.isFinite(marks) ? marks : game.you?.marks;
    return (
      <section className={`mp-run ${done ? 'mp-run--done' : 'mp-run--ready'} mp-run--mock`}>
        <RunHead title={title} sub={done ? (game.closed ? COPY.finalLabel : COPY.soFar) : FORMAT_COPY.mockSubHead} hrefs={hrefs} />
        <div className={done ? 'mp-done' : 'mp-ready'}>
          <div className={done ? 'mp-done__stage' : 'mp-ready__stage'} aria-hidden="true">
            <span className="mp-ready__lamp" />
            <span className="mp-mock__sheet" />
            <span className={done ? 'mp-done__fold' : 'mp-ready__you'}><PlayFold fold={me?.fold} pose={done ? 'cheer' : 'think'} size={done ? 120 : 92} name="You" colour={me?.colour ?? 0} /></span>
          </div>
          {done ? (
            <>
              <h2 className="mp-h1">{FORMAT_COPY.satMock}</h2>
              {Number.isFinite(shown) ? <p className="mp-figure"><span className="mp-figure__n">{shown}</span><span className="mp-figure__w">{FORMAT_COPY.ofMarks(MOCK.marks)}</span></p> : null}
              {satLine ? <p className="mp-runs">{satLine}</p> : null}
              {!game.closed && closesAt ? <p className="mp-line">{FORMAT_COPY.sheetsWait(closesAt, serverNow)}</p> : null}
              <div className="mp-keys mp-keys--done">
                <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.podium}>{game.closed ? FORMAT_COPY.seeSheets : FORMAT_COPY.seeSheetsSoFar}</Link>
                {game.you?.resultId ? <Link className="mp-key" href={`/result/${encodeURIComponent(game.you.resultId)}`}>{FORMAT_COPY.yourResult}</Link> : null}
                <Link className="mp-link" href={hrefs.den}>{COPY.backToDen}</Link>
              </div>
            </>
          ) : (
            <div className="mp-card mp-ready__card">
              <h2 className="mp-h2">{title}</h2>
              <p className="mp-line">{FORMAT_COPY.mockOpenLine(game, serverNow)}</p>
              {satLine ? <p className="mp-runs">{satLine}</p> : null}
              <p className="mp-rule"><span className="mp-stamp-mini" aria-hidden="true">+5</span>{FORMAT_COPY.mockRule}</p>
              <div className="mp-keys">
                <Link className="btn-volt md mp-key-primary" data-page-primary="" href={runner}>{game.you?.run === 'playing' ? FORMAT_COPY.carryOn : FORMAT_COPY.sitMock}</Link>
                <Link className="mp-link" href={hrefs.den}>{COPY.backToDen}</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }
  if (phase === 'ready' && game) {
    const runsLine = COPY.runsSoFar(game.runs, serverNow);
    const roomRunning = game.room && game.room.state === 'running' && game.room.startsAt;
    return (
      <section className="mp-run mp-run--ready">
        <RunHead title={title} sub={COPY.runsToRace((game.ghosts || []).length)} hrefs={hrefs} />
        <div className="mp-ready">
          <div className="mp-ready__stage" aria-hidden="true">
            <span className="mp-ready__lamp" />
            {(game.ghosts || []).slice(0, 4).map((g, i) => (
              <span key={g.memberId} className="mp-ready__ghost" style={{ '--i': i }}><PlayFold fold={g.fold} size={72} name={g.name} colour={g.colour} ghost /></span>
            ))}
            <span className="mp-ready__you"><PlayFold fold={me?.fold} size={92} name="You" colour={me?.colour ?? 0} /></span>
          </div>
          <div className="mp-card mp-ready__card">
            <h2 className="mp-h2">{title}</h2>
            <p className="mp-line">{race ? FORMAT_COPY.raceOpenLine(game, serverNow) : COPY.openLine(game, serverNow)}</p>
            {runsLine ? <p className="mp-runs">{runsLine}</p> : null}
            <p className="mp-hint">{roomRunning ? COPY.roomStarted(game.room.startsAt, game.closesAt, serverNow) : COPY.anytimeLine}</p>
            <p className="mp-rule"><span className="mp-stamp-mini" aria-hidden="true">+5</span>{race ? FORMAT_COPY.raceRule(minutes) : COPY.countdownNextN(game.count)}</p>
            <div className="mp-keys">
              <button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={race ? getSet : begin}>{roomRunning ? COPY.playItNow : COPY.playKey(game)}</button>
              <Link className="mp-link" href={hrefs.den}>{COPY.backToDen}</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---- R6, the run is done ----
  if (phase === 'done') {
    const shown = Number.isFinite(marks) ? marks : game?.you?.marks;
    return (
      <section className="mp-run mp-run--done">
        <RunHead title={title} sub={closesAt && !game?.closed ? COPY.soFar : COPY.finalLabel} hrefs={hrefs} />
        <div className="mp-done">
          <div className="mp-done__stage" aria-hidden="true">
            <span className="mp-ready__lamp" />
            <span className="mp-done__fold"><PlayFold fold={me?.fold} pose="cheer" size={120} name="You" colour={me?.colour ?? 0} /></span>
          </div>
          {notice ? <p className="mp-hint" role="status">{notice}</p> : null}
          {race ? <p className="mp-hint">{FORMAT_COPY.raceTime}</p> : null}
          <h2 className="mp-h1">{race ? raceDoneTitle(tally?.answered ?? answers.length ?? game?.you?.answered, count, minutes) : COPY.playedAll(count)}</h2>
          {Number.isFinite(shown) ? (
            <p className="mp-figure"><span className="mp-figure__n">{shown}</span><span className="mp-figure__w">{COPY.marksWord(shown)}</span></p>
          ) : null}
          {race && tally && Number.isFinite(tally.right) ? <p className="mp-runs">{FORMAT_COPY.raceCounts(tally)}</p> : null}
          {live && !live.podiumOpen
            ? <p className="mp-line" role="status">{live.stillPlayingLine}</p>
            : closesAt && !game?.closed ? <p className="mp-line">{COPY.placesCanChange(closesAt, serverNow)}</p> : null}
          <div className="mp-keys mp-keys--done">
            {live && !live.podiumOpen ? null : <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.podium}>{COPY.seePodium}</Link>}
            <Link className="mp-link" href={hrefs.den}>{COPY.backToDen}</Link>
          </div>
        </div>
      </section>
    );
  }

  // ---- R1 to R5, playing ----
  const question = questions.find((x) => x.q === index) || (race ? null : questions[index]);
  const elapsed = Math.max(0, Math.floor(t / 1000));
  const clock = race && run ? raceClock(Date.parse(run.endsAt), serverNow) : null;
  return (
    <section className="mp-run mp-run--play">
      <RunHead
        title={title}
        sub={live ? live.sub : COPY.runsToRace(ghosts.length)}
        live={Boolean(live)}
        hrefs={hrefs}
        onClose={() => setLeaving(true)}
        chip={clock
          ? <span className={`mp-clock mp-clock--left${clock.low ? ' is-low' : ''}`} role="timer" aria-label={FORMAT_COPY.timeLeft(clock.text)}><StopwatchIcon />{clock.text}</span>
          : <span className="mp-clock" role="timer" aria-label={COPY.runClock(stopwatch(elapsed))}><StopwatchIcon />{stopwatch(elapsed)}</span>}
      />
      <RulerRace count={ruler.window} racers={racers} answered={answers.length} youPose={youPose} youNod={nod} race={race} />
      <div className="mp-under">
        <p className={`mp-caption${live?.busy ? ' is-busy' : ''}`}>{live?.caption || COPY.rulerCaption}</p>
        {pace ? <span key={pace.text} className="mp-pace" aria-live="polite">{pace.text}</span> : null}
      </div>
      <div className={`mp-q${fading ? ' is-out' : ''}`} key={index}>
        <div className="mp-q__meta"><span>{race ? FORMAT_COPY.questionN(index + 1) : COPY.questionOf(index + 1, count)}</span><span>{COPY.marksRule}</span></div>
        {question?.passage ? <div className="mp-passage">{question.passage}</div> : null}
        <h2 className="mp-q__stem">{question?.stem}</h2>
        <div className="mp-opts" role="radiogroup" aria-label={race ? FORMAT_COPY.questionN(index + 1) : COPY.questionOf(index + 1, count)}>
          {(question?.options || []).map((text, k) => {
            const picked = pick === k;
            const locked = picked && (sending || result);
            const state = result && picked ? (result.correct ? 'right' : 'wrong') : null;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={picked}
                aria-label={`${COPY.optionLabel(LETTERS[k], text)}${state === 'right' ? `, ${COPY.optionRight}` : state === 'wrong' ? `, ${COPY.optionWrong}` : ''}`}
                className={`mp-opt${picked ? ' is-picked' : ''}${locked ? ' is-locked' : ''}${state ? ` is-${state}` : ''}${(sending || result) && !picked ? ' is-dim' : ''}`}
                disabled={Boolean(result) || sending}
                onClick={() => setPick(k)}
              >
                <span className="mp-opt__letter">{LETTERS[k]}</span>
                <span className="mp-opt__text">{text}</span>
                {locked && !state ? <ClipIcon /> : null}
                {state === 'right' ? <TickIcon /> : null}
                {state ? <span className={`mp-opt__delta is-${state}`}>{COPY.delta(result.delta)}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {error ? <p className="mp-error" role="alert">{error}</p> : null}
      <div className="mp-dock">
        {result?.race ? <p className="mp-sr" role="status">{result.correct ? FORMAT_COPY.rightShort : FORMAT_COPY.wrongShort}</p> : null}
        {result && !result.race ? (
          <div className={`mp-panel is-${result.correct ? 'right' : 'wrong'}`} role="status">
            <div className="mp-panel__text">
              <p className="mp-panel__title">{result.correct ? (result.three ? COPY.rightThree : COPY.right) : COPY.notThisOne}</p>
              <p className="mp-panel__line">{result.correct ? COPY.rightLine : COPY.wrongLine(closesAt, serverNow)}</p>
            </div>
            {result.three ? <span className="mp-stamp" aria-hidden="true">{COPY.threeInARow}</span> : null}
            <button type="button" className="btn-volt md mp-key-primary mp-panel__key" onClick={() => advance(answers, result.finished)} autoFocus>
              {result.finished || answers.length >= count ? COPY.seeHowYouDid : COPY.nextQuestion}
            </button>
          </div>
        ) : (
          <div className="mp-dock__keys">
            {savingShown ? <p className="mp-saving" role="status">{COPY.saving}</p> : null}
            <button type="button" className="mp-key mp-key--skip" onClick={() => { setPick(null); send(-1); }} disabled={sending || Boolean(result)}>{COPY.skip}</button>
            <button type="button" className="btn-volt md mp-key-primary mp-key--lock" onClick={() => send(pick)} disabled={pick === null || sending || Boolean(result)} aria-busy={sending || undefined}>
              {pick === null ? COPY.pickAnAnswer : COPY.lockIn(LETTERS[pick])}
            </button>
          </div>
        )}
      </div>
      {shownToast ? <p key={shownToast.key} className="mp-toast" role="status">{shownToast.text}</p> : null}
      {leaving ? (
        <div className="mp-dialog" role="dialog" aria-modal="true" aria-labelledby="mp-leave-title">
          <div className="mp-dialog__card">
            <h2 id="mp-leave-title" className="mp-h2">{COPY.leaveRun}</h2>
            <p className="mp-line">{COPY.leaveRunLine}</p>
            <div className="mp-keys mp-keys--row">
              <button type="button" className="btn-volt md mp-key-primary" onClick={() => setLeaving(false)} autoFocus>{COPY.keepPlaying}</button>
              <Link className="mp-key" href={hrefs.den}>{COPY.leave}</Link>
            </div>
          </div>
        </div>
      ) : null}
      {overlay}
    </section>
  );
}

/** "You answered 14 in 5 minutes.", or "You answered all 30." when a race runs out of questions before the clock. */
function raceDoneTitle(answered, pool, minutes) {
  const n = Number(answered) || 0;
  return n >= pool ? FORMAT_COPY.raceAll(pool) : FORMAT_COPY.raceDone(n, minutes);
}

export function RunHead({ title, sub, hrefs, onClose, chip, live = false }) {
  return (
    <div className="mp-head">
      {onClose ? (
        <button type="button" className="mp-icon" onClick={onClose} aria-label={COPY.closeRun}><X size={22} strokeWidth={2.2} aria-hidden="true" /></button>
      ) : (
        <Link className="mp-icon" href={hrefs.den} aria-label={COPY.backToDen}><X size={22} strokeWidth={2.2} aria-hidden="true" /></Link>
      )}
      <div className="mp-head__text">
        <h1 className="mp-head__title">{title}</h1>
        {sub ? <p className="mp-head__sub">{live ? <span className="lv-dot" aria-hidden="true" /> : null}{sub}</p> : null}
      </div>
      {chip || null}
    </div>
  );
}

function StopwatchIcon() {
  return (
    <svg className="mp-clock__icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="11.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 11.5V8.2M8.2 2.8h3.6M10 2.8v2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg className="mp-clip" viewBox="0 0 16 28" width="14" height="26" aria-hidden="true">
      <path d="M5 26V6a3 3 0 0 1 6 0v16a1.6 1.6 0 0 1-3.2 0V8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg className="mp-tick" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
    </svg>
  );
}
