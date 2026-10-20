"use client";
// The den's sheets on the web (MOB-BUILD-SPEC-V3 5.3 P1 to P4, SET): the play picker, start a game, pass the mic, Free
// and Pro, and Mob settings. Each is a centred dialog (the Mob's dialog rule: centred at every width, 16 px left on a
// phone). Every rule comes from the server's `starts` block: nothing here decides a plan. With billing off no Pro word
// appears in the picker or the start sheet (pro_nudge, spec 5.0). No price anywhere in the Mob (F4).
import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardList, FileText, Lock, Minus, Plus, Radio, Send, SlidersHorizontal, Timer } from 'lucide-react';
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

// The four ways to play, one tile each, in the picker and the start sheet (D167, K9: every way to play is obvious).
const FORMAT_ICON = { sprint: <Send size={18} />, round: <SlidersHorizontal size={18} />, race: <Timer size={18} />, mock: <ClipboardList size={18} /> };
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
            <span className="den-row__icon" aria-hidden="true"><FileText size={18} /></span>
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

function FormatTile({ icon, title, sub, selected = false, locked = false, lockWord = null, onClick, disabled = false }) {
  return (
    <button type="button" className="den-tile" aria-pressed={onClick ? selected : undefined} onClick={onClick} disabled={disabled || locked}
      data-selected={selected || undefined} data-locked={locked || undefined}>
      <span className="den-tile__icon" aria-hidden="true">{icon}</span>
      {selected ? <Check className="den-tile__check" size={18} aria-hidden="true" /> : null}
      {locked ? <span className="den-tile__lock">{lockWord ? <span>{lockWord}</span> : null}<Lock size={14} aria-hidden="true" /></span> : null}
      <b className="den-tile__title">{title}</b>
      <span className="den-tile__sub">{sub}</span>
    </button>
  );
}

/** P1. Play with your Mob: what is open now, then the four ways to start one. Live or anytime is chosen in the start sheet. */
export function PlayPicker({ open, onClose, data, v3, now, mobName, onStart, onAsk, onFreePro, proNudges = false, busy }) {
  const s = v3.starts || {};
  const billing = Boolean(s.billingOn);
  const tiles = formatTiles(s);
  let line = DenCopy.anyoneCanStart;
  if (billing) {
    if (s.micFrom && s.mics > 0) line = DenCopy.micPassed(s.micFrom.name);
    else if (s.via === 'free_weekly' && s.freeLeft > 0) line = DenCopy.startsLeft(mobName, s.freeLeft);
    else if (!s.can) line = DenCopy.startUsed;
    else if (s.via === 'pro') line = null;
  }
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.pickerTitle} labelId="den-p1-h">
      <OpenNow data={data} v3={v3} now={now} onClose={onClose} />
      <section className="den-sheet__section" aria-labelledby="den-p1-start">
        <h3 id="den-p1-start" className="den-sheet__h">{DenCopy.startAGame}</h3>
        {line ? <p className="mob-note">{line}</p> : null}
        <div className="den-tiles den-tiles--four">
          {tiles.map((t) => (
            <FormatTile key={t.format} icon={FORMAT_ICON[t.format]} title={FORMAT_TITLE[t.format]} sub={FORMAT_SUB[t.format]} locked={t.locked} lockWord={t.pro ? FORMAT_COPY.proTag : null} onClick={() => onStart({ format: t.format })} />
          ))}
        </div>
        {billing && !s.can && !(s.mics > 0) ? <p className="mob-hint">{DenCopy.anyoneWithPro}</p> : null}
      </section>
      <div className="den-sheet__foot">
        {billing ? <button type="button" className="mob-key" onClick={onAsk} disabled={busy === 'sticker'}>{DenCopy.askForGame}</button> : null}
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
 * P2. Start a game: the one sheet for every way to play (D167, D168). Four tiles (sprint, your own round, a timed race,
 * a full mock together), the one choice each needs (the round's length, the race's minutes), what it covers, and Live or
 * anytime. A full mock is the whole paper and anytime in 24 hours, so it has neither a chapter nor a live room.
 * `preset`: { format, mode, chapter, rematchOf } from the picker or a rematch.
 */
