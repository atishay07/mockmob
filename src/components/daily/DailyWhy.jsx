"use client";
import { RotateCcw, Sparkles, Target } from 'lucide-react';
import { mineLabel } from '@/lib/dailyFiveMine.mjs';
import './daily-mine.css';

// Why this question is in the student's own five (owner LK365, 21 Nov 2026; spec tmp/1121-stories/DAILY-SPEC.md, "The page"):
// a small label above the stem, in the words of src/lib/dailyFiveMine.mjs mineLabel ("You missed this on 14 Nov", "Your weak
// chapter: Accounting Ratios", "New from Economics"). One line on a phone for most chapters; a long chapter wraps, and the
// question it belongs to arrives with it, so nothing under it moves on its own. It eases in with its question (opacity and a
// 6 px rise, 220 ms; none under reduced motion).
const ICONS = { missed: RotateCcw, weak: Target, subject: Sparkles };

export default function DailyWhy({ why }) {
  const text = mineLabel(why);
  if (!text) return null;
  const Glyph = ICONS[why.kind] || Sparkles;
  return (
    <p className="dly-why" data-kind={why.kind}>
      <Glyph className="dly-why__icon" size={16} strokeWidth={2.4} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
