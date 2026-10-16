"use client";
// Layer 3 of the result (RESULT-1017 4.5): the mistakes, in repair order, each row its own entry to Repair and to
// Check it held. The status chip on each row comes from a real server state, never ahead of it. The first four show;
// "Show all" opens the rest in place. The blanks are one folded row. Right answers are not here: they live in
// "Every answer". Opened rows hold what the answer row always held (the page renders it: renderBody).
import { useId } from 'react';
import { Check } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { mistakesHead } from '@/../data/result_next_move.mjs';

export const SHOWN_FIRST = 4;
const LETTERS = 'ABCDEFGH';

function Chip({ status, cheer }) {
  if (!status) return null;
  return (
    <span className="rx-chip" data-state={status.id} key={status.id}>
      {status.id === 'held' ? <Check size={14} strokeWidth={2.8} aria-hidden="true" className="rx-tick" /> : null}
      {status.id === 'writing' ? <span className="rx-chip__ring" aria-hidden="true" /> : null}
      <span>{status.label}</span>
      {/* Mobi's one real moment on the result: a repair that held on a new question, after the server marked it. */}
      {cheer ? <span className="rx-cheer"><MobiReact act="cheer" size={40} /></span> : null}
    </span>
  );
}

function Row({ row, open, onToggle, status, cohort, cheer, children, arrived }) {
  const given = row.d?.givenIndex;
  const key = row.q?.correctIndex;
  const stem = String(row.q?.question ?? row.q?.body ?? '').trim() || 'Question unavailable';
  const isWrong = row.verdict === 'wrong';
  return (
    <li id={`q-${row.number}`} className="rx-row" data-verdict={row.verdict} data-open={open || undefined}>
      {arrived ? <span key={arrived} className="rp-q__ring" aria-hidden="true" /> : null}
      <h3 className="rx-row__h">
        <button type="button" className="rx-row__bar rp-q__bar" aria-expanded={open} aria-controls={`q-${row.number}-body`} onClick={() => onToggle(row.q.id)}>
          <span className="rx-row__n" aria-hidden="true">{row.number}</span>
          <span className="rx-row__main">
            <span className="rx-row__ch"><span className="mr-sr">Question {row.number}, </span>{row.chapter}</span>
            <span className="rx-row__stem">{stem}</span>
            <span className="rx-row__facts">
              {isWrong && Number.isInteger(given) ? <span className="rx-pick" data-kind="mine"><i>{LETTERS[given]}</i>yours</span> : null}
              {!isWrong ? <span className="rx-pick" data-kind="blank">left blank</span> : null}
              {Number.isInteger(key) ? <span className="rx-pick" data-kind="key"><i>{LETTERS[key]}</i>answer</span> : null}
              {cohort ? <span className="rx-row__cohort">{cohort}</span> : null}
            </span>
          </span>
          <span className="rx-row__side">
            <span className="rx-row__cost">{isWrong ? '−6' : '0'}</span>
            <Chip status={status} cheer={cheer} />
          </span>
          <span className="rx-chev" aria-hidden="true" />
        </button>
      </h3>
      <div className="rx-row__wrap" id={`q-${row.number}-body`} inert={open ? undefined : true}>
        <div className="rx-row__inner">{children}</div>
      </div>
    </li>
  );
}

/**
 * mistakes     wrong rows in repair order
 * blanks       blank rows in paper order
 * openIds      Set of opened qids; onToggle(qid)
 * statusOf     (row) => { id, label } | null
 * cohortOf     (row) => "18 of 22 got it right" | null
 * renderBody   (row) => the opened row's content (only called for rows opened at least once)
 * visited      Set of qids opened at least once
 * showAll, onShowAll, blanksOpen, onBlanks
 * repairedCount, heldCount   for the head ("3 of 12 repaired, 2 held")
 * cheer        qid whose check just held (Mobi's one cheer), or null
 * top          a node at the head of the section (the repair run's track, once a run has begun)
 * after        nodes under the list (the credit line, the lesson link)
 */
export default function MistakeList({ mistakes, blanks, openIds, onToggle, statusOf, cohortOf, renderBody, visited, showAll, onShowAll, blanksOpen, onBlanks, repairedCount = 0, heldCount = 0, ordered = 'repair', cheer = null, arrived = null, top = null, after = null, arrive = false }) {
  const listId = useId();
  const blankId = useId();
  const head = mistakesHead({ count: mistakes.length, repairedCount, heldCount });
  const shown = showAll ? mistakes : mistakes.slice(0, SHOWN_FIRST);
  const rest = mistakes.length - SHOWN_FIRST;
  const row = (r) => (
    <Row key={r.q.id} row={r} open={openIds.has(r.q.id)} onToggle={onToggle} status={statusOf(r)} cohort={cohortOf(r)} cheer={cheer === r.q.id}
      arrived={arrived?.number === r.number ? arrived.n : null}>
      {visited.has(r.q.id) ? renderBody(r) : null}
    </Row>
  );
  return (
    <section className="rx-mistakes rp-review" aria-labelledby="rx-mistakes-title" data-arrive={arrive || undefined}>
      {top}
      <div className="rx-mistakes__head">
        <h2 id="rx-mistakes-title">{head.title}</h2>
        {head.side ? <span className="rx-mistakes__side">{head.side}</span> : null}
      </div>
      {mistakes.length ? (
        <p className="rx-mistakes__sub">{ordered === 'repair' ? 'In repair order: the ones most other students got right come first. Repaired ones say whether the fix held.' : 'In paper order. Repaired ones say whether the fix held.'}</p>
      ) : null}
      {mistakes.length ? <ol className="rx-list" id={listId}>{shown.map(row)}</ol> : null}
      {rest > 0 ? (
        <button type="button" className="rx-more" aria-expanded={showAll} aria-controls={listId} onClick={() => onShowAll(!showAll)}>
          {showAll ? `Show the first ${SHOWN_FIRST}` : `Show all ${mistakes.length}`}
        </button>
      ) : null}
      {blanks.length ? (
        <div className="rx-blanks" data-open={blanksOpen || undefined}>
          <button type="button" className="rx-blanks__bar" aria-expanded={blanksOpen} aria-controls={blankId} onClick={() => onBlanks(!blanksOpen)}>
            <span>{blanks.length} left blank, {blanks.length * 5} marks not earned</span>
            <span className="rx-chev" aria-hidden="true" />
          </button>
          <div className="rx-row__wrap" id={blankId} inert={blanksOpen ? undefined : true}>
            <div className="rx-row__inner"><ol className="rx-list">{blanks.map(row)}</ol></div>
          </div>
        </div>
      ) : null}
      {after}
    </section>
  );
}
