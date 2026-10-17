"use client";
// The open mistakes by chapter (LEARN-REVIEW-1017 5.5). Every number on a row comes from chapterRows() in the shared Review
// input (the head, the panel and the control read the same function). A chapter opens in place: one row per item with its
// paper and 12-hour time (F17) and RESULT-1017's pill words, the first six then "Show {k} more" (none disappears), the
// lesson for the idea ("Learn the idea first", via lessonFor), and the per-paper keys "Repair {k} from {paper}". Tapping a
// row opens its free answer sheet; a repaired, held or slipped mistake opens its saved repair, free.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { shortDate } from '@/../data/review_input.mjs';
import { lessonFor, lessonHref } from '@/../data/study/lesson_map.mjs';
import { requestRepair, planRepairFailure } from '@/../data/repair_client.mjs';
import { REPAIR_OUTCOMES } from '@/../data/repair_presentation.mjs';
import { haveLine } from '@/lib/creditCopy.mjs';
import AnswerSheet, { loadAttempt, questionOf } from './AnswerSheet';
import { SUBJECTS } from '@/../data/subjects';

/** The subject's id whether the record names it by id ('accountancy') or by name ('Accountancy'). */
export const subjectId = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return SUBJECTS.find((s) => s.id === v || s.name.toLowerCase() === v)?.id || v.replace(/\s+/g, '_');
};

const SHOWN_CHAPTERS = 4;
const SHOWN_ITEMS = 6;
const MINUS = '−';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinNames = (list) => (list.length <= 1 ? list[0] || '' : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const domId = (uid) => `rvw-q-${String(uid).replace(/[^A-Za-z0-9_-]/g, '-')}`;
const ended = (s) => /[.?!:…)]$/.test(String(s).trim());
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(16, '0');

/** The line under a question: its paper and time always (F17), then what its state means. */
function metaOf(item) {
  const repaired = item.repairedAt ? `Repaired ${shortDate(item.repairedAt)}, opens free` : 'Repaired, opens free';
  const back = item.reviseNextLabel ? `. Back in Revise ${item.reviseNextLabel}` : '';
  if (item.keyState) return `${item.stamp}. The answer key is being re-checked`;
  if (item.state === 'blank') return `${item.stamp}. Left blank, not a mistake`;
  if (item.state === 'slipped') return `${item.stamp}. ${repaired}${back || '. Back in Revise tomorrow'}`;
  if (item.state === 'held') return `${item.stamp}. ${repaired}${back}`;
  if (item.state === 'repaired') return `${item.stamp}. ${repaired}`;
  return `${item.stamp}${item.pick ? `. You picked ${item.pick}` : ''}`;
}
const pillKind = (item) => (item.keyState ? 'key' : item.state === 'slipped' ? 'slip' : item.state === 'blank' ? 'free' : item.state === 'held' ? 'held' : item.state === 'repaired' ? 'check' : 'open');

export function ItemRow({ item, wallet, open, onToggle, onChanged, autoRepair = 0, index = 0 }) {
  return (
    <li className="rvw-q" id={domId(item.uid)} data-state={item.state} style={{ '--i': Math.min(index, SHOWN_ITEMS) }}>
      <button type="button" className="rvw-q__head mk-press" aria-expanded={open} onClick={onToggle}>
        <span className="rvw-badge" data-k={pillKind(item)}>{item.number}</span>
        <span className="rvw-q__text">
          <b>{item.stem}{item.stem && !ended(item.stem) ? '…' : ''}</b>
          <span className="rvw-q__when">{metaOf(item)}</span>
          {!open ? <span className="rvw-pill" data-k={pillKind(item)}>{item.pill}</span> : null}
        </span>
      </button>
      {open ? <AnswerSheet key={`${item.uid}:${autoRepair}`} item={item} wallet={wallet} autoRepair={autoRepair > 0} onChanged={onChanged} /> : null}
    </li>
  );
}

/** A plain list of question rows (Also in Review's repaired and blank lists use the same rows). */
export function ItemList({ items, wallet, openUid, setOpenUid, onChanged, label }) {
  return (
    <ul className="rvw-qs rvw-qs--flat" aria-label={label}>
      {items.map((item, i) => (
        <ItemRow key={item.uid} item={item} index={i} wallet={wallet} open={openUid === item.uid} onToggle={() => setOpenUid(openUid === item.uid ? null : item.uid)} onChanged={onChanged} />
      ))}
    </ul>
  );
}

