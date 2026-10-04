"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Printer, RotateCcw, Search, Share2, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SubjectPicker } from '@/components/du/SubjectPicker';
import {
  CATEGORY_LABELS,
  MAIN_CATEGORIES,
  OTHER_CATEGORIES,
  describeGap,
  effectiveCutoff,
  emptySelection,
  evaluateAll,
  explainCombinations,
  seatStatus,
  suggestUnlocks,
} from '@/lib/du/eligibility';
import {
  PRACTICE_HUBS,
  PRESETS,
  STREAM_ORDER,
  buildQuery,
  decodeSelection,
  encodeSelection,
  formatScore,
  loadIndex,
  loadOfferings,
  readSaved,
  writeSaved,
} from '@/lib/du/client';
import '@/components/du/du.css';

const PAGE_SIZE = 25;

function parseScore(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
}

function normName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ---------------------------------------------------------------------------------------
// The exact Bulletin rules for a programme, checked against the student's subjects.

function RulesList({ rows }) {
  return (
    <ul className="du-rules">
      {rows.map((r) => (
        <li key={r.label} data-ok={r.ok}>
          <span className="du-rules__mark" aria-hidden="true">{r.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}</span>
          <div>
            <p>
              <b>{r.label}</b> {r.text}
            </p>
            {r.ok ? <small>You meet this{r.secondary ? '. Considered only if seats remain after Combinations I and II' : ''}.</small> : null}
            {!r.ok && r.missing.length > 0 ? <small>{r.missing.join(' · ')}</small> : null}
            {r.extraLanguage ? <small>The Bulletin also requires at least one language from List A.</small> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------

function SeatRow({ row, catIndex, category, score, groupName }) {
  const status = score != null ? seatStatus(score, row, catIndex) : null;
  const subtitle = normName(row[1]) === normName(groupName) ? '' : row[1];
  return (
    <li className="du-seat" data-status={status?.id}>
      <div className="du-seat__name">
        <strong>{row[0]}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <dl className="du-seat__cuts">
        {['I', 'II', 'III'].map((label, i) => {
          const arr = row[2 + i];
          const eff = effectiveCutoff(arr, catIndex);
          const viaUr = category !== 'UR' && arr && typeof arr[0] === 'number' && eff === arr[0] && arr[catIndex] !== arr[0];
          return (
            <div key={label}>
              <dt>Round {label}</dt>
              <dd className="mm-measure">
                {eff == null ? '–' : formatScore(eff)}
                {viaUr ? <abbr title="Cleared on the Unreserved cutoff, which is lower">UR</abbr> : null}
              </dd>
            </div>
          );
        })}
      </dl>
      {status ? <span className="du-seat__status">{status.label}</span> : null}
    </li>
  );
}

function CutoffTable({ group, catIndex, category, score }) {
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(score != null ? 'fit' : 'high');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadOfferings(group.id)
      .then((data) => alive && setState({ status: 'ready', rows: data.rows }))
      .catch(() => alive && setState({ status: 'error', rows: [] }));
    return () => {
      alive = false;
    };
  }, [group.id, attempt]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.rows.filter((r) => !q || `${r[0]} ${r[1]}`.toLowerCase().includes(q));
    const r1 = (r) => effectiveCutoff(r[2], catIndex);
    const best = (r) => {
      const vals = [r[2], r[3], r[4]].map((a) => effectiveCutoff(a, catIndex)).filter((v) => v != null);
      return vals.length ? Math.min(...vals) : null;
    };
    const num = (v, fallback) => (v == null ? fallback : v);
    list = [...list];
    if (sort === 'name') list.sort((a, b) => a[0].localeCompare(b[0]) || String(a[1]).localeCompare(String(b[1])));
    else if (sort === 'low') list.sort((a, b) => num(best(a), 9999) - num(best(b), 9999));
    else if (sort === 'fit' && score != null) {
      list.sort((a, b) => {
        const ba = best(a);
        const bb = best(b);
        const ca = ba != null && score >= ba;
        const cb = bb != null && score >= bb;
        if (ca !== cb) return ca ? -1 : 1;
        if (ca) return num(r1(b), 0) - num(r1(a), 0);
        return num(ba, 9999) - num(bb, 9999);
      });
    } else list.sort((a, b) => num(r1(b), -1) - num(r1(a), -1));
    return list;
  }, [state.rows, query, sort, score, catIndex]);

  const clearing = useMemo(() => {
    if (score == null) return null;
    return state.rows.filter((r) => ['r1', 'r2', 'r3'].includes(seatStatus(score, r, catIndex).id)).length;
  }, [state.rows, score, catIndex]);

  if (state.status === 'loading') return <p className="du-state">Loading college cutoffs…</p>;
  if (state.status === 'error') {
    return (
      <div className="du-state du-state--error">
        <p>We could not load the cutoffs for this programme.</p>
        <button type="button" className="du-link" onClick={() => { setState({ status: 'loading', rows: [] }); setAttempt((n) => n + 1); }}>
          <RotateCcw size={14} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {clearing != null ? (
        <p className="du-clearing" role="status">
          A score of <strong className="mm-measure">{formatScore(score)}</strong> was at or above a published 2026 cutoff in <strong>{clearing}</strong> of {state.rows.length} college entries.
        </p>
      ) : null}
      <div className="du-tools">
        <label className="du-search">
          <Search size={16} aria-hidden="true" />
          <span className="du-sr">Search colleges</span>
          <input type="search" value={query} placeholder="Search a college" onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE); }} />
        </label>
        <label className="du-select">
          <span className="du-sr">Sort colleges</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {score != null ? <option value="fit">Seats you clear first</option> : null}
            <option value="high">Highest cutoff first</option>
            <option value="low">Lowest cutoff first</option>
            <option value="name">College A to Z</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="du-state">No college matches that search.</p>
      ) : (
        <ul className="du-seats">
          {rows.slice(0, shown).map((row) => (
            <SeatRow key={`${row[0]}|${row[1]}`} row={row} catIndex={catIndex} category={category} score={score} groupName={group.name} />
          ))}
        </ul>
      )}
      {rows.length > shown ? (
        <button type="button" className="du-more" onClick={() => setShown((n) => n + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, rows.length - shown)} more ({rows.length - shown} remaining)
        </button>
      ) : null}
    </>
  );
}

