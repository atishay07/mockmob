"use client";

// "Finish your sheet": shown only while a part of the sheet the site can keep is missing (see sheetGaps in
// todayModel.mjs). A quiet row with an outlined key, never a second filled button: the hero owns the page's
// one primary action. The words are the app's (features/you/copy.dart).
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import './today.css';

export default function FinishSheetCard({ gaps = null }) {
  if (!gaps) return null;
  return (
    <section className="fs" aria-label="Your sheet">
      <span className="fs__icon" aria-hidden="true"><ClipboardList size={18} /></span>
      <p className="fs__line">{gaps.line}</p>
      <Link className="tm__alt fs__key" href={gaps.href}>{gaps.label}</Link>
    </section>
  );
}
