"use client";

// The You page's places (owner LK141, 5 Nov 2026): on a phone the dock's You opens the You page, as every other dock slot opens its
// place's page, and the top bar's person opens the account sheet. What the old You sheet listed lives here now, at the top of the
// page, under its heading: Ask Mobi first (with his face, LK143), then Your progress, Your plan, and Guide with Show me around.
// Moved, never removed: every row keeps its link and route. Since 19 Nov 2026 it is drawn at every width, beside the account card
// from 1024 px (you-places.css, profile you-anchor.css). The shell owns the lists and the links (it knows the preview's addresses and opens the tour),
// so it hands them down through this context; a page outside the shell draws nothing.
import { createContext, useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import mascot from '@/../public/brand/mascot/manifest.json';
import { AppIcon } from '@/components/ui/Glyph';
import { HELP_DOOR, TOUR_LABEL } from '@/lib/helpDoor.mjs';
import './you-places.css';

const YouPlacesContext = createContext(null);
export const YouPlacesProvider = YouPlacesContext.Provider;
/** Ask Mobi's address as the shell draws it (the development preview has its own), for a page's own door to him. */
export function useMentorHref() {
  return useContext(YouPlacesContext)?.mentorHref || '/mentor';
}

const MOBI_FACE = mascot.greeting;
/** The one line under "Ask Mobi", the same on every door (release 11 walk: one door, one tagline). */
export const ASK_MOBI_NOTE = 'He explains any answer.';

// 19 Nov 2026 (lane arena-b): one list of 56 px rows under the account card, at every width (the groups' small labels are gone: the
// rows say what they are), each with its icon and, where the page already reads it, its one live figure (`figures`, keyed by the
// place's id: Colleges' "35 of 73 open", youModel.mjs placeFigures). The order is the groups' order, then Guide and Show me around.
export default function YouPlaces({ figures = {} }) {
  const shell = useContext(YouPlacesContext);
  if (!shell) return null;
  const { groups, hrefOf, isActive, mentorHref, onTour } = shell;
  let i = 0;
  const row = (tab) => (
    <Link key={tab.id} href={hrefOf(tab)} className="you-places__row" style={{ '--i': i++ }} aria-current={isActive(tab.id) ? 'page' : undefined} data-tour={`you-${tab.id}`}>
      <span className="you-places__glyph" aria-hidden="true"><AppIcon name={tab.icon} /></span>
      <span className="you-places__name">{tab.label}</span>
      {figures[tab.id] ? <span className="you-places__fig">{figures[tab.id]}</span> : null}
      <ChevronRight className="you-places__chev" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
  return (
    <nav className="you-places" aria-label="Your places">
      <Link href={mentorHref} className="you-places__ask" data-tour="nav-mentor-you">
        <Image className="you-places__face" src={MOBI_FACE.src} width={30} height={41} sizes="30px" alt="" />
        <span className="you-places__ask-text"><b>Ask Mobi</b><span>{ASK_MOBI_NOTE}</span></span>
        <ChevronRight className="you-places__go" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
      <div className="you-places__rows">
        {groups.map((group) => group.items.map(row))}
        {row({ id: 'help', label: HELP_DOOR.label, icon: 'help' })}
        <button type="button" className="you-places__row" style={{ '--i': i++ }} onClick={onTour}>
          <span className="you-places__glyph" aria-hidden="true"><AppIcon name="guide" /></span>
          <span className="you-places__name">{TOUR_LABEL}</span>
          <ChevronRight className="you-places__chev" size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
