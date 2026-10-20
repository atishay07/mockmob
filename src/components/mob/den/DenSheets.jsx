"use client";
// The den's sheets on the web (MOB-BUILD-SPEC-V3 5.3 P1 to P4, SET): the play picker, start a game, pass the mic, Free
// and Pro, and Mob settings. Each is a centred dialog (the Mob's dialog rule: centred at every width, 16 px left on a
// phone). Every rule comes from the server's `starts` block: nothing here decides a plan. With billing off no Pro word
// appears in the picker or the start sheet (pro_nudge, spec 5.0). No price anywhere in the Mob (F4).
import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarDays, Check, FileText, Lock, Plus, Radio, Send, SlidersHorizontal, Timer } from 'lucide-react';
import { MobDialog } from '../MobDialog';
import { mobFetch } from '../useMob';
import { ToggleRow } from '@/components/ui/controls/ToggleRow';
import { MOB_NAMES } from '@/lib/mob/names.mjs';
import { paperHref, resultHref } from '@/lib/mob/model.mjs';
import { DenCopy, denError, foldName, FOLD_LINES } from '@/lib/mob/v3/denCopy.mjs';
import { liveOffer, namePage, openGames } from '@/lib/mob/v3/denModel.mjs';
import { FoldFigure } from './FoldFigure';
import { gameCardHref, gameHref, podiumHref } from './denRoutes';
import { FORMAT_COPY, RACE_MINUTES, formatTiles, isMock, isRace, startBody } from '../v3/play/formats.mjs';

// The four ways to play, one row each in the Start a game sheet (D167, K9: every way to play is obvious).
const FORMAT_ICON = { sprint: <Send size={18} />, round: <SlidersHorizontal size={18} />, race: <Timer size={18} />, mock: <FileText size={18} /> };
const FORMAT_TITLE = { sprint: FORMAT_COPY.sprint, round: FORMAT_COPY.round, race: FORMAT_COPY.race, mock: FORMAT_COPY.mock };
const FORMAT_SUB = { sprint: FORMAT_COPY.sprintSub, round: FORMAT_COPY.roundSub, race: FORMAT_COPY.raceSub, mock: FORMAT_COPY.mockSub };

/** The weekly paper row and the open games (P1 "Open now"). */
function OpenNow({ data, v3, now, onClose }) {
  const games = openGames(v3);
  const week = data.week;
  return (
    <section className="den-sheet__section" aria-labelledby="den-p1-open">
      <h3 id="den-p1-open" className="den-sheet__h">{DenCopy.openNow}</h3>
      <ul className="den-rows">
        {games.map((g, i) => {
          const lead = i === games.findIndex((x) => x.yourRun !== 'finished');
          const title = DenCopy.gameTitle({ ...g, youId: data.you?.memberId });
          const done = g.yourRun === 'finished';
          return (
            <li key={g.id} className="den-row">
              <span className="den-row__icon" aria-hidden="true">{FORMAT_ICON[g.format] || <Send size={18} />}</span>
              <span className="den-row__text"><b>{title}</b><span>{isRace(g) ? FORMAT_COPY.raceRow(g, now) : isMock(g) ? FORMAT_COPY.mockRow(g, now) : DenCopy.openRow(g, now)}</span></span>
              <Link className={!done && lead ? 'btn-volt md den-row__key' : 'mob-key den-row__key'} href={done ? podiumHref(g.id) : isMock(g) ? gameCardHref(g.id) : gameHref(g.id)} onClick={onClose}>{done ? DenCopy.podiumKey : isMock(g) ? DenCopy.sitIt : DenCopy.play}</Link>
            </li>
          );
        })}
        {!week.closed ? (
          <li className="den-row">
            <span className="den-row__icon" aria-hidden="true"><CalendarDays size={18} /></span>
            <span className="den-row__text"><b>{DenCopy.weeklyPaper}</b><span>{week.youSat ? DenCopy.satLine(null) : DenCopy.paperClock}</span></span>
            {week.youSat
              ? (week.yourResultId ? <Link className="mob-key den-row__key" href={resultHref(week.yourResultId)}>{DenCopy.marks}</Link> : null)
              : <Link className="mob-key den-row__key" href={paperHref(data)}>{DenCopy.sitIt}</Link>}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/**
 * P1. Play with your Mob: what is open now, then one row into the Start a game sheet, which holds every way to play
 * (MOB-MINIMAL 3.1: one sheet for starting, never two that both list the formats).
 */
export function PlayPicker({ open, onClose, data, v3, now, onStart, onAsk, onFreePro, proNudges = false, busy }) {
  const s = v3.starts || {};
  const billing = Boolean(s.billingOn);
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.pickerTitle} labelId="den-p1-h">
      <OpenNow data={data} v3={v3} now={now} onClose={onClose} />
      <button type="button" className="den-row den-row--button den-row--start" onClick={() => onStart({})}>
        <span className="den-row__icon den-row__icon--plus" aria-hidden="true"><Plus size={18} /></span>
        <span className="den-row__text"><b>{DenCopy.startAGame}</b><span>{FORMAT_COPY.startRowSub(formatTiles(s).map((t) => t.format))}</span></span>
      </button>
      <div className="den-sheet__foot">
        {billing && !s.can ? <button type="button" className="mob-key" onClick={onAsk} disabled={busy === 'sticker'}>{DenCopy.askForGame}</button> : null}
        {billing && proNudges ? <button type="button" className="mob-link" onClick={onFreePro}>{DenCopy.whatProAdds}</button> : null}
      </div>
    </MobDialog>
  );
}

/** The chapters the bank can make a game from (GET /api/mob/extra). A failed read leaves the whole subject. */
function useChapters(mobId, open) {
  const [state, setState] = useState({ status: 'idle', chapters: [] });
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    mobFetch(`/api/mob/extra${mobId ? `?mob=${encodeURIComponent(mobId)}` : ''}`).then((r) => {
      if (alive) setState(r.ok ? { status: 'ready', chapters: r.data.chapters || [] } : { status: 'error', chapters: [] });
    });
    return () => { alive = false; };
  }, [open, mobId]);
  return state;
}