export function StartGameSheet({ open, onClose, data, v3, mobName, preset, run, busy, onStarted, onPassMic }) {
  const s = v3.starts || {};
  const live = liveOffer(v3);
  const tiles = formatTiles(s);
  const first = ['round', 'race', 'mock'].includes(preset?.format) ? preset.format : 'sprint';
  const [format, setFormat] = useState(first);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(5);
  const [mode, setMode] = useState(preset?.mode === 'live' && live.can ? 'live' : 'async');
  const [chapter, setChapter] = useState(preset?.chapter || '');
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState(null);
  const chapters = useChapters(data.id, open && choosing);
  const selectId = useId();
  const mock = format === 'mock';
  const liveAllowed = !mock && live.can && (s.modes || []).includes('live');
  const tile = tiles.find((t) => t.format === format);
  // A rematch replays its game whatever the tiles say; otherwise the chosen tile must be startable.
  const canStart = preset?.rematchOf ? s.can : Boolean(tile?.can);
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
  const playsLive = mode === 'live' && liveAllowed;
  const key = mock ? FORMAT_COPY.openTheMock : playsLive ? DenCopy.openRoom : format === 'race' ? FORMAT_COPY.startTheRace : format === 'round' ? DenCopy.startTheRound : DenCopy.startTheSprint;
  const how = mock ? FORMAT_COPY.mockHow : format === 'race' ? (playsLive ? FORMAT_COPY.raceLiveHow : FORMAT_COPY.raceHow) : playsLive ? DenCopy.liveLineStart : DenCopy.asyncLineStart;
  const shortest = format === 'round' ? count : format === 'race' ? 10 : 5;
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.startAGame} labelId="den-p2-h">
      <p className="mob-note den-sheet__sub">{DenCopy.startSub(mobName, data.subjectName)}</p>
      <div className="den-tiles den-tiles--four" role="group" aria-label={DenCopy.startAGame}>
        {tiles.map((t) => (
          <FormatTile key={t.format} icon={FORMAT_ICON[t.format]} title={FORMAT_TITLE[t.format]} sub={FORMAT_SUB[t.format]}
            selected={format === t.format} locked={t.pro || (Boolean(s.can) && !t.can)} lockWord={t.pro ? FORMAT_COPY.proTag : null} onClick={() => setFormat(t.format)} />
        ))}
      </div>
      {format === 'round' ? (
        <div className="den-stepper den-choice" role="group" aria-label={DenCopy.lengthLabel(count)}>
          <button type="button" className="mob-icon den-stepper__btn" aria-label={DenCopy.fewerQuestions} disabled={count <= LENGTHS[0]} onClick={() => setCount(LENGTHS[Math.max(0, LENGTHS.indexOf(count) - 1)])}><Minus size={18} aria-hidden="true" /></button>
          <span className="den-stepper__value" aria-live="polite">{DenCopy.lengthLabel(count)}</span>
          <button type="button" className="mob-icon den-stepper__btn" aria-label={DenCopy.moreQuestions} disabled={count >= LENGTHS[2]} onClick={() => setCount(LENGTHS[Math.min(2, LENGTHS.indexOf(count) + 1)])}><Plus size={18} aria-hidden="true" /></button>
        </div>
      ) : null}
      {format === 'race' ? (
        <div className="den-seg den-choice" role="radiogroup" aria-label={FORMAT_COPY.howLong}>
          {RACE_MINUTES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={minutes === m} className="den-seg__opt" onClick={() => setMinutes(m)}>{FORMAT_COPY.minutes(m)}</button>
          ))}
        </div>
      ) : null}
      <section className="den-sheet__section" aria-labelledby="den-p2-covers">
        <h3 id="den-p2-covers" className="den-sheet__h">{DenCopy.whatItCovers}</h3>
        {mock ? (
          <p className="den-covers__text">{FORMAT_COPY.mockCovers(data.subjectName)}</p>
        ) : !choosing ? (
          <div className="den-covers">
            <p className="den-covers__text">{chapter ? DenCopy.coversChapter(chapter) : DenCopy.coversWhole(data.subjectName)}</p>
            <button type="button" className="mob-key" onClick={() => setChoosing(true)}>{DenCopy.change}</button>
          </div>
        ) : (
          <div className="mob-field">
            <label className="mob-label" htmlFor={selectId}>{DenCopy.chapterLabel}</label>
            <select id={selectId} className="mob-input mob-select" value={chapter} disabled={chapters.status === 'idle'} onChange={(e) => setChapter(e.target.value)}>
              <option value="">{DenCopy.coversWhole(data.subjectName)}</option>
              {chapters.chapters.filter((c) => !c.longest || c.longest >= shortest).map((c) => <option key={c.chapter} value={c.chapter}>{c.chapter}</option>)}
            </select>
          </div>
        )}
        {chapter && !mock ? <button type="button" className="mob-link" onClick={() => { setChapter(''); setChoosing(false); }}>{DenCopy.useWholeSubject}</button> : null}
      </section>
      <section className="den-sheet__section" aria-labelledby="den-p2-how">
        <h3 id="den-p2-how" className="den-sheet__h">{DenCopy.howMobPlays}</h3>
        {live.show && !mock ? (
          <div className="den-seg" role="radiogroup" aria-labelledby="den-p2-how">
            <button type="button" role="radio" aria-checked={mode === 'live'} className="den-seg__opt" disabled={!liveAllowed} onClick={() => setMode('live')}>{DenCopy.liveNow}</button>
            <button type="button" role="radio" aria-checked={mode !== 'live'} className="den-seg__opt" onClick={() => setMode('async')}>{DenCopy.anytime24}</button>
          </div>
        ) : null}
        <p className="mob-note">{how}</p>
        {live.show && !live.hoursOk && !mock ? <p className="mob-hint">{DenCopy.liveHours}</p> : null}
      </section>
      {s.billingOn && s.via === 'pro' && s.micsToGive > 0 && onPassMic ? (
        <button type="button" className="den-row den-row--button" onClick={onPassMic}>
          <span className="den-row__icon" aria-hidden="true"><Radio size={18} /></span>
          <span className="den-row__text"><b>{DenCopy.passMic}</b><span>{DenCopy.passMicRow(s.micsToGive)}</span></span>
        </button>
      ) : null}
      <div className="den-sheet__foot den-sheet__foot--key">
        <button type="button" className="btn-volt md den-sheet__key" onClick={start} disabled={busy === 'game' || !canStart}>{busy === 'game' ? DenCopy.startingGame : key}</button>
        <p className="mob-hint den-center">{tile?.pro && tile.locked ? DenCopy.anyoneWithPro : DenCopy.startUnder(mobName)}</p>
      </div>
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
