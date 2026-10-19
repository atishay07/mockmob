"use client";
// "Your colleges" strip under Today's greeting (D126 option B, owner H9: "where is that college section now? ... there is no
// clear-cut access to it"). One tap target that opens Colleges, on the first screen of Today every day. It names the college
// on the student's list that needed the most last year with DU's real 2026 Round 1 closing mark (src/lib/colleges/cutoffs.mjs,
// the app's rule G7). A fresh account sees "Choose your colleges". The fuller "Your colleges" block lower on Today stays (R3).
// It keeps its height while loading and lands with the page (`hold`, W-042); a failed read still opens Colleges.
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { AppIcon } from '@/components/ui/Glyph';
import { useCollegeCutoffs } from '@/components/colleges/useCollegeCutoffs';
import { stripView } from '@/lib/colleges/cutoffs.mjs';

export default function TodayCollegesStrip({ userId, hold = false }) {
  const read = useCollegeCutoffs(userId);
  if (read.status === 'none') return null;
  const view = stripView({ state: hold ? 'loading' : read.status, rows: read.rows });
  if (view.kind === 'loading') {
    return <div className="tcs tcs--wait" aria-busy="true" aria-label="Loading your colleges"><span className="tcs__ico" aria-hidden="true" /><span className="tcs__skl" /></div>;
  }
  const empty = view.kind === 'empty';
  // The figure is drawn inside the sentence, in bold, so the line reads as one plain sentence.
  const words = view.figure ? view.line.split(view.figure) : null;
  return (
    <Link className="tcs" href="/admission-compass" data-kind={view.kind}>
      <span className="tcs__ico" aria-hidden="true">{empty ? <Plus size={18} strokeWidth={2.2} /> : <AppIcon name="colleges" size={18} />}</span>
      <span className="tcs__t">
        <span className="tcs__label">{view.label}</span>
        <span className="tcs__line">{words ? <>{words[0]}<b>{view.figure}</b>{words.slice(1).join(view.figure)}</> : view.line}</span>
        {view.sub ? <span className="tcs__sub">{view.sub}</span> : null}
      </span>
      <ChevronRight className="tcs__chev" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
