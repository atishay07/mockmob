"use client";

// The You page's places (owner LK141, 5 Nov 2026): on a phone the dock's You opens the You page, as every other dock slot opens its
// place's page, and the top bar's person opens the account sheet. What the old You sheet listed lives here now, at the top of the
// page, under its heading: Ask Mobi first (with his face, LK143), then Your progress, Your plan, and Guide with Show me around.
// Moved, never removed: every row keeps its link and route. From 1024 px the sidebar lists the same pages under You, so this block
// is not drawn there (you-places.css). The shell owns the lists and the links (it knows the preview's addresses and opens the tour),
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

export default function YouPlaces() {
  const shell = useContext(YouPlacesContext);
  if (!shell) return null;
  const { groups, hrefOf, isActive, mentorHref, onTour } = shell;
  let i = 0;
  const row = (tab) => (
    <Link key={tab.id} href={hrefOf(tab)} className="you-places__row" style={{ '--i': i++ }} aria-current={isActive(tab.id) ? 'page' : undefined} data-tour={`you-${tab.id}`}>
      <AppIcon name={tab.icon} />
      <span>{tab.label}</span>
    </Link>
  );
  return (
    <nav className="you-places" aria-label="Your places">
      <Link href={mentorHref} className="you-places__ask" data-tour="nav-mentor-you">
        <Image className="you-places__face" src={MOBI_FACE.src} width={30} height={41} sizes="30px" alt="" />
        <span className="you-places__ask-text"><b>Ask Mobi</b><span>{ASK_MOBI_NOTE}</span></span>
        <ChevronRight className="you-places__go" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
      {groups.map((group) => (
        <div key={group.id} className="you-places__group" role="group" aria-labelledby={`you-places-${group.id}`}>
          <p className="you-places__label" id={`you-places-${group.id}`}>{group.label}</p>
          <div className="you-places__rows">{group.items.map(row)}</div>
        </div>
      ))}
      <div className="you-places__group" role="group" aria-labelledby="you-places-help">
        <p className="you-places__label" id="you-places-help">Help</p>
        <div className="you-places__rows">
          {row({ id: 'help', label: HELP_DOOR.label, icon: 'help' })}
          <button type="button" className="you-places__row" style={{ '--i': i++ }} onClick={onTour}>
            <AppIcon name="guide" />
            <span>{TOUR_LABEL}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
