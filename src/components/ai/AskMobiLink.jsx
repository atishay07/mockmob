"use client";

// The one way a screen offers Ask Mobi (ASK-MOBI-1018, section 3): a quiet text button, or a list row, that opens the panel
// already about what the student is looking at. It is a real link, so where no panel is mounted, or on a modifier-click or
// a middle-click, it goes to /mentor as before. It never adds a card or a box to its page.
import Link from 'next/link';
import { isPlainClick, openAskMobi } from './askMobi.mjs';
import { fallbackHref } from './askContexts.mjs';
import './ask-entry.css';

export default function AskMobiLink({ context, children, variant = 'text', className = '', onOpen = null, ...rest }) {
  return (
    <Link
      href={fallbackHref(context)}
      className={`ame ame--${variant}${className ? ` ${className}` : ''}`}
      data-ask-mobi={context?.kind || 'page'}
      onClick={(event) => {
        if (isPlainClick(event) && openAskMobi({ context, from: event.currentTarget })) { event.preventDefault(); onOpen?.(); }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