// The lesson catalog, read once per subject for the page (the rule is lessonFor, data/study/lesson_map.mjs).
const catalogs = new Map();
function useLesson(subject, chapter) {
  const [lesson, setLesson] = useState(undefined);
  useEffect(() => {
    let alive = true;
    if (!catalogs.has(subject)) catalogs.set(subject, apiGet(`/api/study/catalog?subject=${encodeURIComponent(subject)}`).then((b) => b?.units || []).catch(() => { catalogs.delete(subject); return []; }));
    catalogs.get(subject).then((units) => { if (alive) setLesson(lessonFor({ subject, chapter }, units)); });
    return () => { alive = false; };
  }, [subject, chapter]);
  return lesson;
}

export function LessonLink({ subject, chapter, from }) {
  const lesson = useLesson(subject, chapter);
  if (!lesson) return null;
  return (
    <Link className="rvw-lesson" href={lessonHref(lesson, from)}>
      <u>Learn the idea first</u>
      <small>{lesson.title}{Number.isFinite(lesson.minutes) ? `, ${lesson.minutes}-minute lesson` : ', lesson'}, free</small>
    </Link>
  );
}

/**
 * "Repair 3 from Mock 3": the questions and the total first, then the repairs one at a time on the existing per-question
 * endpoint, in order. Each is charged only when written; the first one that is not written stops the run and costs nothing.
 */
