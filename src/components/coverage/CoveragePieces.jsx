// The pieces of the CUET 2026 coverage pages (owner LK368, 22 Nov 2026). Server components with no script: the segmented bar
// and its legend, the question palette, one question card, and a stem drawn from the paper's own text. A status is never
// shown by colour alone: every status has its own fill pattern (cov-st--*) and its own words.
import { Check } from 'lucide-react';
import { BAR_PARTS, OUT_PARTS, STATUS, SUBJECT as C, groupOf } from './coverageCopy.mjs';

const OPTION_NO = ['1', '2', '3', '4'];

/** The stem on one line for the card's summary row: a "List-I | List-II" table reads as a sentence. */
const summaryStem = (stem) => String(stem).replace(/^\s*List-I\s*\|\s*List-II\s*$/gim, '').replace(/\s*\|\s*/g, ', ').replace(/\s*\n\s*/g, ' ').trim();

/** A stem or passage as the paper prints it: lines kept, and a "List-I | List-II" block drawn as a table. */
export function PaperText({ text, className = '' }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  for (const line of lines) {
    const isRow = line.includes(' | ');
    const last = blocks[blocks.length - 1];
    if (isRow) {
      const cells = line.split(' | ').map((c) => c.trim());
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells] });
    } else if (line.trim()) {
      if (last?.kind === 'text') last.lines.push(line);
      else blocks.push({ kind: 'text', lines: [line] });
    }
  }
  return (
    <div className={`cov-text ${className}`}>
      {blocks.map((b, i) => (b.kind === 'text' ? (
        <p key={i}>{b.lines.join('\n')}</p>
      ) : (
        <table key={i} className="cov-list">
          <tbody>
            {b.rows.map((cells, r) => (
              <tr key={r}>{cells.map((c, j) => (r === 0 && /^list/i.test(c) ? <th key={j} scope="col">{c}</th> : <td key={j}>{c}</td>))}</tr>
            ))}
          </tbody>
        </table>
      )))}
    </div>
  );
}