const LENGTHS = [10, 15, 20];

/**
 * P2. Start a game: the one sheet for every way to play (D167, D168, MOB-MINIMAL 3.2). Top to bottom: Anytime or Live,
 * the rows (Sprint; Race with 5 or 10 minute chips; Your own round with 10, 15 or 20; Full mock together, "Anytime only"
 * in Live), what it covers with Change, one key naming the action, the start allowance, and this week's Mob paper.
 * Every rule comes from the server's `starts` block. `preset`: { format, mode, chapter, rematchOf }.
 */
export function StartGameSheet({ open, onClose, data, v3, mobName, preset, run, busy, onStarted, onPassMic, onFreePro, proNudges = false }) {
  const s = v3.starts || {};
  const live = liveOffer(v3);
  const tiles = formatTiles(s);
  const first = tiles.some((t) => t.format === preset?.format) ? preset.format : 'sprint';
  const [format, setFormat] = useState(first);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(5);
  const [mode, setMode] = useState(preset?.mode === 'live' && live.can && first !== 'mock' ? 'live' : 'async');
  const [chapter, setChapter] = useState(preset?.chapter || '');
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState(null);
  const chapters = useChapters(data.id, open && choosing);
  const selectId = useId();
  const liveModes = (s.modes || []).includes('live');
  const liveAllowed = live.can && liveModes;
  const playsLive = mode === 'live' && liveAllowed;
  // In Live the full mock is dimmed "Anytime only" (an hour-long paper is never one room); picking it goes back to Anytime.
  const pick = (f) => { setFormat(f); if (f === 'mock') setMode('async'); };
  const mock = format === 'mock';
  const tile = tiles.find((t) => t.format === format);
  const canStart = preset?.rematchOf ? s.can : Boolean(tile?.can) && !(mock && playsLive);
  const start = async () => {
    setError(null);
    const body = startBody({ format, count, minutes, mode, chapter: mock ? null : chapter, rematchOf: preset?.rematchOf || null, liveAllowed });
    const r = await run('/api/mob/game', body, { name: 'game' });
    if (!r.ok) {
      setError(denError(r));
      if (r.code === 'LIVE_BUSY' || r.code === 'LIVE_OFF' || r.code === 'LIVE_HOURS' || r.code === 'START_FORMAT') setMode('async');
      return;
    }
    onStarted?.(r.data?.game);
  };
  const key = FORMAT_COPY.startKey({ format, count, minutes, live: playsLive });
  const week = data.week;
  // The start allowance under the key (billing on), else the line that everyone plays free.
  let allowance = DenCopy.startUnder(mobName);
  if (s.billingOn) {
    if (s.micFrom && s.mics > 0) allowance = DenCopy.micPassed(s.micFrom.name);
    else if (!s.can) allowance = DenCopy.startUsed;
    else if (s.via === 'free_weekly' && s.freeLeft > 0) allowance = playsLive ? FORMAT_COPY.usesStart(s.freeLeft) : FORMAT_COPY.startsLeft(s.freeLeft);
    if (tile?.pro && tile.locked) allowance = DenCopy.anyoneWithPro;
  }
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.startAGame} labelId="den-p2-h">
      <p className="mob-note den-sheet__sub">{FORMAT_COPY.sheetSub(mobName, data.subjectName)}</p>
      {live.show ? (
        <div className="den-mode">
          <div className="den-seg den-seg--mode" role="radiogroup" aria-label={FORMAT_COPY.howTogether}>
            <button type="button" role="radio" aria-checked={!playsLive} className="den-seg__opt" onClick={() => setMode('async')}>
              <b>{FORMAT_COPY.anytime}</b><span>{FORMAT_COPY.anytimeTag}</span>
            </button>
            <button type="button" role="radio" aria-checked={playsLive} className="den-seg__opt" disabled={!liveAllowed} onClick={() => { setMode('live'); if (mock) setFormat('sprint'); }}>
              <b>{FORMAT_COPY.live}</b><span>{FORMAT_COPY.liveTag}</span>
            </button>
          </div>
          <p className="mob-note">{playsLive ? FORMAT_COPY.liveHow : FORMAT_COPY.anytimeHow}</p>
          {!liveModes && s.billingOn ? <p className="mob-hint">{FORMAT_COPY.liveIsPro}</p> : null}
          {!live.hoursOk ? <p className="mob-hint">{DenCopy.liveHours}</p> : null}
        </div>
      ) : <p className="mob-note">{FORMAT_COPY.anytimeHow}</p>}
      <div className="den-formats" role="radiogroup" aria-label={DenCopy.startAGame}>
        {tiles.map((t) => {
          const anytimeOnly = t.format === 'mock' && playsLive;
          const off = anytimeOnly || t.pro || (Boolean(s.can) && !t.can);
          const on = format === t.format && !off;
          return (
            <div key={t.format} className="den-format" data-on={on || undefined} data-off={off || undefined}>
              <button type="button" role="radio" aria-checked={on} className="den-format__pick" disabled={off} onClick={() => pick(t.format)}>
                <span className="den-format__icon" aria-hidden="true">{FORMAT_ICON[t.format]}</span>
                <span className="den-format__text"><b>{FORMAT_TITLE[t.format]}</b><span>{FORMAT_SUB[t.format]}</span></span>
                {anytimeOnly ? <span className="den-format__tag">{FORMAT_COPY.anytimeOnly}</span>
                  : t.pro ? <span className="den-format__tag"><Lock size={12} aria-hidden="true" />{FORMAT_COPY.proTag}</span>
                    : <span className="den-format__radio" aria-hidden="true" />}
              </button>
              {on && t.format === 'race' ? (
                <div className="den-format__chips" role="radiogroup" aria-label={FORMAT_COPY.howLong}>
                  {RACE_MINUTES.map((m) => <button key={m} type="button" role="radio" aria-checked={minutes === m} className="den-pill" onClick={() => setMinutes(m)}>{FORMAT_COPY.minutes(m)}</button>)}
                </div>
              ) : null}
              {on && t.format === 'round' ? (
                <div className="den-format__chips" role="radiogroup" aria-label={DenCopy.lengthLabel(count)}>
                  {LENGTHS.map((n) => <button key={n} type="button" role="radio" aria-checked={count === n} className="den-pill" aria-label={DenCopy.lengthLabel(n)} onClick={() => setCount(n)}>{n}</button>)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="den-covers den-covers--row">
        <span className="den-format__icon" aria-hidden="true"><BookOpen size={18} /></span>
        {mock ? <p className="den-covers__text">{FORMAT_COPY.mockCovers(data.subjectName)}</p>
          : <p className="den-covers__text">{chapter ? DenCopy.coversChapter(chapter) : DenCopy.coversWhole(data.subjectName)}</p>}
        {!mock && !choosing ? <button type="button" className="mob-link den-covers__change" onClick={() => setChoosing(true)} aria-label={`${DenCopy.change}: ${DenCopy.whatItCovers}`}>{DenCopy.change}</button> : null}
      </div>
      {!mock && choosing ? (
        <div className="mob-field den-covers__pick">
          <label className="mob-label" htmlFor={selectId}>{DenCopy.chapterLabel}</label>
          <select id={selectId} className="mob-input mob-select" value={chapter} disabled={chapters.status === 'idle'} onChange={(e) => { setChapter(e.target.value); setChoosing(false); }}>
            <option value="">{DenCopy.coversWhole(data.subjectName)}</option>
            {chapters.chapters.filter((c) => !c.longest || c.longest >= (format === 'round' ? count : format === 'race' ? 10 : 5)).map((c) => <option key={c.chapter} value={c.chapter}>{c.chapter}</option>)}
          </select>
        </div>
      ) : null}
      <div className="den-sheet__foot den-sheet__foot--key">
        <button type="button" className="btn-volt md den-sheet__key" onClick={start} disabled={busy === 'game' || !canStart}>{busy === 'game' ? DenCopy.startingGame : key}</button>
        <p className="mob-hint den-center">{allowance}</p>
        {s.billingOn && proNudges && onFreePro ? <button type="button" className="mob-link den-center" onClick={onFreePro}>{DenCopy.whatProAdds}</button> : null}
      </div>
      {s.billingOn && s.via === 'pro' && s.micsToGive > 0 && onPassMic ? (
        <button type="button" className="den-row den-row--button" onClick={onPassMic}>
          <span className="den-row__icon" aria-hidden="true"><Radio size={18} /></span>
          <span className="den-row__text"><b>{DenCopy.passMic}</b><span>{DenCopy.passMicRow(s.micsToGive)}</span></span>
        </button>
      ) : null}
      {week && !week.closed ? (
        <div className="den-row den-row--paper">
          <span className="den-row__icon" aria-hidden="true"><CalendarDays size={18} /></span>
          <span className="den-row__text"><b>{DenCopy.weeklyPaper}</b><span>{week.youSat ? DenCopy.satLine(null) : FORMAT_COPY.paperRow(week.paper?.count ?? 10)}</span></span>
          {week.youSat
            ? (week.yourResultId ? <Link className="mob-link den-row__link" href={resultHref(week.yourResultId)}>{DenCopy.marks}</Link> : null)
            : <Link className="mob-link den-row__link" href={paperHref(data)}>{DenCopy.sitIt}</Link>}
        </div>
      ) : null}
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

/** P3. Pass the mic (Pro, billing on). Others only; a radio per member. */
export function PassMicSheet({ open, onClose, v3, mobName, run, busy, onPassed }) {
  const others = (v3.members || []).filter((m) => !m.you);
  const [to, setTo] = useState(null);
  const [error, setError] = useState(null);
  const name = others.find((m) => m.memberId === to)?.name;
  const pass = async () => {
    setError(null);
    const r = await run('/api/mob/mic', { to }, { name: 'mic' });
    if (!r.ok) { setError(denError(r)); return; }
    onPassed?.(DenCopy.micToast(name));
  };
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.passMic} labelId="den-p3-h">
      <p className="mob-note">{DenCopy.micLine(mobName)}</p>
      <fieldset className="den-radios">
        <legend className="sr-only">{DenCopy.micPick}</legend>
        {others.map((m) => (
          <label key={m.memberId} className="den-radio">
            <input type="radio" name="den-mic" value={m.memberId} checked={to === m.memberId} onChange={() => setTo(m.memberId)} />
            <FoldFigure fold={m.fold} name={m.name} colour={m.colour} size={40} />
            <span className="den-radio__name">{m.name}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="btn-volt md den-sheet__key" onClick={pass} disabled={!to || busy === 'mic'}>{name ? DenCopy.micKey(name) : DenCopy.micPick}</button>
      <p className="mob-hint">{DenCopy.micNote}</p>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

/** P4. Free and Pro in the Mob (billing on only). "See Pro plans" opens the existing pricing page; no price here. */
export function FreeProSheet({ open, onClose }) {
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.freeProTitle} labelId="den-p4-h">
      <p className="mob-note">{DenCopy.proLead}</p>
      <section className="den-sheet__section" aria-labelledby="den-p4-free">
        <h3 id="den-p4-free" className="den-sheet__h">{DenCopy.freeAlways}</h3>
        <ul className="den-ticks">{DenCopy.freeList.map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}</ul>
      </section>
      <section className="den-sheet__section" aria-labelledby="den-p4-pro">
        <h3 id="den-p4-pro" className="den-sheet__h">{DenCopy.proAdds}</h3>
        <ul className="den-ticks">{DenCopy.proList.map((t) => <li key={t}><Plus size={16} aria-hidden="true" />{t}</li>)}</ul>
      </section>
      <p className="mob-hint">{DenCopy.notForSale}</p>
      <Link className="mob-key den-sheet__key" href="/pricing" data-pro-feature="mob_hosting">{DenCopy.seePlans}</Link>
    </MobDialog>
  );
}

/** Mob name chips, six at a time (D0a and SET). */
export function NameChips({ value, onChange, name = 'den-name' }) {
  const [page, setPage] = useState(() => (Number.isInteger(value) && value >= 0 ? Math.floor(value / 6) : 0));
  const shown = useMemo(() => namePage(MOB_NAMES, page), [page]);
  return (
    <div className="den-names">
      <div className="den-chips" role="radiogroup" aria-label={DenCopy.pickName}>
        {shown.names.map((n) => (
          <label key={n.key} className="den-chipopt">
            <input type="radio" name={name} value={n.key} checked={value === n.key} onChange={() => onChange(n.key)} />
            <span>{n.text}</span>
          </label>
        ))}
      </div>
      <p className="mob-hint">{DenCopy.namesKind}</p>
      <button type="button" className="mob-link" onClick={() => setPage((p) => p + 1)}>{shown.page === shown.pages - 1 ? DenCopy.showFirstSix : DenCopy.showSixMore}</button>
    </div>
  );
}

/** A grid of Fold cards to pick from (D0a, J1, the seat change). */
export function FoldPick({ folds, value, onChange, name = 'den-fold', compact = false }) {
  return (
    <div className={`den-foldpick${compact ? ' den-foldpick--compact' : ''}`} role="radiogroup" aria-label={DenCopy.pickFold}>
      {folds.map((k) => (
        <label key={k} className="den-foldcard">
          <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} />
          <FoldFigure fold={k} size={compact ? 64 : 84} name={foldName(k)} />
          <b className="den-foldcard__name">{foldName(k)}</b>
          {!compact ? <span className="den-foldcard__line">{FOLD_LINES[k]}</span> : null}
        </label>
      ))}
    </div>
  );
}

/** SET. The v3 rows of Mob settings: show a podium and the Mob name (the owner of the Mob), resting this week and
 *  share my marks (everyone). Sits beside today's rows (rename, leave, report), which stay where they are. */
export function DenSettingsRows({ data, v3, run, busy, mobName, onNotice }) {
  const owner = (v3.members || []).find((m) => m.owner);
  const [naming, setNaming] = useState(false);
  const [nameKey, setNameKey] = useState(v3.name?.key ?? null);
  const settings = async (body, name) => {
    onNotice(null);
    const r = await run('/api/mob/settings', body, { method: 'PATCH', name });
    if (!r.ok) { onNotice(denError(r)); return false; }
    return true;
  };
  const rest = async (on) => {
    onNotice(null);
    const r = await run('/api/mob/step-out', { on }, { name: 'step-out' });
    if (!r.ok) onNotice(denError(r));
  };
  const share = async (v) => {
    onNotice(null);
    const r = await run('/api/mob/me', { showScore: v }, { method: 'PATCH', name: 'showScore' });
    if (!r.ok) onNotice(denError(r));
  };
  const alone = (v3.members || []).length <= 1;
  return (
    <>
      {v3.youOwn ? (
        <ToggleRow checked={Boolean(v3.showPodium)} onChange={(v) => settings({ showPodium: v }, 'podium')} disabled={Boolean(busy)} label={DenCopy.showPodium} hint={DenCopy.showPodiumNote} />
      ) : (
        <p className="mob-note den-setting-text">{DenCopy.podiumNotOwner(mobName, Boolean(v3.showPodium), owner?.name || 'The member who started it')}</p>
      )}
      {v3.youOwn ? (
        <div className="den-setting">
          <div className="den-setting__row">
            <span><b>{DenCopy.mobName}</b><span className="mob-hint">{mobName}</span></span>
            <button type="button" className="mob-key" onClick={() => setNaming((v) => !v)} aria-expanded={naming}>{DenCopy.change}</button>
          </div>
          {naming ? (
            <NameChips value={nameKey} name="den-rename" onChange={async (k) => {
              if (busy || k === v3.name?.key) return;
              const before = nameKey;
              setNameKey(k);
              if (await settings({ nameKey: k }, 'name')) { setNaming(false); onNotice(DenCopy.namePicked); } else setNameKey(before);
            }} />
          ) : null}
        </div>
      ) : null}
      {!alone ? <ToggleRow checked={Boolean(v3.quest?.youSteppedOut)} onChange={rest} disabled={Boolean(busy) || Boolean(v3.quest?.done)} label={DenCopy.restingWeek} hint={DenCopy.restingNote} /> : null}
      {!alone ? <ToggleRow checked={Boolean(data.you?.showScore)} onChange={share} disabled={Boolean(busy)} label={DenCopy.shareMarks} hint={DenCopy.shareMarksNote} /> : null}
    </>
  );
}
