"use client";

// Compass Pro: practice projection, a personal DU shortlist and the one paper to work on.
// Every number is either the student's own server-scored practice (projected with the +5/-1
// arithmetic and a Wilson range) or a cutoff DU published for 2026. Nothing here is a
// prediction, a normalised CUET score or an admission chance, and the copy says so.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { decodeSelection, formatScore, loadIndex, loadOfferings, readSaved } from '@/lib/du/client';
import { CATEGORY_LABELS, MAIN_CATEGORIES, effectiveCutoff, evaluateGroup } from '@/lib/du/eligibility';
import { compareToCutoff } from '@/../data/compass_projection';

const SHORTLIST_LIMIT = 8;
const ROUNDS = ['Round I', 'Round II', 'Round III'];
const storeKey = (userId) => `mm.compass.shortlist.v1.${userId || 'anon'}`;

function readShortlist(userId) {
  try { const list = JSON.parse(window.localStorage.getItem(storeKey(userId)) || '[]'); return Array.isArray(list) ? list.slice(0, SHORTLIST_LIMIT) : []; } catch { return []; }
}
function writeShortlist(userId, list) {
  try { window.localStorage.setItem(storeKey(userId), JSON.stringify(list)); } catch { /* storage blocked: the list lasts this visit */ }
}

function useCompassPro(userId) {
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetch('/api/compass/pro', { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !body?.ok) throw new Error('unavailable');
        setState(body.locked ? { status: 'locked' } : { status: 'ready', projection: body.projection });
      })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [userId, attempt]);
  return [state, () => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }];
}

function PaperRow({ paper, max }) {
  if (paper.status !== 'ready') {
    return (
      <li className="cpro-paper" data-thin="true">
        <span className="cpro-paper__name">{paper.name}</span>
        <span className="cpro-paper__thin">Practise {paper.needed} more questions to project this paper</span>
      </li>
    );
  }
  const pct = (v) => `${(v / max) * 100}%`;
  return (
    <li className="cpro-paper">
      <span className="cpro-paper__name">{paper.name}<small>{paper.n} questions · {paper.accuracy.pct}% accuracy · {paper.attemptShare}% attempted</small></span>
      <span className="cpro-paper__track" aria-hidden="true">
        <i style={{ left: pct(paper.low), width: `calc(${pct(paper.high)} - ${pct(paper.low)})` }} />
        <b style={{ left: pct(paper.mid) }} />
      </span>
      <span className="cpro-paper__val mm-measure"><b>{paper.mid}</b> / {max}<small>{paper.low}–{paper.high}</small></span>
    </li>
  );
}

function Locked() {
  return (
    <section className="cpro cpro--locked" aria-labelledby="cpro-title">
      <div className="cpro-head">
        <span className="cpro-badge"><Sparkles size={14} aria-hidden="true" />Compass Pro</span>
        <h2 id="cpro-title">Map your practice to the colleges you want.</h2>
        <p>Pro turns your own practice into a projected score band, checks it against the DU cutoffs for your shortlist, and names the paper that can move your total the most.</p>
      </div>
      <ul className="cpro-features">
        <li><Target size={18} aria-hidden="true" /><b>Practice projection</b><span>Each paper out of 250, from your attempt rate and accuracy, with an honest range.</span></li>
        <li><Plus size={18} aria-hidden="true" /><b>Your DU shortlist</b><span>Up to 8 college and programme targets, compared round by round in your category.</span></li>
        <li><ArrowRight size={18} aria-hidden="true" /><b>Next move</b><span>The paper with the most marks open, and its weakest chapter, one tap from practice.</span></li>
      </ul>
      <div className="cpro-cta">
        <Link href="/pricing" className="btn-volt md"><Lock size={16} aria-hidden="true" />Unlock Compass Pro</Link>
        <span>Eligibility and published cutoffs below stay free for everyone.</span>
      </div>
    </section>
  );
}

