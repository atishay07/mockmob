"use client";
// Review's way into the Rule book (spec tmp/mistake-lab-v4/SPEC.md 4.10): "Your rules, 7" and the rule chosen for the
// next mock, from GET /api/me/rules. While it loads, or if it fails, the link still opens the Rule book.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useRuleBook } from './useRuleBook';
import './rule-book.css';

export default function RulesEntry() {
  const read = useRuleBook();
  const book = read.state === 'ready' ? read.data?.book : null;
  const detail = book?.active?.text
    ? `${book.labels?.inUse || 'Your rule for your next mock'}: ${book.active.text}`
    : 'Rules from your repairs and from how you take papers. Choose one for your next mock.';
  return (
    <Link className="rb-entry" href="/review/rules" data-state={read.state}>
      <span className="rb-entry__text">
        <b>{book?.countLabel || 'Your rules'}</b>
        <span>{detail}</span>
      </span>
      <ArrowRight className="rb-entry__go" size={18} aria-hidden="true" />
    </Link>
  );
}
