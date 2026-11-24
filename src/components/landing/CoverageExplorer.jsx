'use client';

// The home page's CUET 2026 check, question by question (owner LK427, 23 Nov 2026; his reference was a rival's coverage page:
// stream tabs, subject chips with a percent, a strip of question numbers, the question beside their flashcard). Top to bottom:
// the stream tabs, the stream's subjects as chips with their percent, the chosen paper's strip (one cell a question, drawn by
// status; reading-skill items are shown and marked not counted), then the chosen question: NTA's question, its options and
// its key, beside the MockMob question or Key card that covers it.
//
// It opens on the first stream's first paper with a "Same question" cell chosen (coverageWords.mjs firstPick), and that pair
// is in the page's own HTML (`first`), so the side-by-side shows at once. One tap changes the stream, the paper or the
// question; nothing plays by itself. The one motion: the strip's cells fill once, in order, the first time it scrolls into
// view (never for a reader who asked for less motion, never when the strip is already on screen when the page wakes).
//
// A paper's questions are fetched when that paper is chosen (LOADERS: one small file a paper, data/coverage/cuet2026/home);
// the first paper's file is fetched as the section nears the window. While a file is on its way the pair keeps its height
// (.lp-cq__pair has a floor), so nothing below it moves.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ban, BookOpen, BookOpenCheck, Check, ChevronLeft, ChevronRight, CircleDashed, Equal, EqualApproximately } from 'lucide-react';
import { CODE_STATUS, EXPLORER as C, LEGEND, STATUS_CODE, STATUS_WORDS, firstPick, groupOf, viewStrip } from './coverageWords.mjs';

// One file a paper, each its own chunk. coverage2026.test.mjs holds this list to the summary's subjects.
const LOADERS = {
  accountancy: () => import('../../../data/coverage/cuet2026/home/accountancy.json'),
  biology: () => import('../../../data/coverage/cuet2026/home/biology.json'),
  'business-studies': () => import('../../../data/coverage/cuet2026/home/business-studies.json'),
  chemistry: () => import('../../../data/coverage/cuet2026/home/chemistry.json'),
  'computer-science': () => import('../../../data/coverage/cuet2026/home/computer-science.json'),
  economics: () => import('../../../data/coverage/cuet2026/home/economics.json'),
  geography: () => import('../../../data/coverage/cuet2026/home/geography.json'),
  history: () => import('../../../data/coverage/cuet2026/home/history.json'),
  mathematics: () => import('../../../data/coverage/cuet2026/home/mathematics.json'),
  physics: () => import('../../../data/coverage/cuet2026/home/physics.json'),
  'political-science': () => import('../../../data/coverage/cuet2026/home/political-science.json'),
  psychology: () => import('../../../data/coverage/cuet2026/home/psychology.json'),
  sociology: () => import('../../../data/coverage/cuet2026/home/sociology.json'),
};

const OPTION_NO = ['1', '2', '3', '4'];
// The mark on the line between NTA's question and MockMob's: equal for the same question, nearly equal for new numbers.
const SEAM_ICON = { same: Equal, 'new-values': EqualApproximately, concept: BookOpenCheck, 'not-yet': CircleDashed };

