"use client";

// Ask Mobi's desktop launcher (19 Nov 2026, owner: "On desktop, we have a lot of space, so even the Ask Mobi, we can set as a
// quick-to-access chatbot on the right-hand side of the screen ... people might not notice it" on the rail).
//
// A 52 px round key with Mobi's face at the bottom right of the signed-in shell, on a mouse window 1100 px or wider only
// (LAUNCHER_MEDIA; mobi-launch.css draws nothing anywhere else). On hover or keyboard focus the words "Ask Mobi" slide out to its
// left as a pill (180 ms, the motion answers the pointer). No badge, no pulse, never opens by itself.
//
// Pressing it opens the shell's one Ask Mobi panel through openAskMobi with the page's own context (launcherContext): an overlay
// below 1680 px, docked beside the page from 1680 px (drawerForm). Pressing again, or Esc, closes it; focus goes into the panel
// and comes back here. Hidden on the paper, a Mob game, onboarding and /mentor (launcherBlockedOn), while any dialog or sheet is
// on screen (mobi-launch.css), and while the panel is open in any form: over the page, or docked beside it, where the panel's own
// close key does the closing and a second key on the page's corner would only sit over its content (orchestrator, 19 Nov 2026).
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import mascot from '@/../public/brand/mascot/manifest.json';
import { closeAskMobi, launcherBlockedOn, launcherContext, openAskMobi } from './askMobi.mjs';
import { useAskMobiState } from './askMobiStore';
import './mobi-launch.css';

const FACE = mascot.greeting;

export default function AskMobiLauncher({ path = '' }) {
  const mobi = useAskMobiState();
  const self = useRef(null);
  const docked = mobi.open && mobi.form === 'dock';
  // While the panel is open (over the page, docked beside it, or a phone's sheet) the key steps away; its form is known a frame
  // after it opens.
  const covered = mobi.open && Boolean(mobi.form);
  // The panel gives focus back to its opener as it closes, while this key is still stepped away; so when the key comes back from
  // an overlay it opened, and focus was left on nothing, it takes focus itself.
  const coveredBefore = useRef(false);
  const mine = useRef(false);
  useEffect(() => {
    if (covered) { coveredBefore.current = true; mine.current = mobi.launcher; return; }
    if (!coveredBefore.current) return;
    coveredBefore.current = false;
    if (!mine.current) return;
    mine.current = false;
    // The panel fades out first (and while it is on screen no key is drawn over it), so wait for the key to be drawn again.
    let frame = 0;
    let tries = 0;
    const settle = () => {
      const now = document.activeElement;
      // Focus left in the panel as it fades out counts as nothing: the panel is going.
      if (now && now !== document.body && !now.closest?.('.amb-layer, .amb-panel')) return;
      if (self.current?.getClientRects().length) { self.current.focus({ preventScroll: true }); return; }
      if ((tries += 1) < 60) frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [covered, mobi.launcher]);
  if (launcherBlockedOn(path)) return null;
  const onPress = (event) => {
    const key = event.currentTarget;
    if (mobi.open) { closeAskMobi(); return; }
    // Safari does not focus a pressed button: focus it, so the panel gives focus back here when it closes.
    key.focus({ preventScroll: true });
    openAskMobi({ context: launcherContext(path), from: key, launcher: true });
  };
  return (
    <button
      ref={self}
      type="button"
      className="mobi-launch"
      aria-label="Ask Mobi"
      aria-expanded={mobi.open}
      data-docked={docked || undefined}
      hidden={covered || undefined}
      onClick={onPress}
    >
      <span className="mobi-launch__words" aria-hidden="true">Ask Mobi</span>
      <span className="mobi-launch__key" aria-hidden="true">
        <Image className="mobi-launch__face" src={FACE.src} width={26} height={36} sizes="26px" alt="" />
      </span>
    </button>
  );
}
