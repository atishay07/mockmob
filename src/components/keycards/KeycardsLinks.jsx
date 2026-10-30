"use client";
// The ways into Key cards (KEYCARDS-BUILD-SPEC.md section 3, Entry points). No new top-level tab:
//   LearnKeycardsRow     a row in the Learn hub, in the hub's own row style: "Key cards", what they are, what is due
//   ChapterKeycardsLink  beside "Learn the idea first" on a Review chapter: that chapter's deck, when it has cards
// Both read the shared GET /api/keycards body (one read per page) and hide while it loads, when Key cards are off, when
// the read fails, and when the chapter has no cards: an entry point never leads to an empty or broken page.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useKeycardsHome } from './api';
import { findChapter, plural } from './kinds';
import { useCardsLinks } from './links';

export function LearnKeycardsRow() {
  const read = useKeycardsHome();
  const links = useCardsLinks();
  if (read.state !== 'ready') return null;
  const due = Number(read.data?.today?.due) || 0;
  return (
    <Link className="cx-row" href={links.home()}>
      <b>Key cards</b>
      <span>{due ? `NCERT's exact lines, chapter by chapter. ${plural(due, 'card')} due today.` : "NCERT's exact lines, chapter by chapter, each with its page."}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function ChapterKeycardsLink({ subject, chapter }) {
  const read = useKeycardsHome();
  const links = useCardsLinks();
  if (read.state !== 'ready') return null;
  const row = findChapter(read.data, subject, chapter);
  if (!row || !(Number(row.cards) > 0)) return null;
  const isPro = read.data?.isPro === true;
  const open = isPro ? row.cards : Math.min(Number(row.unlocked) || 0, row.cards);
  return (
    <Link className="rvw-lesson" href={links.deck(row.key)}>
      <u>Key cards for this chapter</u>
      <small>{isPro ? plural(row.cards, 'card') : `${open} of ${row.cards} open`} in NCERT&apos;s words{row.due ? `, ${row.due} due` : ''}</small>
    </Link>
  );
}