/** The counted questions as one bar (same, new numbers, taught, not yet), with a legend that carries counts and meanings. */
export function CoverageBar({ counts, legend = true }) {
  const parts = BAR_PARTS.map(([status, field]) => ({ status, n: counts[field] || 0 }));
  const label = parts.filter((p) => p.n).map((p) => `${p.n} ${STATUS[p.status].label.toLowerCase()}`).join(', ');
  return (
    <div className="cov-barwrap">
      <div className="cov-bar" role="img" aria-label={label}>
        {parts.filter((p) => p.n).map((p) => (
          <i key={p.status} className={`cov-st--${p.status}`} style={{ flexGrow: p.n, flexBasis: 0, minWidth: p.n ? 6 : 0 }} title={`${STATUS[p.status].label}: ${p.n}`} />
        ))}
      </div>
      {legend ? (
        <ul className="cov-legend">
          {parts.map((p) => (
            <li key={p.status} className={p.n ? '' : 'is-zero'}>
              <span className={`cov-swatch cov-st--${p.status}`} aria-hidden="true" />
              <span className="cov-legend__body">
                <span className="cov-legend__row"><b>{STATUS[p.status].label}</b><span className="cov-legend__n">{p.n}</span></span>
                <span className="cov-legend__meaning">{STATUS[p.status].meaning}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The line under the bar for questions shown and not counted, or null. */
export function outLine(counts) {
  const parts = OUT_PARTS.filter(([, f]) => counts[f] > 0).map(([status, f]) => C.outPart(counts[f], status));
  return parts.length ? C.outLine(parts) : null;
}

/** The status pill: its own mark and its words. */
export function StatusPill({ status }) {
  return (
    <span className={`cov-pill cov-pill--${groupOf(status)}`}>
      <span className={`cov-swatch cov-swatch--sm cov-st--${status}`} aria-hidden="true" />
      {STATUS[status]?.label || status}
    </span>
  );
}

function Options({ options, keys, keyLabel }) {
  return (
    <ol className="cov-opts">
      {options.map((o, i) => {
        const right = keys.includes(i);
        return (
          <li key={i} className={right ? 'is-key' : undefined}>
            <span className="cov-opts__no" aria-hidden="true">{right ? <Check size={16} strokeWidth={3} /> : OPTION_NO[i]}</span>
            <span className="cov-opts__text">{o}</span>
            {right ? <span className="cov-opts__tag">{keyLabel}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function MatchPanel({ match }) {
  if (match.kind === 'card') {
    return (
      <>
        <p className="cov-panel__from">{C.cardFrom(match.chapter)}</p>
        <p className="cov-card__front">{match.front}</p>
        <PaperText text={match.back} className="cov-card__back" />
        {match.source ? <p className="cov-card__source">{match.source}</p> : null}
      </>
    );
  }
  return (
    <>
      <p className="cov-panel__from">{C.questionFrom(match.chapter)}</p>
      {match.passage ? <PaperText text={match.passage} className="cov-passage cov-passage--inline" /> : null}
      <PaperText text={match.stem} className="cov-stem" />
      <Options options={match.options} keys={[match.key]} keyLabel={C.ourKey} />
      {match.explanation ? (
        <div className="cov-expl">
          <p className="cov-expl__head">{C.explanation}</p>
          <PaperText text={match.explanation} />
        </div>
      ) : null}
    </>
  );
}

/** One question of the paper: the summary row, then the paper's question beside MockMob's match. */
export function QuestionCard({ q, open = false, chapterIndex }) {
  const group = groupOf(q.status);
  const keyLabel = q.key.length > 1 ? C.ntaKeys : C.ntaKey;
  const more = q.match?.more ? C.more(q.match.more.cards, q.match.more.questions) : null;
  return (
    <details className={`cov-q cov-q--${group}`} id={`q${q.n}`} open={open || undefined} data-cq="" data-g={group} data-ch={chapterIndex}>
      <summary className="cov-q__sum">
        <span className="cov-q__top">
          <span className="cov-q__n">Q{q.n}</span>
          <StatusPill status={q.status} />
        </span>
        {q.chapter ? <span className="cov-q__chapter">{q.chapter}</span> : null}
        <span className="cov-q__stem">{summaryStem(q.stem)}</span>
      </summary>
      <div className="cov-q__body">
        <section className="cov-panel cov-panel--paper" aria-label={`${C.asked}, question ${q.n}`}>
          <h3 className="cov-panel__head">{C.asked}</h3>
          {q.passage ? (
            <details className="cov-passage">
              <summary>{C.passage}{q.passage.title ? `: ${q.passage.title}` : ''}</summary>
              <PaperText text={q.passage.text} />
            </details>
          ) : null}
          <PaperText text={q.stem} className="cov-stem" />
          <Options options={q.options} keys={q.key} keyLabel={keyLabel} />
        </section>
        <section className={`cov-panel cov-panel--ours cov-panel--${group}`} aria-label={`${C.inMockMob}, question ${q.n}`}>
          <h3 className="cov-panel__head">{C.inMockMob}</h3>
          {q.match ? <MatchPanel match={q.match} /> : <p className="cov-panel__none">{group === 'out' ? STATUS[q.status].meaning : C.notYet}</p>}
        </section>
        {q.match && q.reason ? (
          <div className="cov-why">
            <p className="cov-why__head">{C.why}</p>
            <p className="cov-why__text">{q.reason}{more ? ` ${more}` : ''}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

/** Every question number as a chip that jumps to its card. */
export function Palette({ questions, chapterIndex }) {
  return (
    <ol className="cov-palette" aria-label="Questions">
      {questions.map((q) => (
        <li key={q.n} data-cq="" data-g={groupOf(q.status)} data-ch={chapterIndex(q)}>
          <a href={`#q${q.n}`} className={`cov-chip cov-st--${q.status}`} aria-label={`Question ${q.n}: ${STATUS[q.status]?.label}`} title={STATUS[q.status]?.label}>{q.n}</a>
        </li>
      ))}
    </ol>
  );
}
