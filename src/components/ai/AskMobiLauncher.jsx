"use client";

// Ask Mobi's chat box at rest (20 Nov 2026, owner on a big screen: "this entire chatbot could just be, on the bottom, an opaque or
// glass-morphism kind of small chat box, which can then be expanded into a full page or window"). It replaced the 19 Nov round key,
// whose panel docked beside the page and narrowed it.
//
// A glass bar fixed at the bottom right of the signed-in shell, on a mouse window 1100 px or wider only (LAUNCHER_MEDIA; mobi-launch.css
// draws nothing anywhere else): Mobi's face, "Ask Mobi anything" in the muted text colour, and a small arrow-up mark. It looks like
// a field but is one button (its name is "Ask Mobi"): pressing it opens the floating window from the bar's own place, about the page
// the student is on (launcherContext). No badge, no pulse, never opens by itself.
//
// It steps away while the window is open (the window's own Close key closes it, and focus comes back here), on the paper, a Mob game,
// onboarding and /mentor (launcherBlockedOn), and while another dialog or sheet is on screen. That last one is ONE attribute on the
// shell, data-layer-open, written from here when a dialog opens or closes (a MutationObserver that looks only at what was added,
// and reads again only while one is open), never a :has() on the shell or the body.
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import mascot from '@/../public/brand/mascot/manifest.json';
import { LAYER_SELECTOR, closeAskMobi, isOtherLayer, launcherBlockedOn, launcherContext, openAskMobi } from './askMobi.mjs';
import { useAskMobiState } from './askMobiStore';
import './mobi-launch.css';

const FACE = mascot.greeting;
// The pages' sticky right-hand columns that carry keys down to the bottom of the screen (found by the corner sweep, 20 Nov 2026).
const STICKY_SIDES = '.pr-ticket, .rv8-side';
const BAR_EDGE = 24;
// The window the bar opens (mobi-launch.css .amb-panel--window): 400 px wide, min(640 px, 100vh - 120 px) tall, 20 px from the
// bottom. The bar and the window share one place, so the column is kept clear of the window, the larger of the two.
const WINDOW_WIDTH = 400;
const windowBand = () => Math.min(640, window.innerHeight - 120) + 20 + 16;
const anyLayer = () => [...document.querySelectorAll(LAYER_SELECTOR)].some(isOtherLayer);
const holdsLayer = (node) => node.nodeType === 1 && (isOtherLayer(node) || [...(node.querySelectorAll?.(LAYER_SELECTOR) || [])].some(isOtherLayer));

export default function AskMobiLauncher({ path = '' }) {
  const mobi = useAskMobiState();
  const self = useRef(null);
  const blocked = launcherBlockedOn(path);
  const covered = mobi.open;

  // Leaving for a route where Ask Mobi is never drawn (the paper, a Mob game, its own page) closes the window.
  useEffect(() => { if (blocked && covered) closeAskMobi(); }, [blocked, covered]);

  // Another dialog or sheet on screen: one attribute on the shell, so the bar steps away under it.
  useEffect(() => {
    const shell = self.current?.closest('.app-shell');
    if (!shell || typeof MutationObserver !== 'function') return undefined;
    let on = anyLayer();
    shell.toggleAttribute('data-layer-open', on);
    const observer = new MutationObserver((records) => {
      let look = false;
      for (const record of records) {
        if (record.type === 'attributes') look = true;
        else if (on) look = record.removedNodes.length > 0 || look;
        else for (const node of record.addedNodes) if (holdsLayer(node)) { look = true; break; }
        if (look) break;
      }
      if (!look) return;
      const next = anyLayer();
      if (next !== on) { on = next; shell.toggleAttribute('data-layer-open', on); }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal', 'hidden'] });
    return () => { observer.disconnect(); shell.removeAttribute('data-layer-open'); };
  }, [blocked]);

  // Its place. A page with a sticky column at the right that reaches down into the window's band (Practice's session card and its
  // Start key, Review's side column) keeps it clear: the bar, and the window it opens, sit to that column's left. The band is the
  // window's, not the bar's: on a tall screen the card ends above the bar but the 640 px window still covered it (21 Nov 2026, at
  // 2560 x 1440). Read once per layout change (a ResizeObserver on the page and the window), never per scroll; written as one
  // variable on the shell, with the shell's data-mobi-bar, which keeps the end of every page clear of the bar (mobi-launch.css).
  useEffect(() => {
    const shell = self.current?.closest('.app-shell');
    const main = shell?.querySelector('.app-main');
    if (!shell || !main) return undefined;
    shell.setAttribute('data-mobi-bar', '');
    let frame = 0;
    const place = () => {
      frame = 0;
      const vw = document.documentElement.clientWidth;
      const column = [...main.querySelectorAll(STICKY_SIDES)].find((el) => el.getClientRects().length);
      const r = column?.getBoundingClientRect();
      // It reaches the window's band at the foot of the screen, where it rests in the page or where it sticks.
      const stuck = r ? (parseFloat(getComputedStyle(column).top) || 0) + r.height : 0;
      const low = r && Math.max(r.bottom, stuck) > window.innerHeight - windowBand();
      const right = low && r.right > vw - BAR_EDGE - WINDOW_WIDTH && r.left > WINDOW_WIDTH + 2 * BAR_EDGE ? Math.round(vw - r.left + 16) : null;
      if (right === null) shell.style.removeProperty('--mobi-bar-right'); else shell.style.setProperty('--mobi-bar-right', `${right}px`);
    };
    place();
    if (typeof ResizeObserver !== 'function') return () => { shell.removeAttribute('data-mobi-bar'); shell.style.removeProperty('--mobi-bar-right'); };
    const observer = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(place); });
    observer.observe(main);
    observer.observe(document.documentElement);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); shell.removeAttribute('data-mobi-bar'); shell.style.removeProperty('--mobi-bar-right'); };
  }, [blocked, path]);

  // The window gives focus back to its opener as it closes, while this bar is still stepped away; so when the bar comes back from a
  // window it opened, and focus was left on nothing, it takes focus itself.
  const coveredBefore = useRef(false);
  const mine = useRef(false);
  useEffect(() => {
    if (covered) { coveredBefore.current = true; mine.current = mobi.launcher; return undefined; }
    if (!coveredBefore.current) return undefined;
    coveredBefore.current = false;
    if (!mine.current) return undefined;
    mine.current = false;
    let frame = 0;
    let tries = 0;
    const settle = () => {
      const now = document.activeElement;
      // Focus left in the window as it fades out counts as nothing: the window is going.
      if (now && now !== document.body && !now.closest?.('.amb-layer, .amb-panel')) return;
      if (self.current?.getClientRects().length) { self.current.focus({ preventScroll: true }); return; }
      if ((tries += 1) < 60) frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [covered, mobi.launcher]);

  if (blocked) return null;
  const onPress = (event) => {
    const bar = event.currentTarget;
    // Safari does not focus a pressed button: focus it, so the window gives focus back here when it closes.
    bar.focus({ preventScroll: true });
    openAskMobi({ context: launcherContext(path), from: bar, launcher: true });
  };
  return (
    <button ref={self} type="button" className="mobi-launch" aria-label="Ask Mobi" aria-haspopup="dialog" hidden={covered || undefined} onClick={onPress}>
      <Image className="mobi-launch__face" src={FACE.src} width={22} height={30} sizes="22px" alt="" />
      <span className="mobi-launch__words" aria-hidden="true">Ask Mobi anything</span>
      <span className="mobi-launch__go" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" focusable="false"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </span>
    </button>
  );
}