/** A stem, passage or card as the paper prints it: lines kept, and a "List-I | List-II" block drawn as a table. */
function PaperLines({ text, className = '' }) {
  const blocks = [];
  for (const line of String(text || '').split('\n')) {
    const last = blocks[blocks.length - 1];
    if (line.includes(' | ')) {
      const cells = line.split(' | ').map((c) => c.trim());
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells] });
    } else if (line.trim()) {
      if (last?.kind === 'text') last.lines.push(line);
      else blocks.push({ kind: 'text', lines: [line] });
    }
  }
  return (
    <div className={`lp-cq__text ${className}`}>
      {blocks.map((b, i) => (b.kind === 'text' ? (
        <p key={i}>{b.lines.join('\n')}</p>
      ) : (
        <table key={i} className="lp-cq__list">
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

/** Long words fold to a few lines with "Show all" over their last line (so the key never moves anything when it appears). */
function Clamp({ children }) {
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || open || typeof ResizeObserver === 'undefined') return undefined;
    const check = () => setOver(el.scrollHeight > el.clientHeight + 4);
    const watch = new ResizeObserver(check);
    watch.observe(el);
    return () => watch.disconnect();
  }, [open]);
  return (
    <div className="lp-cq__clamp" data-open={open ? '' : undefined} data-over={over && !open ? '' : undefined}>
      <div className="lp-cq__clamp-box" ref={box}>{children}</div>
      {over || open ? (
        <button type="button" className="lp-cq__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? C.showLess : C.showAll}</button>
      ) : null}
    </div>
  );
}

function Options({ options, keys, keyLabel }) {
  return (
    <ol className="lp-cq__opts">
      {options.map((o, i) => {
        const right = keys.includes(i);
        return (
          <li key={i} className={right ? 'is-key' : undefined}>
            <span className="lp-cq__opt-no" aria-hidden="true">{right ? <Check size={15} strokeWidth={3} /> : OPTION_NO[i]}</span>
            <span className="lp-cq__opt-text">{o}{right ? <span className="lp-cq__opt-tag">{keyLabel}</span> : null}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Ours({ q }) {
  const m = q.match;
  if (!m) {
    return <p className="lp-cq__none">{STATUS_WORDS[q.status]?.line}</p>;
  }
  if (m.kind === 'card') {
    return (
      <>
        <p className="lp-cq__front">{m.front}</p>
        <Clamp><PaperLines text={m.back} className="lp-cq__back" /></Clamp>
        {m.source ? <p className="lp-cq__source"><BookOpen size={15} strokeWidth={2.2} aria-hidden="true" />{m.source}</p> : null}
      </>
    );
  }
  return (
    <>
      <Clamp>
        {m.passage ? <PaperLines text={m.passage} className="lp-cq__stem lp-cq__stem--lead" /> : null}
        <PaperLines text={m.stem} className="lp-cq__stem" />
      </Clamp>
      <Options options={m.options} keys={[m.key]} keyLabel={C.ourKey} />
    </>
  );
}

export default function CoverageExplorer({ model, first, heading, how }) {
  const start = model.first;
  // Two figures, one switch: before, and now. The chosen one decides the chips, the legend and the strip.
  const [view, setView] = useState('now');
  const [streamId, setStreamId] = useState(start.stream);
  const [subjectId, setSubjectId] = useState(start.subject);
  const [n, setN] = useState(start.n);
  const [files, setFiles] = useState({});
  const [failed, setFailed] = useState({});
  const root = useRef(null);
  const strip = useRef(null);
  const loading = useRef({});
  const lastSubject = useRef({});
  const lastN = useRef({});

  const load = useCallback((id) => {
    const loader = LOADERS[id];
    if (!loader) { setFailed((f) => ({ ...f, [id]: true })); return; }
    if (loading.current[id]) return;
    loading.current[id] = true;
    setFailed((f) => (f[id] ? { ...f, [id]: false } : f));
    loader()
      .then((mod) => { setFiles((all) => (all[id] ? all : { ...all, [id]: mod.default || mod })); })
      .catch(() => { loading.current[id] = false; setFailed((f) => ({ ...f, [id]: true })); });
  }, []);

  // The first paper's questions arrive as the section nears the window; the strip fills once as it comes into view.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') { load(start.subject); return undefined; }
    const near = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { near.disconnect(); load(start.subject); }
    }, { rootMargin: '150% 0px' });
    near.observe(el);
    const html = document.documentElement;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'reduced' || html.hasAttribute('data-lite');
    let fill = null;
    let done = 0;
    if (!calm && strip.current && el.getBoundingClientRect().top > window.innerHeight) {
      el.dataset.fill = 'armed';
      fill = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        fill.disconnect();
        el.dataset.fill = 'in';
        done = window.setTimeout(() => { delete el.dataset.fill; }, 1600);
      }, { threshold: 0.3 });
      fill.observe(strip.current);
    }
    return () => { near.disconnect(); fill?.disconnect(); window.clearTimeout(done); delete el.dataset.fill; };
  }, [load, start.subject]);

  const subject = model.subjects[subjectId];
  const stream = model.streams.find((s) => s.id === streamId) || model.streams[0];
  const cells = viewStrip(subject.strip, subject.marks, view);
  const file = files[subjectId];
  const fromFile = file ? file.questions.find((x) => x.n === n) : null;
  const q = fromFile
    ? { ...fromFile, passage: fromFile.passage == null ? null : file.passages[fromFile.passage] }
    : (first && first.subject === subjectId && first.q.n === n ? first.q : null);
  const status = CODE_STATUS[cells[n - 1]] || 'dropped';
  const words = STATUS_WORDS[status];
  const group = groupOf(status);
  const SeamIcon = SEAM_ICON[status] || Ban;

  const pickQuestion = (next) => {
    if (next < 1 || next > cells.length) return;
    lastN.current[subjectId] = next;
    setN(next);
  };
  const pickSubject = (id) => {
    const next = model.subjects[id];
    if (!next) return;
    lastSubject.current[next.stream] = id;
    setSubjectId(id);
    setN(lastN.current[id] || firstPick(viewStrip(next.strip, next.marks, view)));
    if (!files[id]) load(id);
  };
  const pickStream = (id) => {
    const next = model.streams.find((s) => s.id === id);
    if (!next || id === streamId) return;
    setStreamId(id);
    pickSubject(lastSubject.current[id] || next.subjects[0]);
  };
  const onStripKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const to = e.key === 'Home' ? 1 : e.key === 'End' ? cells.length : step ? n + step : 0;
    if (!to || to < 1 || to > cells.length) return;
    e.preventDefault();
    pickQuestion(to);
    strip.current?.querySelector(`[data-n="${to}"]`)?.focus();
  };

  const codesOf = (item) => (item.status === 'concept' ? ['s', 'v', 'c'] : item.status === 'skill' ? [STATUS_CODE.skill, STATUS_CODE['off-syllabus'], STATUS_CODE.dropped] : [STATUS_CODE[item.status]]);
  const legend = LEGEND.map((item) => ({ status: item.status, label: item.label, n: Array.from(cells).filter((code) => codesOf(item).includes(code)).length })).filter((item) => item.n > 0);
  const shown = view === 'before' ? subject.first : subject;

  // The chosen question's place keeps the height of the tallest question seen in this paper (owner, 24 Nov 2026: picking a
  // square, or switching the figure, made the page under it jump up when the next question was shorter). It only grows; a
  // new paper or a new window width starts again. One layout read after a render, never during a scroll.
  const pair = useRef(null);
  const tallest = useRef({ key: '', h: 0 });
  useLayoutEffect(() => {
    const el = pair.current;
    if (!el) return;
    const key = `${subjectId}|${window.innerWidth}`;
    if (tallest.current.key !== key) { tallest.current = { key, h: 0 }; el.style.minHeight = ''; }
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h > tallest.current.h) { tallest.current.h = h; el.style.minHeight = `${h}px`; }
  });

  return (
    <>
    <div className="lp-cov__head">
      {heading}
      <div className="lp-cov__fig">
        {model.before ? (
          <div className="lp-cv" role="group" aria-label={C.views}>
            {[['before', subject.first], ['now', subject]].map(([id, fig]) => (
              <button key={id} type="button" className="lp-cv__view" aria-pressed={view === id} onClick={() => setView(id)}>
                <span className="lp-cv__bank">{C.bank[id]}</span>
                <span className="lp-cv__name">{C.view[id]}</span>
                <b className="lp-cv__pct">{fig.pct}<span>%</span></b>
                <span className="lp-cv__count">{C.viewCount(fig.covered, subject.of)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="lp-cov__total">
            <b>{model.total.pct}<span>%</span></b>
            <span>{C.total(model.total.covered, model.total.of, model.total.papers)}</span>
          </p>
        )}
        {model.before ? <p className="lp-cv__all"><b>{C.showing(subject.name)}</b> {C.allPapers(model.before.pct, model.total.pct, model.total.papers)}</p> : null}
        {how}
      </div>
    </div>
    <div className="lp-cq" ref={root} data-status={status}>
      <div className="lp-cq__pick">
        <div className="lp-cq__streams" role="group" aria-label={C.streams}>
          {model.streams.map((s) => (
            <button key={s.id} type="button" className="lp-cq__stream" aria-pressed={s.id === stream.id} onClick={() => pickStream(s.id)}>{s.name}</button>
          ))}
        </div>
        <div className="lp-cq__subjects" role="group" aria-label={C.subjects}>
          {stream.subjects.map((id) => {
            const s = model.subjects[id];
            return (
              <button key={id} type="button" className="lp-cq__subject" aria-pressed={id === subjectId}
                onClick={(e) => { pickSubject(id); const row = e.currentTarget.parentElement; if (row && row.scrollWidth > row.clientWidth) e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}
                onPointerEnter={() => { if (!files[id]) load(id); }}>
                <span className="lp-cq__subject-name">{s.name}</span>
                <b className="lp-cq__subject-pct">{view === 'before' ? s.first.pct : s.pct}%</b>
              </button>
            );
          })}
        </div>
        {stream.pending.length ? <p className="lp-cq__pending">{C.pending(stream.pending)}</p> : null}
      </div>

      <div className="lp-cq__paper">
        <p className="lp-cq__line"><b>{subject.name}</b><span>{C.subjectLine(shown.covered, subject.of)}</span></p>
        <ul className="lp-cq__legend">
          {legend.map((item) => (
            <li key={item.status}>
              <span className={`lp-cq__swatch lp-cq-st--${item.status}`} aria-hidden="true" />
              <b>{item.n}</b>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        {/* One tab stop for the strip: the arrow keys, Home and End move along its cells. */}
        <ol className="lp-cq__strip" ref={strip} aria-label={C.strip(subject.name)} onKeyDown={onStripKey}>
          {Array.from(cells, (code, i) => {
            const cellStatus = CODE_STATUS[code] || 'dropped';
            const at = i + 1;
            return (
              <li key={`${subjectId}-${at}`}>
                <button type="button" className={`lp-cq__cell lp-cq-st--${cellStatus}`} style={{ '--i': i }} data-n={at} tabIndex={at === n ? 0 : -1}
                  aria-current={at === n ? 'true' : undefined} aria-label={C.cell(at, STATUS_WORDS[cellStatus].label)} onClick={() => pickQuestion(at)}>{at}</button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={`lp-cq__pair lp-cq__pair--${group}`} ref={pair}>
        <div className="lp-cq__bar">
          <p className="lp-cq__where"><b>Q{n}</b><span className="lp-cq__of">{C.of(cells.length)}</span></p>
          <div className="lp-cq__step">
            <button type="button" className="lp-cq__arrow" aria-label={C.prev} disabled={n <= 1} onClick={() => pickQuestion(n - 1)}><ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" /></button>
            <button type="button" className="lp-cq__arrow" aria-label={C.next} disabled={n >= cells.length} onClick={() => pickQuestion(n + 1)}><ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" /></button>
          </div>
        </div>
        <p className="lp-cq__sr" role="status">{C.cell(n, words.label)}</p>

        {q ? (
          <div className="lp-cq__cols" key={`${subjectId}-${n}`}>
            <section className="lp-cq__panel lp-cq__panel--paper" aria-label={`${C.asked}, ${C.position(n, cells.length)}`}>
              <h3 className="lp-cq__tag">{C.asked}{q.chapter ? <span>{q.chapter}</span> : null}</h3>
              {q.passage ? (
                <details className="lp-cq__passage">
                  <summary>{C.passage}{q.passage.title ? `: ${q.passage.title}` : ''}</summary>
                  <PaperLines text={q.passage.text} />
                </details>
              ) : null}
              <Clamp><PaperLines text={q.stem} className="lp-cq__stem" /></Clamp>
              <Options options={q.options} keys={q.key} keyLabel={q.key.length > 1 ? C.ntaKeys : C.ntaKey} />
            </section>
            <p className={`lp-cq__seam lp-cq__seam--${group}`}>
              <SeamIcon size={20} strokeWidth={2.6} aria-hidden="true" />
              <b>{words.label}</b>
              {q.match ? <span className="lp-cq__say">{words.line}</span> : null}
            </p>
            <section className={`lp-cq__panel lp-cq__panel--ours lp-cq__panel--${group}`} aria-label={`${group === 'out' ? C.notCounted : C.ours}, ${C.position(n, cells.length)}`}>
              <h3 className="lp-cq__tag">{group === 'out' ? C.notCounted : C.ours}{q.match ? <span>{q.match.kind === 'card' ? C.card(q.match.chapter) : C.question(q.match.chapter)}</span> : null}</h3>
              <Ours q={q} />
            </section>
          </div>
        ) : failed[subjectId] ? (
          <div className="lp-cq__wait" role="alert">
            <p>{C.failed}</p>
            <button type="button" className="mm-btn mm-btn--secondary" onClick={() => load(subjectId)}>{C.retry}</button>
          </div>
        ) : (
          <div className="lp-cq__wait" role="status">
            <span className="lp-cq__bone" /><span className="lp-cq__bone lp-cq__bone--short" /><span className="lp-cq__bone" />
            <p className="lp-cq__sr">{C.loading}</p>
          </div>
        )}
      </div>

      <div className="lp-cq__foot">
        <Link href={subject.href} prefetch={false} className="mm-btn mm-btn--secondary lp-cq__full">{C.full(subject.name, subject.total)}</Link>
        {subject.sitting ? <p className="lp-cq__note">{C.note(subject.sitting)}</p> : null}
      </div>
    </div>
    </>
  );
}