function PaperRepairs({ paper, items: given, wallet, onChanged, onOpen }) {
  // The list is fixed when the entry opens, so the receipt of what was repaired stays while the page refreshes under it.
  const [items] = useState(given);
  const [run, setRun] = useState({ status: 'ready', done: {}, failed: null, at: null });
  const busy = run.status === 'running';
  const balance = Number.isFinite(wallet?.aiCredits) ? wallet.aiCredits : null;
  const short = balance !== null && balance < items.length;
  const left = items.filter((i) => !run.done[i.uid]);
  async function begin() {
    setRun((r) => ({ ...r, status: 'running', failed: null }));
    let done = { ...run.done };
    for (const item of left) {
      setRun((r) => ({ ...r, at: item.uid }));
      let questionId = item.qid;
      if (!questionId) {
        try { questionId = questionOf(await loadAttempt(item.attemptId), item)?.id; } catch { questionId = null; }
      }
      if (!questionId) { setRun({ status: 'stopped', done, failed: { uid: item.uid, message: `Question ${item.number} did not load. Nothing was charged for it.` }, at: null }); onChanged?.(); return; }
      const outcome = await requestRepair(fetch, '/api/recovery/repair', { attemptId: item.attemptId, questionId, requestId: newRequestId() });
      const ok = outcome.kind === 'response' && outcome.res.ok && outcome.body?.ok && REPAIR_OUTCOMES.includes(outcome.body.status) && ['explained', 'stored'].includes(outcome.body.status);
      if (!ok) {
        const plan = outcome.kind === 'response' && outcome.body?.ok ? { message: outcome.body.message || 'This one could not be repaired. You were not charged.' } : planRepairFailure(outcome);
        setRun({ status: 'stopped', done, failed: { uid: item.uid, message: plan.message }, at: null });
        onChanged?.();
        return;
      }
      done = { ...done, [item.uid]: outcome.body.status };
      const now = done;
      setRun((r) => ({ ...r, done: now }));
    }
    setRun({ status: 'finished', done, failed: null, at: null });
    onChanged?.();
  }
  return (
    <div className="rvw-batch" aria-label={`Repair ${items.length} from ${paper}`}>
      <p><b>{plural(items.length, 'repair')}, {plural(items.length, 'AI credit')}.</b> {haveLine(balance) || ''} Each is charged only when it is written. If one cannot be written it costs nothing and the rest wait.</p>
      <ol>
        {items.map((item) => {
          const state = run.done[item.uid] ? 'done' : run.failed?.uid === item.uid ? 'failed' : run.at === item.uid ? 'writing' : 'waiting';
          return (
            <li key={item.uid} data-state={state}>
              <span className="rvw-badge" data-k={state === 'done' ? 'held' : 'open'}>{item.number}</span>
              <span>
                <b>{item.stem}{item.stem && !ended(item.stem) ? '…' : ''}</b>
                <small role={state === 'failed' ? 'alert' : undefined}>
                  {state === 'done' ? <>Repaired. <button type="button" className="rvw-inline" onClick={() => onOpen(item.uid)}>Open it, free</button></>
                    : state === 'failed' ? run.failed.message : state === 'writing' ? 'Writing the repair' : item.stamp}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
      {run.status !== 'finished' && left.length ? (
        <button type="button" className="rvw-key mk-press" disabled={busy || short} onClick={begin}>
          {busy ? 'Repairing' : run.status === 'stopped' ? `Repair the ${plural(left.length, 'question')} left` : `Begin ${plural(left.length, 'repair')}`}
        </button>
      ) : null}
      {short && !busy ? <p className="rvw-sheet__fine">This needs {plural(items.length, 'AI credit')}. {haveLine(balance)} <Link href="/pricing/ai-credits">See your AI credits</Link></p> : null}
    </div>
  );
}

function OpenChapter({ row, byUid, wallet, openUid, setOpenUid, onChanged, focus }) {
  // The order is kept from when the chapter opened, so a row that is repaired while you read it does not jump away.
  const [order] = useState(() => row.itemIds);
  const ids = [...order.filter((u) => row.itemIds.includes(u)), ...row.itemIds.filter((u) => !order.includes(u))];
  const ordered = ids.map((u) => byUid.get(u)).filter(Boolean);
  const [more, setMore] = useState(false);
  const [batch, setBatch] = useState(null);
  const visible = more ? ordered : ordered.filter((it, i) => i < SHOWN_ITEMS || it.uid === openUid);
  const hidden = ordered.filter((it) => !visible.includes(it));
  const pills = [...new Set(hidden.map((it) => it.pill))];
  const hiddenLine = hidden.length
    ? `Show ${hidden.length} more: ${joinNames(hidden.map((it) => `Q${it.number}`))}${pills.length === 1 ? `, ${hidden.length === 2 ? 'both' : 'all'} ${pills[0].charAt(0).toLowerCase()}${pills[0].slice(1)}` : ''}`
    : null;
  // Per-paper keys: the repairable mistakes of this chapter, by paper, in the chapter's order. Slipped ones are never in them.
  const byPaper = useMemo(() => {
    const m = new Map();
    for (const it of ordered) if (it.repairable) m.set(it.paperName, [...(m.get(it.paperName) || []), it]);
    return [...m.entries()];
  }, [ordered]);
  const first = ordered.find((it) => it.repairable) || ordered.find((it) => it.open) || ordered[0];
  const subject = subjectId(row.subject);
  return (
    <div className="rvw-open" id={`rvw-ch-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}-rows`}>
      <ul className="rvw-qs">
        {visible.map((item, i) => (
          <ItemRow key={item.uid} item={item} index={i} wallet={wallet} open={openUid === item.uid}
            autoRepair={focus?.repair && focus.uid === item.uid ? focus.n : 0}
            onToggle={() => setOpenUid(openUid === item.uid ? null : item.uid)} onChanged={onChanged} />
        ))}
      </ul>
      {hiddenLine ? <button type="button" className="rvw-more" onClick={() => setMore(true)}>{hiddenLine}</button> : null}
      <div className="rvw-open__foot">
        {first ? <LessonLink subject={subject} chapter={row.name} from={{ kind: 'q', attemptId: first.attemptId, number: first.number }} /> : null}
        {byPaper.length ? (
          <div className="rvw-paperkeys">
            {byPaper.map(([paper, list]) => (
              <button key={paper} type="button" className="rvw-key rvw-key--round mk-press" aria-expanded={batch === paper} onClick={() => setBatch(batch === paper ? null : paper)}>Repair {list.length} from {paper}</button>
            ))}
          </div>
        ) : null}
        {batch ? <PaperRepairs key={batch} paper={batch} items={(byPaper.find(([p]) => p === batch) || [null, []])[1]} wallet={wallet} onChanged={onChanged} onOpen={(uid) => setOpenUid(uid)} /> : null}
      </div>
    </div>
  );
}

function ChapterRow({ row, open, onToggle, children }) {
  const share = row.wrong ? Math.min(1, row.repaired / row.wrong) : 0;
  const panelId = `rvw-ch-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}-rows`;
  return (
    <li className="rvw-ch" data-open={open || undefined}>
      <button type="button" className="rvw-ch__head mk-press" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={onToggle}>
        <span className="rvw-ch__obj" aria-hidden="true"><SubjectObject id={subjectId(row.subject)} size={48} framed={false} /></span>
        <b className="rvw-ch__name">{row.name}</b>
        {row.marks > 0 ? <span className="rvw-ch__lost"><span className="sr-only">Cost you </span>{MINUS}{row.marks}<span className="sr-only"> marks</span></span> : <span className="rvw-ch__clear">All repaired</span>}
        <span className="rvw-ch__meta">{row.source}</span>
        <span className="rvw-ch__prog">
          <span className="rvw-track" aria-hidden="true"><i style={{ transform: `scaleX(${share})` }} /></span>
          {row.progress}
        </span>
        <i className="rvw-chev" data-dir="down" aria-hidden="true" />
      </button>
      <div className="rvw-ch__body" data-open={open || undefined}>
        <div>{open ? children : null}</div>
      </div>
    </li>
  );
}

export default function ChapterRows({ body, wallet, focus, openUid, setOpenUid, onChanged }) {
  const rows = body.chapters || [];
  const counts = body.counts || {};
  const noneOpen = counts.open === 0;
  const byUid = useMemo(() => new Map((body.items || []).map((i) => [i.uid, i])), [body.items]);
  const [opened, setOpened] = useState(() => new Set(focus?.chapter ? [focus.chapter] : []));
  const [all, setAll] = useState(() => (focus?.chapter ? rows.findIndex((r) => r.id === focus.chapter) >= SHOWN_CHAPTERS : false));
  // A move asked for a question (the panel's key, a link back from a lesson): open its chapter, then bring it into view.
  const [seenFocus, setSeenFocus] = useState(focus?.n ?? null);
  if (focus?.chapter && focus.n !== seenFocus) {
    setSeenFocus(focus.n);
    setOpened((o) => new Set(o).add(focus.chapter));
    if (rows.findIndex((r) => r.id === focus.chapter) >= SHOWN_CHAPTERS) setAll(true);
  }
  useEffect(() => {
    if (!focus?.chapter) return undefined;
    const t = setTimeout(() => {
      const el = document.getElementById(focus.uid ? domId(focus.uid) : `rvw-ch-${focus.chapter.replace(/[^A-Za-z0-9_-]/g, '-')}-rows`);
      el?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    }, 280);
    return () => clearTimeout(t);
  }, [focus?.n, focus?.chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  // While a chapter is open the order holds still, so a repair never moves the rows you are reading; it is re-ranked,
  // costliest first again, once every chapter is closed.
  const [frozen, setFrozen] = useState(null);
  if (opened.size && !frozen) setFrozen(rows.map((r) => r.id));
  if (!opened.size && frozen) setFrozen(null);
  const ids = frozen ? [...frozen.filter((id) => rows.some((r) => r.id === id)), ...rows.filter((r) => !frozen.includes(r.id)).map((r) => r.id)] : rows.map((r) => r.id);
  const ranked = ids.map((id) => rows.find((r) => r.id === id));
  const shown = all ? ranked : ranked.filter((r, i) => i < SHOWN_CHAPTERS || opened.has(r.id));
  const rest = ranked.filter((r) => !shown.includes(r));
  const toggle = (id) => setOpened((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <section className="rvw-chap" aria-labelledby="rvw-chap-h">
      <div className="rvw-sechead">
        <h2 id="rvw-chap-h" className="rvw-h2">{noneOpen ? 'No open mistakes' : body.head?.title}</h2>
        <span>Costliest first</span>
      </div>
      {noneOpen ? <p className="rvw-sub">{counts.blanks ? `${counts.blanks} left blank cost you ${counts.marks} marks. A blank costs 5. Try any of them again, free.` : 'Every wrong answer is repaired.'}</p>
        : body.head?.sub ? <p className="rvw-sub">{body.head.sub}</p> : null}
      <ul className="rvw-chs">
        {shown.map((row) => (
          <ChapterRow key={row.id} row={row} open={opened.has(row.id)} onToggle={() => toggle(row.id)}>
            <OpenChapter row={row} byUid={byUid} wallet={wallet} openUid={openUid} setOpenUid={setOpenUid} onChanged={onChanged} focus={focus} />
          </ChapterRow>
        ))}
      </ul>
      {rest.length ? (
        <button type="button" className="rvw-row mk-press" aria-expanded={false} onClick={() => setAll(true)}>
          <b>See all {rows.length} chapters</b>
          <span>{rest.map((r) => (r.marks > 0 ? `${r.name} ${MINUS}${r.marks}` : `${r.name}, all repaired`)).join(', ')}</span>
          <i className="rvw-chev" data-dir="down" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