export default function CompassPro({ userId, seedSubjects = [] }) {
  const [state, retry] = useCompassPro(userId);
  const [index, setIndex] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [category, setCategory] = useState('UR');
  const [programme, setProgramme] = useState('');
  const [college, setCollege] = useState('');
  const [offerings, setOfferings] = useState({});

  useEffect(() => {
    if (state.status !== 'ready') return undefined;
    let alive = true;
    const saved = readSaved();
    const timer = window.setTimeout(() => {
      setShortlist(readShortlist(userId));
      if (saved?.c && MAIN_CATEGORIES.includes(saved.c)) setCategory(saved.c);
    }, 0);
    loadIndex().then((data) => { if (alive) setIndex(data); }).catch(() => {});
    return () => { alive = false; window.clearTimeout(timer); };
  }, [state.status, userId]);

  // Offerings for every programme on the shortlist, plus the one being chosen.
  const needed = useMemo(() => [...new Set([...shortlist.map((t) => t.groupId), programme].filter(Boolean))], [shortlist, programme]);
  useEffect(() => {
    let alive = true;
    for (const id of needed) {
      if (offerings[id]) continue;
      loadOfferings(id).then((data) => { if (alive) setOfferings((prev) => ({ ...prev, [id]: data })); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [needed, offerings]);

  const eligible = useMemo(() => {
    if (!index) return [];
    const saved = readSaved();
    const selection = decodeSelection(saved?.s || seedSubjects.join(','), index);
    return index.groups.filter((g) => evaluateGroup(g, selection).eligible).sort((a, b) => a.name.localeCompare(b.name));
  }, [index, seedSubjects]);

  if (state.status === 'locked') return <Locked />;
  if (state.status === 'loading') return <section className="cpro" aria-busy="true"><p className="cpro-muted">Reading your practice record…</p></section>;
  if (state.status === 'error') return <section className="cpro"><p className="cpro-muted">Compass Pro could not read your record just now. <button type="button" className="pr-link" onClick={retry}>Try again</button></p></section>;

  const { projection } = state;
  const { total, papers, next, paperMax } = projection;
  const band = { low: total.low, mid: total.mid, high: total.high };
  const ready = papers.some((p) => p.status === 'ready');
  const add = () => {
    if (!programme || !college || shortlist.some((t) => t.groupId === programme && t.college === college)) return;
    const list = [...shortlist, { groupId: programme, college }].slice(0, SHORTLIST_LIMIT);
    setShortlist(list); writeShortlist(userId, list); setCollege('');
  };
  const remove = (target) => {
    const list = shortlist.filter((t) => !(t.groupId === target.groupId && t.college === target.college));
    setShortlist(list); writeShortlist(userId, list);
  };
  const colleges = offerings[programme]?.rows?.map((r) => r[0]) || [];

  return (
    <section className="cpro" aria-labelledby="cpro-title">
      <div className="cpro-head">
        <span className="cpro-badge"><Sparkles size={14} aria-hidden="true" />Compass Pro</span>
        <h2 id="cpro-title">Your practice, mapped to your colleges.</h2>
        <p>If exam day went exactly like your practice so far, this is what each paper would be worth. It is a projection from your own record, not a prediction: CUET scores are normalised and your practice will change it.</p>
      </div>

      <div className="cpro-grid">
        <article className="cpro-card cpro-proj">
          <h3>Practice projection</h3>
          {ready ? (
            <>
              <p className="cpro-total mm-measure"><b>{total.mid}</b><span> / {total.max}</span></p>
              <p className="cpro-range">Likely range {total.low}–{total.high}{total.complete ? ' from your strongest language and three domain papers' : ` from ${total.count} of 4 papers. Practise more subjects for a full total`}</p>
            </>
          ) : <p className="cpro-muted">Practise at least {projection.minSample} questions in a subject to project its paper.</p>}
          <ul className="cpro-papers">{papers.map((p) => <PaperRow key={p.subject} paper={p} max={paperMax} />)}</ul>
          {!papers.length ? <Link href="/dashboard" className="pr-link">Start a practice session<ArrowRight size={14} aria-hidden="true" /></Link> : null}
        </article>

        <article className="cpro-card cpro-next">
          <h3>Next move</h3>
          {next ? (
            <>
              <p className="cpro-next__lead"><b>{next.name}</b> has the most room: {next.open} of {paperMax} marks are still open in your practice.</p>
              {next.chapter ? <p className="cpro-muted">Start with {next.chapter.name}: {next.chapter.wrong} wrong and {next.chapter.skip} blank in {next.chapter.n} questions.</p> : null}
              <Link href={`/dashboard?subject=${encodeURIComponent(next.subject)}&mode=quick`} className="btn-volt md">Practise {next.name}<ArrowRight size={16} aria-hidden="true" /></Link>
            </>
          ) : <p className="cpro-muted">Your next move appears once a paper has enough practice.</p>}
        </article>
      </div>

      <article className="cpro-card cpro-short">
        <div className="cpro-short__head">
          <h3>Your DU shortlist</h3>
          <label className="cpro-select"><span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{MAIN_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}</select>
          </label>
        </div>
        {shortlist.length < SHORTLIST_LIMIT ? (
          <div className="cpro-add">
            <label className="cpro-select"><span>Programme you are eligible for</span>
              <select value={programme} onChange={(e) => { setProgramme(e.target.value); setCollege(''); }} disabled={!index}>
                <option value="">{index ? (eligible.length ? 'Choose a programme' : 'Tick your subjects in the calculator below') : 'Loading programmes…'}</option>
                {eligible.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="cpro-select"><span>College</span>
              <select value={college} onChange={(e) => setCollege(e.target.value)} disabled={!colleges.length}>
                <option value="">{programme ? (colleges.length ? 'Choose a college' : 'Loading colleges…') : 'Choose a programme first'}</option>
                {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button type="button" className="btn-outline md" onClick={add} disabled={!programme || !college}><Plus size={16} aria-hidden="true" />Add target</button>
          </div>
        ) : <p className="cpro-muted">Your shortlist is full. Remove a target to add another.</p>}

        {shortlist.length ? (
          <ul className="cpro-targets">
            {shortlist.map((t) => {
              const data = offerings[t.groupId];
              const row = data?.rows?.find((r) => r[0] === t.college);
              const catIndex = data ? data.categories.indexOf(category) : -1;
              const cutoffs = row ? [row[2], row[3], row[4]].map((r) => effectiveCutoff(r, catIndex < 0 ? 0 : catIndex)) : [null, null, null];
              const first = cutoffs.find((c) => c !== null) ?? null;
              const verdict = ready && total.complete ? compareToCutoff(band, first) : null;
              return (
                <li key={`${t.groupId}::${t.college}`} className="cpro-target" data-position={verdict?.position || 'unknown'}>
                  <div className="cpro-target__who"><b>{t.college}</b><span>{data?.name || '…'}</span></div>
                  <dl className="cpro-target__rounds">
                    {cutoffs.map((c, i) => <div key={ROUNDS[i]}><dt>{ROUNDS[i]}</dt><dd className="mm-measure">{c === null ? 'Not listed' : formatScore(c)}</dd></div>)}
                  </dl>
                  <p className="cpro-target__verdict">
                    {!verdict ? (ready ? 'A full four-paper projection is needed to compare.' : 'Practise to compare.') :
                      verdict.position === 'above' ? `Your whole band clears the earliest listed cutoff by ${verdict.by}+.` :
                      verdict.position === 'within' ? 'The earliest listed cutoff sits inside your band: within reach.' :
                      verdict.position === 'below' ? `Your band is ${verdict.by}+ below the earliest listed cutoff.` : 'DU listed no cutoff for this category.'}
                  </p>
                  <button type="button" className="cpro-remove" onClick={() => remove(t)} aria-label={`Remove ${t.college} from your shortlist`}><Trash2 size={16} aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>
        ) : <p className="cpro-muted">Add colleges you are aiming for. They stay on this device.</p>}
        <p className="cpro-fine">Cutoffs are DU’s published 2026 minimum allocation scores; reserved categories clear a round at the lower of their own or the UR cutoff. 2027 cutoffs will differ with seats and demand.</p>
      </article>
    </section>
  );
}
