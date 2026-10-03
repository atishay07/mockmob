"use client";

// CUET subject combination planner: "which subjects should I put on the CUET form?"
// Targets + candidate subjects in, ranked combinations out, each checked against DU's
// published 2026 eligibility rules. Choices stay on this device.
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Search, Target, X } from 'lucide-react';
import { encodeSelection, loadIndex, PRESETS } from '@/lib/du/client';
import { describeGap } from '@/lib/du/eligibility';
import { DEFAULT_MAX_PAPERS, MAX_POOL, planCombos } from '@/lib/du/combos';

const STORE = 'mm.du.combo.v1';
const MAX_TARGETS = 6;
const QUICK_TARGETS = ['B.Com. (Hons.)', 'B.A. (Hons.) Economics', 'B.A. (Hons.) English', 'B.A. (Hons.) Political Science', 'B.A. (Hons.) Psychology', 'B.A. (Programme)'];
const key = (i) => `${i.kind}:${i.id}`;

function readStore() { try { return JSON.parse(window.localStorage.getItem(STORE) || 'null'); } catch { return null; } }
function writeStore(value) { try { window.localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* storage blocked: still works this visit */ } }

export default function ComboPlanner() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState([]);
  const [pool, setPool] = useState([]);
  const [maxPapers, setMaxPapers] = useState(DEFAULT_MAX_PAPERS);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadIndex().then((data) => {
      if (!alive) return;
      setIndex(data);
      const saved = readStore();
      if (saved) {
        if (Array.isArray(saved.targets)) setTargets(saved.targets.filter((id) => data.groups.some((g) => g.id === id)).slice(0, MAX_TARGETS));
        if (Array.isArray(saved.pool)) setPool(saved.pool.slice(0, MAX_POOL));
        if ([3, 4, 5].includes(saved.maxPapers)) setMaxPapers(saved.maxPapers);
      }
    }).catch(() => { if (alive) setError('We could not load the DU data. Check your connection and try again.'); });
    return () => { alive = false; };
  }, [attempt]);

  useEffect(() => { if (index) writeStore({ targets, pool, maxPapers }); }, [index, targets, pool, maxPapers]);

  // Ranking checks every combination against every programme; defer it so taps stay instant.
  const dTargets = useDeferredValue(targets);
  const dPool = useDeferredValue(pool);
  const dMax = useDeferredValue(maxPapers);
  const { ranked, keep } = useMemo(() => {
    if (!index || !dPool.length) return { ranked: [], keep: [] };
    return planCombos({ groups: index.groups, pool: dPool, targets: dTargets, maxPapers: dMax });
  }, [index, dPool, dTargets, dMax]);
  const stale = dPool !== pool || dTargets !== targets || dMax !== maxPapers;

  if (error) return <div className="du-state du-state--error" role="alert"><p>{error}</p><button type="button" className="du-link" onClick={() => { setError(''); setAttempt((n) => n + 1); }}>Try again</button></div>;
  if (!index) return <div className="du-state" role="status"><p>Loading DU programmes…</p></div>;

  const nameOf = (item) => item.kind === 'gat' ? 'General Aptitude Test' : (item.kind === 'language' ? index.languages : index.domains).find((s) => s.id === item.id)?.name || item.id;
  const inPool = (item) => pool.some((p) => key(p) === key(item));
  const toggle = (item) => setPool((list) => inPool(item) ? list.filter((p) => key(p) !== key(item)) : list.length >= MAX_POOL ? list : [...list, item]);
  const toggleTarget = (id) => setTargets((list) => list.includes(id) ? list.filter((t) => t !== id) : list.length >= MAX_TARGETS ? list : [...list, id]);
  const applyPreset = (p) => setPool([...p.languages.map((id) => ({ kind: 'language', id })), ...p.domains.map((id) => ({ kind: 'domain', id })), ...(p.gat ? [{ kind: 'gat', id: 'gat' }] : [])].slice(0, MAX_POOL));
  const groupByName = (name) => index.groups.find((g) => g.name === name);
  const q = query.trim().toLowerCase();
  const matches = q ? index.groups.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const chip = (item) => (
    <button key={key(item)} type="button" className="du-chip" aria-pressed={inPool(item)} onClick={() => toggle(item)} disabled={!inPool(item) && pool.length >= MAX_POOL}>
      <span className="du-chip__tick" aria-hidden="true"><Check size={12} /></span>{nameOf(item)}
    </button>
  );

  return (
    <div className="cp">
      <section className="cp-step" aria-labelledby="cp-s1">
        <h2 id="cp-s1" className="cp-step__title"><span>1</span>Where do you want to go?</h2>
        <p className="cp-step__hint">Pick up to {MAX_TARGETS} DU programmes. {targets.length} chosen.</p>
        <div className="du-chips">
          {QUICK_TARGETS.map((name) => { const g = groupByName(name); return g ? (
            <button key={g.id} type="button" className="du-chip" aria-pressed={targets.includes(g.id)} onClick={() => toggleTarget(g.id)} disabled={!targets.includes(g.id) && targets.length >= MAX_TARGETS}>
              <span className="du-chip__tick" aria-hidden="true"><Check size={12} /></span>{g.name}
            </button>) : null; })}
        </div>
        <label className="du-finder cp-search">
          <Search size={18} aria-hidden="true" />
          <span className="du-sr">Search DU programmes</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all 73 programmes, e.g. Psychology" />
        </label>
        {matches.length ? (
          <ul className="cp-results">{matches.map((g) => (
            <li key={g.id}><button type="button" aria-pressed={targets.includes(g.id)} onClick={() => toggleTarget(g.id)} disabled={!targets.includes(g.id) && targets.length >= MAX_TARGETS}>
              {targets.includes(g.id) ? <Check size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />}{g.name}<small>{g.stream}</small>
            </button></li>))}</ul>
        ) : null}
        {targets.length ? (
          <ul className="du-tray cp-tray" aria-label="Your target programmes">{targets.map((id) => {
            const g = index.groups.find((x) => x.id === id);
            return <li key={id}><button type="button" onClick={() => toggleTarget(id)} title="Remove">{g?.name || id}<X size={14} aria-hidden="true" /></button></li>;
          })}</ul>
        ) : null}
      </section>

      <section className="cp-step" aria-labelledby="cp-s2">
        <h2 id="cp-s2" className="cp-step__title"><span>2</span>Which subjects could you take?</h2>
        <p className="cp-step__hint">Tick every subject you studied or could prepare, up to {MAX_POOL}. {pool.length} ticked. We find the best {maxPapers} for your goals.</p>
        <div className="du-presets" role="group" aria-label="Quick start">
          <span>Quick start</span>
          {PRESETS.map((p) => <button key={p.id} type="button" className="du-preset" title={p.hint} onClick={() => applyPreset(p)}>{p.label}</button>)}
          {pool.length ? <button type="button" className="du-preset du-preset--ghost" onClick={() => setPool([])}>Clear all</button> : null}
        </div>
        <h3 className="cp-group">Languages</h3>
        <div className="du-chips">{index.languages.map((l) => chip({ kind: 'language', id: l.id }))}</div>
        <h3 className="cp-group">Domain subjects</h3>
        <div className="du-chips">{index.domains.map((d) => chip({ kind: 'domain', id: d.id }))}{chip({ kind: 'gat', id: 'gat' })}</div>
        <div className="cp-limit" role="group" aria-label="Papers on your CUET form">
          <span>Papers on your form</span>
          {[3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={maxPapers === n} onClick={() => setMaxPapers(n)}>{n}</button>)}
          <small>CUET UG 2026 allowed up to 5. 2027 rules are provisional.</small>
        </div>
      </section>

      <section className="cp-step cp-out" aria-labelledby="cp-s3" aria-busy={stale}>
        <h2 id="cp-s3" className="cp-step__title"><span>3</span>Your best combinations</h2>
        {!pool.length ? <p className="cp-step__hint">Tick a few subjects, or use a quick start, to see combinations.</p> : null}
        {keep.length ? <p className="cp-keep"><b>Do not drop:</b> {keep.map(nameOf).join(', ')}. Every combination that reaches all your targets uses {keep.length === 1 ? 'it' : 'them'}.</p> : null}
        <ol className="cp-list" aria-live="polite">
          {ranked.map((r, i) => (
            <li key={r.items.map(key).join('|')} className="cp-combo" data-best={i === 0 || undefined}>
              <div className="cp-combo__head">
                <span className="cp-combo__rank">{i === 0 ? 'Best fit' : `Option ${i + 1}`}</span>
                <span className="cp-combo__papers">{r.items.length} paper{r.items.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="cp-combo__subjects">{r.items.map((item) => <li key={key(item)}>{nameOf(item)}</li>)}</ul>
              <dl className="cp-combo__stats">
                {targets.length ? <div><dt>Your targets</dt><dd><b>{r.met.length}</b> of {targets.length}</dd></div> : null}
                <div><dt>All DU programmes</dt><dd><b>{r.unlocked}</b> of {index.groups.length}</dd></div>
              </dl>
              {r.missed.length ? (
                <ul className="cp-combo__missed">{r.missed.map((m) => (
                  <li key={m.id}><X size={14} aria-hidden="true" /><span><b>{m.name}</b>{m.nearest ? ` needs: ${m.nearest.gaps.map((g) => describeGap(g, index).replace(/^Add /, '')).join(', ')}` : ''}</span></li>
                ))}</ul>
              ) : targets.length ? <p className="cp-combo__ok"><Check size={14} aria-hidden="true" />Meets every target’s subject rules.</p> : null}
              <Link className="du-link cp-combo__go" href={`/cuet-cutoff-calculator?s=${encodeURIComponent(encodeSelection(r.selection))}`}>See the programmes and cutoffs for this combination<ArrowRight size={15} aria-hidden="true" /></Link>
            </li>
          ))}
        </ol>
        <p className="cp-fine">Checked against the University of Delhi UG Bulletin 2026-27 subject rules. Subject eligibility is not admission: your score, category and seats decide that. Confirm the 2027 Bulletin before you register.</p>
      </section>
    </div>
  );
}
