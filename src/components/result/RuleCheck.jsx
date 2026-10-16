"use client";
// The rule check in the Lab's Prove step (spec tmp/mistake-lab-v4/SPEC.md 4.8): the rule the student chose before this
// mock started, checked on this mock's own record, with the timed mock before it in brackets. Arithmetic only: the
// sentence comes finished from the server (data/rule_book.js buildRuleCheck, contract_rulecheck_v1.json) and never says
// what the rule gained. States: kept, not_kept, counted (a repair rule, on its chapter), not_checked.
//
// Beside the sentence, two thin bars show the same two counts (this mock, last mock) out of their own totals, so the
// comparison reads at a glance. They are drawn only from the server's numbers and are hidden from screen readers,
// which read the sentence. The bars grow once when the step comes into view (240 ms); reduced motion shows them at once.
//
// A rule kept is a real moment: when the check comes into view Mobi takes the icon's place and is proud once (not kept:
// one lean of encouragement), lib/mobiScreens.js ruleCheckAct. Only when no other Mobi is in view (the result's hero
// wins); otherwise the icon stays. Counted and not checked keep the icon.
import { CircleCheck, CircleDashed, CircleSlash, ListChecks } from 'lucide-react';
import MomentMobi from '@/components/brand/MomentMobi';
import { ruleCheckAct } from '@/lib/mobiScreens';
import { withNumbers } from './MarksLedger';
import './lab-loop.css';

const ICON = { kept: CircleCheck, not_kept: CircleSlash, counted: ListChecks, not_checked: CircleDashed };
const share = (n, total) => (Number.isFinite(n) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, n / total)) : null);

function Bars({ check }) {
  const n = check.numbers;
  if (!n || check.state === 'not_checked') return null;
  const now = share(n.now, n.total);
  const last = share(n.last, n.lastTotal);
  if (now === null) return null;
  // A habit's numbers count the times it was not kept; a repair rule's count right answers in its chapter.
  const tone = check.state === 'counted' ? 'right' : 'miss';
  const rows = [{ id: 'now', label: 'This mock', k: n.now, of: n.total, p: now }];
  if (last !== null) rows.push({ id: 'last', label: 'Last mock', k: n.last, of: n.lastTotal, p: last });
  return (
    <div className="rc-bars" data-tone={tone} aria-hidden="true">
      {rows.map((r) => (
        <div key={r.id} className="rc-bar" data-row={r.id}>
          <span className="rc-bar__label">{r.label}</span>
          <span className="rc-bar__track"><i style={{ '--p': r.p }} /></span>
          <span className="rc-bar__num">{r.k} of {r.of}</span>
        </div>
      ))}
    </div>
  );
}

/** RuleCheck({ check }): lab.prove.ruleCheck, or nothing when no rule was in force (null) or the part failed. */
export default function RuleCheck({ check }) {
  if (!check || typeof check.state !== 'string' || !check.line) return null;
  const Icon = ICON[check.state] || CircleDashed;
  const icon = <span className="rc-icon" aria-hidden="true"><Icon size={20} strokeWidth={2.1} /></span>;
  const act = ruleCheckAct(check.state);
  return (
    <div className="rc" data-state={check.state}>
      {act ? <MomentMobi act={act} size={52} alone fallback={icon} className="rc-mobi" /> : icon}
      <div className="rc-main">
        <p className="rc-rule">{check.line}</p>
        {check.result ? <p className="rc-result">{check.state === 'not_checked' ? check.result : withNumbers(check.result)}</p> : null}
        <Bars check={check} />
        {check.fine ? <p className="rc-fine">{check.fine}</p> : null}
      </div>
    </div>
  );
}
