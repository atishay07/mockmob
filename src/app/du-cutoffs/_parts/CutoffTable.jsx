'use client';
// The cutoff table on a DU course or college page. One category at a time, picked with the calculator's own controls
// (the five main categories as a segmented control, the six quotas in a list) and remembered on this device. On a
// phone each row stacks: the name on its own line, the three rounds under it, each with its label, so nothing scrolls
// sideways at 360 px; from 720 px it is a plain four-column table. Scores print exactly as DU printed them.
import Link from 'next/link';
import { useId, useState } from 'react';
import { Listbox } from '@/components/ui/controls/Listbox';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { CATEGORY_LABELS, MAIN_CATEGORIES, OTHER_CATEGORIES } from '@/lib/du/eligibility';
import { CUTOFF_CATEGORIES, CUTOFF_ROUNDS, cellFor, hasAnyScore, orderRows } from '@/lib/du/cutoffPages.mjs';
import { useDuCategory } from '@/lib/du/cutoffCategory';

const ORDERS = [
  { value: 'name', label: 'A to Z' },
  { value: 'high', label: 'Highest round 1' },
];
const OTHER_OPTIONS = OTHER_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

function Score({ value }) {
  if (value === null) {
    return (
      <>
        <span className="dc-none" aria-hidden="true">–</span>
        <span className="dc-sr">No score</span>
      </>
    );
  }
  return <span className="dc-num">{value}</span>;
}

function Rows({ rows, ci, order, firstColumn, caption }) {
  return (
    <table className="dc-table">
      <caption className="dc-sr">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{firstColumn}</th>
          {CUTOFF_ROUNDS.map((r) => <th key={r} scope="col">Round {r}</th>)}
        </tr>
      </thead>
      <tbody>
        {orderRows(rows, ci, order).map((row) => {
          const cells = CUTOFF_ROUNDS.map((r) => cellFor(row.rounds, ci, r));
          return (
            <tr key={row.key} data-empty={cells.every((v) => v === null) || undefined}>
              <th scope="row">
                {row.href ? <Link href={row.href} className="dc-table__name">{row.title}</Link> : <span className="dc-table__name">{row.title}</span>}
                {row.sub ? <span className="dc-table__sub">DU lists it as {row.sub}</span> : null}
              </th>
              {cells.map((v, i) => (
                <td key={CUTOFF_ROUNDS[i]} data-label={`Round ${CUTOFF_ROUNDS[i]}`}><Score value={v} /></td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * sections: [{ key, heading, href, linkLabel, open, rows: [{ key, title, href, sub, rounds }] }] (cutoffPages.mjs).
 * A section with a heading is a disclosure (B.A. (Programme)'s subject pairs), with a link (href, linkLabel) under its
 * table. subject: what the scores are for, in the empty line ("B.Com. (Hons.)", "Hindu College"). firstColumn:
 * "College" or "Course".
 */
export function CutoffTable({ sections, subject, firstColumn }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [category, setCategory] = useDuCategory();
  const [order, setOrder] = useState('name');
  const ci = CUTOFF_CATEGORIES.indexOf(category);
  const label = CATEGORY_LABELS[category];
  const any = hasAnyScore(sections, ci);
  const sortable = sections.some((s) => s.rows.length >= 6);

  return (
    <div className="dc-board">
      <div className="dc-controls">
        <div className="dc-field">
          <span className="dc-label" id={`${id}-cat`}>Category</span>
          <SegmentedControl labelledBy={`${id}-cat`} wrap value={category} onChange={setCategory} options={MAIN_CATEGORIES} />
          <div className="dc-quota">
            <span className="dc-sr" id={`${id}-quota`}>Other quota</span>
            <Listbox labelledBy={`${id}-quota`} sheetTitle="Other quota" size="sm" active={OTHER_CATEGORIES.includes(category)}
              placeholder="Other quota (Sikh, PwBD, KM, SGC, orphan)"
              value={OTHER_CATEGORIES.includes(category) ? category : ''}
              options={OTHER_OPTIONS}
              onChange={(value) => value && setCategory(value)} />
          </div>
        </div>
        {sortable && any ? (
          <div className="dc-field">
            <span className="dc-label" id={`${id}-order`}>Order</span>
            <SegmentedControl labelledBy={`${id}-order`} value={order} onChange={setOrder} options={ORDERS} />
          </div>
        ) : null}
      </div>

      <div className="dc-legend" aria-live="polite">
        <p>
          <strong>{label}</strong> scores, as DU printed them. A dash means DU printed none for that round.
        </p>
        {category !== 'UR' ? (
          <p>DU’s unreserved (UR) list includes every student, so you can also get a seat at the UR score.</p>
        ) : null}
      </div>

      {!any ? (
        <p className="dc-empty">DU printed no {label} score for {subject} in any 2026 round. Pick another category to see its scores.</p>
      ) : (
        sections.map((section) =>
          section.heading ? (
            <details key={section.key} className="dc-group" open={section.open || undefined}>
              <summary>
                <span className="dc-group__name">{section.heading}</span>
                <span className="dc-group__count">{section.rows.length} subject {section.rows.length === 1 ? 'pair' : 'pairs'}</span>
              </summary>
              <div className="dc-group__body">
                <Rows rows={section.rows} ci={ci} order={order} firstColumn="Subject pair" caption={`${section.heading}, ${label}`} />
                {section.href && section.linkLabel ? <Link href={section.href} className="dc-more">{section.linkLabel}</Link> : null}
              </div>
            </details>
          ) : (
            <Rows key={section.key} rows={section.rows} ci={ci} order={order} firstColumn={firstColumn} caption={`${subject}, ${label}`} />
          ),
        )
      )}
    </div>
  );
}
