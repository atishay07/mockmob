"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const SUBJECTS = [
  { name: 'Accountancy', slug: 'accountancy', key: 'accountancy', hint: 'Partnership, company accounts, cash flow' },
  { name: 'Economics', slug: 'economics', key: 'economics', hint: 'National income, money and banking, development' },
  { name: 'Business Studies', slug: 'business-studies', key: 'business_studies', hint: 'Management, marketing, financial markets' },
  { name: 'English', slug: 'english', key: 'english', hint: 'Reading comprehension, grammar, vocabulary' },
];

// Per-subject counts come from the live /api/stats. If the request fails the
// card simply omits the count: no invented number ever renders.
export function SubjectGrid() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stats', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.subjectCounts && setCounts(data.subjectCounts))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <ul className="lp-subjects">
      {SUBJECTS.map((subject, i) => {
        const count = counts ? counts[subject.key] || 0 : null;
        return (
          <li key={subject.slug} className="rv-item" style={{ '--i': i }}>
            <Link href={`/cuet/${subject.slug}`} className="lp-subject">
              <span className="lp-subject__name">{subject.name}</span>
              <span className="lp-subject__hint">{subject.hint}</span>
              <span className="lp-subject__count mm-measure">
                {Number.isFinite(count) && count >= 0 ? `${count.toLocaleString('en-IN')} questions` : 'Question counts unavailable'}
              </span>
              <ArrowUpRight size={18} aria-hidden="true" className="lp-subject__arrow" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
