"use client";
// The rule for this mock on MockMob's own session card, before the clock starts (spec tmp/mistake-lab-v4/SPEC.md 4.12):
// "Your rule for this mock: open every question once before you go deep on any." and "Last mock: 6 questions never
// opened." Both sentences come finished from GET /api/me/playbook (data/rule_book.js startSheetLines). Shown only for a
// Full mock or NTA mode, on this page, before Start: nothing is added inside the timed paper, and the NTA screen itself
// is untouched. A failed read shows nothing; the session starts exactly as before.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Target } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import { MOCK_MODES } from '@/components/result/labLoop';
import './start-rule.css';

/** { rule, last } for the subject about to start, once read; null for other modes, before the read, or without a rule. */
export function useStartRule(subject, modeId) {
  const [sheets, setSheets] = useState({});
  const asked = useRef(new Set());
  const wanted = Boolean(subject) && MOCK_MODES.includes(modeId);
  useEffect(() => {
    if (!wanted || asked.current.has(subject)) return;
    asked.current.add(subject);
    apiGet(`/api/me/playbook?${new URLSearchParams({ subject })}`)
      .then((d) => setSheets((s) => ({ ...s, [subject]: d?.startSheet?.rule ? d.startSheet : null })))
      .catch(() => { asked.current.delete(subject); setSheets((s) => ({ ...s, [subject]: null })); });
  }, [wanted, subject]);
  return wanted ? sheets[subject] ?? null : null;
}

/** The rule on the session card: the rule, the last mock's count and a way to change it. */
export default function StartRule({ sheet }) {
  if (!sheet?.rule) return null;
  return (
    <div className="pr-rule">
      <span className="pr-rule__icon" aria-hidden="true"><Target size={18} strokeWidth={2.2} /></span>
      <div className="pr-rule__text">
        <p className="pr-rule__line">{sheet.rule}</p>
        {sheet.last ? <p className="pr-rule__last">{sheet.last}</p> : null}
        <Link className="pr-rule__change" href="/review/rules">Change rule</Link>
      </div>
    </div>
  );
}
