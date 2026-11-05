"use client";

// The one way a screen offers Ask Mobi (ASK-MOBI-1018, section 3): a quiet text button, or a list row, that opens the panel
// already about what the student is looking at. It is a real link, so where no panel is mounted, or on a modifier-click or
// a middle-click, it goes to /mentor as before. It never adds a card or a box to its page.
// The text line ("Ask Mobi about Q7" on a result, "Ask Mobi about this mock") carries Mobi's small face (owner LK143, 5 Nov 2026: Ask
// Mobi is a first-class door), so his doors read as his across the app: the rail's, the top bar's, Today's and these.
import Link from 'next/link';
import Image from 'next/image';
import mascot from '@/../public/brand/mascot/manifest.json';
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
      {variant === 'text' ? <Image className="ame__face" src={mascot.greeting.src} width={16} height={22} sizes="16px" alt="" /> : null}
      {children}
    </Link>
  );
}