function ProgrammeCard({ result, explain, category, catIndex, score, open, onToggle }) {
  const { group, matched, secondary } = result;
  const r1 = group.summary?.['round-1']?.[category] || group.summary?.['round-1']?.UR;
  const hasCutoffs = group.offerings > 0 && r1;
  let verdict = null;
  if (hasCutoffs && score != null) {
    const [, , lo, hi] = r1;
    verdict = score >= hi ? 'Above every Round I cutoff' : score >= lo ? 'Within the Round I range' : 'Below every Round I cutoff';
  }
  const panelId = `du-panel-${group.id}`;
  return (
    <article className="du-card" data-open={open}>
      <button type="button" className="du-card__head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="du-card__main">
          <span className="du-card__title">{group.name}</span>
          <span className="du-card__meta">
            <span className="du-tag">{group.stream}</span>
            {group.offerings > 0 ? <span>{group.colleges} {group.colleges === 1 ? 'college' : 'colleges'}</span> : <span>No CUET cutoff list published</span>}
            {hasCutoffs ? (
              <span className="mm-measure">
                Round I ({category}): {formatScore(r1[2])} to {formatScore(r1[3])}
              </span>
            ) : null}
          </span>
          {matched ? (
            <span className="du-card__match">
              <b>{matched.label}</b> {matched.text}
              {secondary ? <em>Considered only if seats remain after Combinations I and II</em> : null}
            </span>
          ) : null}
          {group.eligibility.performanceTest ? <span className="du-card__flag">Merit also uses a separate performance or practical test</span> : null}
        </span>
        <span className="du-card__side">
          {verdict ? <span className="du-verdict" data-tone={verdict.startsWith('Above') ? 'good' : verdict.startsWith('Within') ? 'mid' : 'low'}>{verdict}</span> : null}
          <ChevronDown size={18} aria-hidden="true" className="du-card__chev" />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="du-card__panel">
          <section className="du-sec">
            <h4>DU’s eligibility rules, checked against your subjects</h4>
            <RulesList rows={explain} />
          </section>
          <section className="du-sec">
            <h4>{group.offerings > 0 ? 'College cutoffs, 2026' : 'Cutoffs'}</h4>
            {group.offerings > 0 ? (
              <CutoffTable group={group} catIndex={catIndex} category={category} score={score} />
            ) : (
              <p className="du-state">DU did not publish a CUET cutoff list for this programme in 2026. Its merit combines your CUET score with a separate test.</p>
            )}
          </section>
          {group.eligibility.notes.length > 0 ? (
            <details className="du-notes">
              <summary>Notes from the DU Bulletin</summary>
              {group.eligibility.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------------------

export function CutoffCalculator({ seedSubjects = null } = {}) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selection, setSelection] = useState(emptySelection());
  const [category, setCategory] = useState('UR');
  const [scoreText, setScoreText] = useState('');
  const [finder, setFinder] = useState('');
  const [stream, setStream] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('colleges');
  const [onlyClearing, setOnlyClearing] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [message, setMessage] = useState('');
  const sideRef = useRef(null);
  const resultsRef = useRef(null);

  // Load the data, then take the starting selection from the link (teaser, Radar, a shared URL)
  // or from this device. After applying a link we remove its parameters, so a later reload
  // cannot override edits made since. The address bar is never rewritten while editing.
  useEffect(() => {
    let alive = true;
    loadIndex()
      .then((index) => {
        if (!alive) return;
        const params = new URLSearchParams(window.location.search);
        const saved = readSaved();
        const fromLink = params.has('s');
        // Priority: a link, then this device's saved choice, then the signed-in student's own subjects.
        const fromSaved = !fromLink && saved?.s ? saved.s : '';
        const seeded = !fromLink && !fromSaved && Array.isArray(seedSubjects) ? seedSubjects.join(',') : '';
        const sel = decodeSelection(fromLink ? params.get('s') : fromSaved || seeded, index);
        const rawCat = (fromLink ? params.get('c') : saved?.c) || 'UR';
        const cat = index.meta.categories.includes(rawCat) ? rawCat : 'UR';
        const scoreRaw = fromLink ? params.get('score') ?? '' : saved?.score ?? '';
        setSelection(sel);
        setCategory(cat);
        setScoreText(String(scoreRaw));
        setData(index);
        const linkedCourse = index.groups.find((group) => group.id === params.get('course'));
        if (linkedCourse) {
          setQuery(linkedCourse.name);
          setOpenIds(new Set([linkedCourse.id]));
        }
        if (fromLink) {
          writeSaved({ s: encodeSelection(sel), c: cat, score: String(scoreRaw) });
          window.history.replaceState(window.history.state, '', window.location.pathname);
        } else if (linkedCourse) {
          window.history.replaceState(window.history.state, '', window.location.pathname);
        }
      })
      .catch(() => alive && setError('We could not load the DU data. Check your connection and reload.'));
    return () => {
      alive = false;
    };
    // The seed is read once, on load; later edits belong to the student.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  useEffect(() => {
    if (!data) return;
    writeSaved({ s: encodeSelection(selection), c: category, score: scoreText });
  }, [data, selection, category, scoreText]);

  const score = parseScore(scoreText);
  const catIndex = data ? data.meta.categories.indexOf(category) : 0;
  const hasSelection = selection.languages.length + selection.domains.length > 0 || selection.gat;
  const subjectCount = selection.languages.length + selection.domains.length + (selection.gat ? 1 : 0);

  const toggle = useCallback((kind, id) => {
    setSelection((s) => {
      if (kind === 'gat') return { ...s, gat: !s.gat };
      const key = kind === 'language' ? 'languages' : 'domains';
      return { ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] };
    });
  }, []);

  const results = useMemo(() => (data ? evaluateAll(data.groups, selection) : []), [data, selection]);
  const eligible = useMemo(() => results.filter((r) => r.eligible), [results]);
  const ineligible = useMemo(() => results.filter((r) => !r.eligible), [results]);
  const unlocks = useMemo(() => (data && hasSelection ? suggestUnlocks(data.groups, selection, data, 4) : []), [data, selection, hasSelection]);

  const explainFor = useCallback((group) => (data ? explainCombinations(group, selection, data) : []), [data, selection]);

  const couldClear = useCallback(
    (group) => {
      if (score == null) return true;
      const vals = ['round-1', 'round-2', 'round-3'].map((r) => group.summary?.[r]?.[category]?.[2]).filter((v) => typeof v === 'number');
      return vals.length > 0 && score >= Math.min(...vals);
    },
    [score, category]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (r) => (stream === 'All' || r.group.stream === stream) && (!q || r.group.name.toLowerCase().includes(q));
    let list = eligible.filter(matches);
    if (onlyClearing && score != null) list = list.filter((r) => couldClear(r.group));
    const top = (g) => g.summary?.['round-1']?.[category]?.[3] ?? g.summary?.['round-1']?.UR?.[3] ?? -1;
    list = [...list];
    if (sort === 'name') list.sort((a, b) => a.group.name.localeCompare(b.group.name));
    else if (sort === 'cutoff') list.sort((a, b) => top(b.group) - top(a.group));
    else list.sort((a, b) => b.group.colleges - a.group.colleges || a.group.name.localeCompare(b.group.name));
    return { list, near: ineligible.filter(matches) };
  }, [eligible, ineligible, stream, query, sort, onlyClearing, score, couldClear, category]);

  const streams = useMemo(() => {
    if (!data) return [];
    const present = new Set(data.groups.map((g) => g.stream));
    return STREAM_ORDER.filter((s) => present.has(s));
  }, [data]);

  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const flash = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3000);
  };

  const share = async () => {
    const q = buildQuery({ selection, category, score: scoreText });
    const url = `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: 'My DU programme options', url });
      else {
        await navigator.clipboard.writeText(url);
        flash('Link copied. Anyone can open it with your subjects pre-filled.');
      }
    } catch {
      flash('Could not share from here. Copy the link from your browser instead.');
    }
  };

  const goTo = (ref) => ref.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });

  if (error) return <div className="du-state du-state--error" role="alert"><p>{error}</p><button type="button" className="du-link" onClick={() => { setError(''); setLoadAttempt((value) => value + 1); }}>Try again</button></div>;
  if (!data) {
    return (
      <div className="du-skeleton" aria-busy="true" aria-label="Loading the calculator">
        <span /> <span /> <span />
      </div>
    );
  }

  const subjectName = (id) => data.languages.find((l) => l.id === id)?.name || data.domains.find((d) => d.id === id)?.name || id;
  const subjectLabel = (id) => data.domains.find((d) => d.id === id)?.aliases?.[0] || subjectName(id);
  const practiceSubjects = [...selection.languages, ...selection.domains].filter((id) => PRACTICE_HUBS[id]);
  const applyPreset = (p) => setSelection({ languages: [...p.languages], domains: [...p.domains], gat: p.gat });
  const total = data.groups.length;
  const selectedList = [
    ...selection.languages.map((id) => ({ id, kind: 'language', label: subjectName(id), title: subjectName(id) })),
    ...selection.domains.map((id) => ({ id, kind: 'domain', label: subjectLabel(id), title: subjectName(id) })),
    ...(selection.gat ? [{ id: 'gat', kind: 'gat', label: 'General Aptitude Test', title: 'General Aptitude Test' }] : []),
  ];

  return (
    <div className="du-app">
      {hasSelection ? (
        <div className="du-sum" role="region" aria-label="Your selection">
          <p>
            <strong className="mm-measure">{eligible.length}</strong>
            <span>of {total} unlocked</span>
          </p>
          <div>
            <button type="button" onClick={() => goTo(sideRef)}>Edit<span className="du-sum__long"> subjects</span></button>
            <button type="button" data-primary onClick={() => goTo(resultsRef)}>View courses</button>
          </div>
        </div>
      ) : null}

      <div className="du-layout">
        {/* --------------------------- Your subjects --------------------------- */}
        <aside className="du-side" ref={sideRef} aria-labelledby="du-side-title">
          <div className="du-side__head">
            <h2 id="du-side-title" className="du-h2">Your CUET subjects</h2>
            <span className="du-count mm-measure" aria-live="polite">{subjectCount} selected</span>
          </div>
          <div className="du-presets" role="group" aria-label="Quick start">
            <span>Quick start</span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="du-preset" title={p.hint} onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
            {hasSelection ? (
              <button type="button" className="du-preset du-preset--ghost" onClick={() => { setSelection(emptySelection()); setFinder(''); }}>
                Clear all
              </button>
            ) : null}
          </div>

          <SubjectPicker catalog={data} selection={selection} onToggle={toggle} query={finder} onQuery={setFinder} />

          <div className="du-side__sec">
            <h3 className="du-h3">Category and score <small>optional</small></h3>
            <div className="du-field">
              <span className="du-label" id="du-cat-label">Category</span>
              <div className="du-seg" role="radiogroup" aria-labelledby="du-cat-label">
                {MAIN_CATEGORIES.map((c, index) => (
                  <button key={c} type="button" role="radio" aria-checked={category === c} tabIndex={category === c || (!MAIN_CATEGORIES.includes(category) && index === 0) ? 0 : -1}
                    onKeyDown={event => {
                      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
                      if (!keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
                      event.preventDefault();
                      const next = event.key === 'Home' ? 0 : event.key === 'End' ? MAIN_CATEGORIES.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + MAIN_CATEGORIES.length) % MAIN_CATEGORIES.length;
                      setCategory(MAIN_CATEGORIES[next]);
                      event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[next]?.focus();
                    }} className="du-seg__btn" onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <label className="du-select du-select--full" data-active={OTHER_CATEGORIES.includes(category)}>
                <span className="du-sr">Other quota</span>
                <select value={OTHER_CATEGORIES.includes(category) ? category : ''} onChange={(e) => e.target.value && setCategory(e.target.value)}>
                  <option value="">Other quota (Sikh, PwBD, KM, SGC, orphan)</option>
                  {OTHER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="du-field">
              <span className="du-label">Your programme-specific CUET score</span>
              <input
                className="du-input mm-measure"
                inputMode="decimal"
                placeholder={`e.g. ${Math.round(data.meta.scoreRange[1] * 0.8)}`}
                value={scoreText}
                onChange={(e) => setScoreText(e.target.value.replace(/[^0-9.]/g, '').slice(0, 7))}
                aria-describedby="du-score-help"
              />
              <small id="du-score-help">
                DU shows this per programme on your CSAS dashboard after results. Before results, enter a target. DU’s 2026 lists run up to {formatScore(data.meta.scoreRange[1])}.
                {scoreText && score == null ? ' Enter a number between 0 and 1000.' : ''}
              </small>
            </label>
          </div>
        </aside>

        {/* ------------------------------ Results ------------------------------ */}
        <div className="du-main" ref={resultsRef} id="results">
          <div className="du-bar">
            <div>
              <h2 className="du-h2" aria-live="polite">
                {hasSelection ? (
                  <>
                    <span className="mm-measure">{eligible.length}</span> of {total} DU programmes unlocked
                  </>
                ) : (
                  'Your DU programmes appear here'
                )}
              </h2>
              <p className="du-sub">
                {hasSelection ? `Category ${category}${score != null ? ` · score ${formatScore(score)}` : ''}. Updates as you change subjects.` : 'Pick your subjects, or use a quick start. The list updates as you tick.'}
              </p>
            </div>
            {hasSelection ? (
              <div className="du-actions">
                <button type="button" className="du-btn" onClick={share}><Share2 size={16} aria-hidden="true" /> Share</button>
                <button type="button" className="du-btn" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Save PDF</button>
              </div>
            ) : null}
          </div>
          <p className="du-toast" role="status">{message}</p>

          {hasSelection ? (
            <>
              <ul className="du-tray" aria-label="Selected subjects">
                {selectedList.map((s) => (
                  <li key={`${s.kind}-${s.id}`}>
                    <button type="button" title={`${s.title}. Tap to remove`} onClick={() => toggle(s.kind, s.id)}>
                      <span>{s.label}</span>
                      <X size={13} aria-hidden="true" />
                      <span className="du-sr">remove</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="du-printonly">
                Subjects: {selectedList.map((s) => s.title).join(', ')}. Category: {category}.{score != null ? ` Score: ${formatScore(score)}.` : ''} Source: University of Delhi CSAS UG 2026 documents. Historical cutoffs do not predict a future allocation.
              </p>

              {unlocks.length > 0 ? (
                <div className="du-unlocks">
                  <p><Sparkles size={15} aria-hidden="true" /> Add one subject to unlock more programmes</p>
                  <ul>
                    {unlocks.map((u) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => toggle(u.kind, u.id)}>
                          <span>{u.kind === 'domain' ? subjectLabel(u.id) : u.name}</span>
                          <b className="mm-measure">+{u.unlocks}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {eligible.length === 0 ? (
                <div className="du-empty">
                  <h3>No programme is open to these subjects yet.</h3>
                  <p>
                    Most DU programmes need <b>one language and three domain subjects</b>, or <b>one language, one domain subject and the General Aptitude Test</b>. You have {selection.languages.length} {selection.languages.length === 1 ? 'language' : 'languages'}, {selection.domains.length} domain {selection.domains.length === 1 ? 'subject' : 'subjects'}{selection.gat ? ' and the General Aptitude Test' : ''} so far.
                  </p>
                </div>
              ) : (
                <div className="du-filters">
                  <div className="du-streams" role="group" aria-label="Filter by stream">
                    {['All', ...streams].map((s) => (
                      <button key={s} type="button" aria-pressed={stream === s} onClick={() => setStream(s)}>{s}</button>
                    ))}
                  </div>
                  <div className="du-tools">
                    <label className="du-search">
                      <Search size={16} aria-hidden="true" />
                      <span className="du-sr">Search programmes</span>
                      <input type="search" value={query} placeholder="Search programmes" onChange={(e) => setQuery(e.target.value)} />
                    </label>
                    <label className="du-select">
                      <span className="du-sr">Sort programmes</span>
                      <select value={sort} onChange={(e) => setSort(e.target.value)}>
                        <option value="colleges">Most colleges</option>
                        <option value="cutoff">Highest cutoff</option>
                        <option value="name">A to Z</option>
                      </select>
                    </label>
                  </div>
                  {score != null ? (
                    <label className="du-check">
                      <input type="checkbox" checked={onlyClearing} onChange={(e) => setOnlyClearing(e.target.checked)} />
                      <span>Only programmes where my score clears a cutoff</span>
                    </label>
                  ) : null}
                </div>
              )}

              {eligible.length > 0 && visible.list.length === 0 ? <p className="du-state">Nothing matches these filters.</p> : null}
              <div className="du-list">
                {visible.list.map((r) => (
                  <ProgrammeCard
                    key={r.group.id}
                    result={r}
                    explain={openIds.has(r.group.id) ? explainFor(r.group) : []}
                    category={category}
                    catIndex={catIndex}
                    score={score}
                    open={openIds.has(r.group.id)}
                    onToggle={() => toggleOpen(r.group.id)}
                  />
                ))}
              </div>

              {visible.near.length > 0 ? (
                <details className="du-near" open={eligible.length === 0}>
                  <summary>
                    <span>Not eligible yet ({visible.near.length}). See what each one needs</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <ul>
                    {[...visible.near]
                      .filter((r) => r.nearest)
                      .sort((a, b) => a.nearest.size - b.nearest.size || a.group.name.localeCompare(b.group.name))
                      .map((r) => (
                        <li key={r.group.id}>
                          <details>
                            <summary>
                              <strong>{r.group.name}</strong>
                              <span>{r.nearest.gaps.map((g) => describeGap(g, data)).join(' · ')}</span>
                            </summary>
                            <RulesList rows={explainFor(r.group)} />
                          </details>
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* ------------------------------ CTA ------------------------------ */}
      <section className="du-cta" aria-labelledby="du-cta-title">
        <div>
          <h2 id="du-cta-title" className="du-h2">Cutoffs are only half the plan.</h2>
          <p className="du-sub">
            A cutoff tells you the target. MockMob’s Radar tells you which chapters stand between you and it: practise your subjects, finish a mock, and Radar maps every miss back to a chapter.
          </p>
          {practiceSubjects.length > 0 ? (
            <ul className="du-hubs" aria-label="Practise your subjects">
              {practiceSubjects.slice(0, 5).map((id) => (
                <li key={id}><Link href={PRACTICE_HUBS[id]}>{subjectName(id)} practice<ArrowRight size={14} aria-hidden="true" /></Link></li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="du-cta__actions">
          <Link href={isAuthenticated ? '/dashboard' : '/signup'} className="mm-btn mm-btn--primary">
            {isAuthenticated ? 'Open my Arena' : 'Start a free mock'}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href={isAuthenticated ? '/analytics' : '/features'} className="mm-btn mm-btn--secondary">
            {isAuthenticated ? 'Open my Radar' : 'See how Radar works'}
          </Link>
        </div>
      </section>
    </div>
  );
}
