"use client";
// Last paper on Today (TODAY-1018 section 3 row 6, R3's row made richer). The newest paper: its name, when, the change on
// the one before of the same format, the marks, a right / wrong / blank bar with the words beside it (colour is never
// the only signal), and its biggest leak: the chapter with the most marks open on that paper, worked out by the result
// page's own engine (computePrepOSInsights over the one paper). "Repair this leak" opens the result at that chapter's
// first open mistake; "Open the result" opens the paper. The leak line lands later into reserved height.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { TEST_MODES } from '@/../data/test_modes';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { paperDay } from '@/lib/today/move.mjs';
import { clockIn } from '@/lib/today/week.mjs';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The biggest leak on one paper: { chapter, here, wrong, blank, position } or null. */
function leakOf(attempt, subjectNames) {
  const i = computePrepOSInsights([attempt], { subjectNames });
  if (i.state !== 'ready') return null;
  const all = [...(i.chapters?.ranked || []), ...(i.chapters?.thin || [])].sort((a, b) => b.open - a.open);
  const top = all[0];
  if (!top || !(top.open > 0)) return null;
  const first = (top.recent || []).find((m) => m.outcome === 'wrong') || top.recent?.[0] || null;
  // The misses are counted on the same paper the leak comes from, so the sentence always agrees with itself.
  const misses = all.reduce((n, c) => n + c.wrong + c.skip, 0);
  return { chapter: top.chapter, here: top.wrong + top.skip, wrong: top.wrong, blank: top.skip, misses, position: first?.position || null };
}

export default function TodayPaper({ papers, loadAttempt, subjectName = (id) => id, hold = false }) {
  const last = papers.status === 'ready' ? papers.data?.[0] || null : null;
  const [leak, setLeak] = useState({ id: null, status: 'idle', value: null });
  useEffect(() => {
    if (!last?.id || hold) return undefined;
    let alive = true;
    loadAttempt(last.id)
      .then((a) => { if (alive) setLeak({ id: last.id, status: 'ready', value: leakOf(a, { [last.subject]: subjectName(last.subject) }) }); })
      .catch(() => { if (alive) setLeak({ id: last.id, status: 'error', value: null }); });
    return () => { alive = false; };
    // subjectName is a stable module function on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id, hold, loadAttempt]);

  if (hold || papers.status === 'loading') {
    return (
      <section className="tpp tpp--wait" aria-labelledby="tpp-h" aria-busy="true">
        <header className="tg__row"><h2 id="tpp-h" className="tg__h">Last paper</h2></header>
        <span className="tpp__skl" /><span className="tpp__skb" /><span className="tpp__skl tpp__skl--s" />
      </section>
    );
  }
  if (papers.status === 'error') {
    return (
      <section className="tpp" aria-labelledby="tpp-h">
        <header className="tg__row"><h2 id="tpp-h" className="tg__h">Last paper</h2></header>
        <p className="tpp__empty" role="status">Your papers did not load. Review still opens them.</p>
      </section>
    );
  }
  if (!last) return null;
  const rest = papers.data.slice(1);
  const before = rest.find((p) => p.formatId === last.formatId);
  const delta = before ? last.marks - before.marks : null;
  const mode = TEST_MODES[last.mode]?.label || 'Practice';
  const kind = mode === 'NTA mode' ? 'NTA mock' : mode;
  const title = `${subjectName(last.subject)} ${kind.charAt(0).toLowerCase()}${kind.slice(1)}`;
  const t = Number(last.completedAt);
  const at = Number.isFinite(t) ? `${WEEKDAYS[new Date(t + 19800000).getUTCDay()]} ${paperDay(t)}, ${clockIn(t)}` : '';
  const change = delta == null ? '' : delta === 0 ? ', level with the one before' : `, ${delta > 0 ? '+' : '−'}${Math.abs(delta)} on the one before`;
  const right = Number(last.correct) || 0;
  const wrong = Number(last.wrong) || 0;
  const n = Number(last.total) || right + wrong + (Number(last.unattempted) || 0);
  // A blank is any question neither right nor wrong, so the three always add up to the paper's length.
  const blank = Math.max(Number(last.unattempted) || 0, n - right - wrong);
  const pct = (k) => `${n ? (k / n) * 100 : 0}%`;
  const misses = wrong + blank;
  const l = leak.id === last.id ? leak : { status: 'loading' };
  const repairHref = `/result/${encodeURIComponent(last.id)}${l.value?.position ? `?q=${l.value.position}` : ''}`;
  return (
    <section className="tpp" aria-labelledby="tpp-h">
      <header className="tg__row"><h2 id="tpp-h" className="tg__h">Last paper</h2></header>
      <div className="tpp__row">
        <p className="tpp__t"><b>{title}</b><span>{at}{change}</span></p>
        <p className="tpp__fig"><b>{last.marks}</b><span>of {last.maxMarks}</span></p>
      </div>
      <div className="tpp__bar" role="img" aria-label={`${right} right, ${wrong} wrong, ${blank} blank, of ${n}`}>
        <i data-k="r" style={{ width: pct(right) }} /><i data-k="w" style={{ width: pct(wrong) }} /><i data-k="b" style={{ width: pct(blank) }} />
      </div>
      <p className="tpp__key" aria-hidden="true"><span><i data-k="r" />{right} right</span><span><i data-k="w" />{wrong} wrong</span><span><i data-k="b" />{blank} blank</span><span>of {n}</span></p>
      <div className="tpp__leak">
        {l.status === 'ready' && l.value ? (
          <p>Biggest leak: <b>{l.value.chapter}</b>, {l.value.here} of your {l.value.misses} {l.value.misses === 1 ? 'miss' : 'misses'} ({l.value.wrong} wrong, {l.value.blank} blank).</p>
        ) : l.status === 'ready' ? (
          <p>{misses ? `${misses} ${misses === 1 ? 'miss' : 'misses'} on this paper, each explained in the result.` : 'No misses on this paper.'}</p>
        ) : l.status === 'error' ? (
          <p>{misses} {misses === 1 ? 'miss' : 'misses'} on this paper. The result shows each one.</p>
        ) : <span className="tpp__skl tpp__skl--s" aria-hidden="true" />}
      </div>
      <div className="tpp__acts">
        {misses > 0 ? <Link className="tm__pill" href={repairHref}><Wrench size={16} strokeWidth={1.75} aria-hidden="true" />{l.value ? 'Repair this leak' : 'Repair a mistake'}</Link> : null}
        <Link className="tm__inline" href={`/result/${encodeURIComponent(last.id)}`}>Open the result</Link>
      </div>
    </section>
  );
}
