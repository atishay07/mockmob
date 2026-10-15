"use client";
// "Traps you meet" (spec tmp/mistake-lab-v4/SPEC.md 4.11): a disclosure reached from Find ("Your traps across mocks") and
// from the Rule book. Opened, it reads GET /api/me/traps once and lists, per named trap, "A look-alike term: caught 4 of 6
// times. Before 1 Oct: 3 of 3. Since: 1 of 3." with the small label "Falling" or "Still catching you" only where its gate
// passes (5 chances in each period and a drop of 30 points; or 4 later chances, half caught, rate not lower). Every sentence
// is finished by the server (data/trap_atlas.js buildTrapsMeet, contract_traps_v1.json `sheet`); the basis line says what a
// chance is. Each row has a thin bar of the same two numbers (caught of chances), drawn from the server's counts only. Colour
// never carries the label: the words do. Reduced motion shows the bars at once.
import { useId, useState } from 'react';
import { ChevronDown, RefreshCw, Route } from 'lucide-react';
import { useTrapsMeet } from './useTrapsMeet';
import './traps-later.css';

const share = (k, n) => (Number.isFinite(k) && Number.isFinite(n) && n > 0 ? Math.max(0, Math.min(1, k / n)) : 0);

function Row({ row }) {
  const p = row.periods;
  return (
    <li className="tm-row" data-status={row.status || undefined}>
      <div className="tm-row__head">
        <p className="tm-row__text">{row.text}</p>
        {row.statusLabel ? <span className="tm-row__status">{row.statusLabel}</span> : null}
      </div>
      <span className="tm-bar" aria-hidden="true"><i style={{ '--p': share(row.caught, row.of) }} /></span>
      {p ? <p className="tm-row__periods">{p.text}</p> : null}
    </li>
  );
}

/** TrapsMeet({ label, surface }): the disclosure. `label` overrides the button text. */
export default function TrapsMeet({ label = 'Your traps across mocks', surface = 'inset' }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const read = useTrapsMeet({ enabled: open });
  const data = read.data;
  return (
    <div className="tm" data-surface={surface} data-open={open || undefined}>
      <button type="button" className="tm-head" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
        <span className="tm-head__icon" aria-hidden="true"><Route size={19} strokeWidth={2} /></span>
        <span className="tm-head__title">{label}</span>
        <ChevronDown className="tm-head__chev" size={18} strokeWidth={2.1} aria-hidden="true" />
      </button>
      <div className="tm-body" id={panel} hidden={!open}>
        {read.state === 'loading' || read.state === 'idle' ? <p className="tm-muted" role="status">Reading your answers…</p> : null}
        {read.state === 'error' ? (
          <div className="tm-fail" role="alert">
            <p>{read.message}</p>
            <button type="button" className="tm-retry" onClick={read.retry}><RefreshCw size={16} strokeWidth={2.1} aria-hidden="true" />Try again</button>
          </div>
        ) : null}
        {read.state === 'ready' && data.state === 'empty' ? <p className="tm-muted">{data.message}</p> : null}
        {read.state === 'ready' && data.state === 'ready' ? <ul className="tm-rows">{data.rows.map((r) => <Row key={r.trapType} row={r} />)}</ul> : null}
        {read.state === 'ready' ? (
          <>
            {data.basis ? <p className="tm-fine">{data.basis}</p> : null}
            {data.fine ? <p className="tm-fine">{data.fine}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
