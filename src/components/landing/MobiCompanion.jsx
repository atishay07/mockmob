'use client';
// Round 14 (13 Nov 2026): Mobi as the phone scroll companion. One small Mobi stands on the right, on the top edge of
// whatever bar is at the foot of the screen (the dock when it is up, else 14 px above the edge), travels the page with a
// phone reader and is the way into Ask Mobi (the window event mm:ask-mobi, AskMobiSheet). He answers the scroll from the
// page's one shared read (scrollBus.mjs): a lean of up to 5 degrees from his feet, a small stretch on a flick, and the
// section across 55 % of the screen picks his pose (companionModel.mjs). He steps out whenever another Mobi is on screen
// (a seat, the desk's Mobi, a held story's bar), on the hero's first screen, over the footer and while the Ask sheet is
// open, so only one Mobi is ever in view (W-074). Phones only; nothing renders on wider windows (the desktop guide).
// Every per-frame write is a CSS variable on his own element; React renders only when his pose changes.
import { useEffect, useRef, useState } from 'react';
import { Mascot } from '@/components/brand/Mascot';
import * as scrollBus from '@/components/landing/scrollBus.mjs';
import { COMPANION, sectionKey, poseForSection, velocity, lean, poseDecision, wantShown, floorLift, isTappable, bubbleGone } from './companionModel.mjs';

const HELLO = 'Ask me anything about CUET.';
const ARRIVE_MS = 560;
const BUBBLE_DELAY_MS = 300;
const CROSSFADE_MS = 160;

// He only draws where the page's pose sprite is (Mascot's vector finish) and never under the static opt-out.
function canDraw() {
  const root = document.documentElement;
  return !root.hasAttribute('data-pip-static') && Boolean(document.getElementById('mbp-idle'));
}

// What is directly under a point, past his own parts: a control a reader taps?
function controlAt(x, y, self) {
  const stack = document.elementsFromPoint(x, y);
  const under = stack.find((el) => !self.contains(el));
  for (let el = under, depth = 0; el && el !== document.body && depth < 8; el = el.parentElement, depth += 1) {
    if (isTappable({ tag: el.tagName, role: el.getAttribute('role') || '' })) return true;
  }
  return false;
}

export default function MobiCompanion() {
  const [on, setOn] = useState(false);
  const [pose, setPose] = useState({ cur: 'idle', prev: null, n: 0 });
  const box = useRef(null);
  const leanRef = useRef(null);
  const hopRef = useRef(null);
  const bubbleRef = useRef(null);
  const api = useRef({ tapped: () => {} });

  // Phones only, with the sprite drawn and no static opt-out.
  useEffect(() => {
    const narrow = matchMedia('(max-width: 899px)');
    const check = () => setOn(narrow.matches && canDraw());
    check();
    narrow.addEventListener('change', check);
    const attrs = new MutationObserver(check);
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-pip-static'] });
    return () => { narrow.removeEventListener('change', check); attrs.disconnect(); };
  }, []);

  // The previous pose's layer leaves once the crossfade is over.
  useEffect(() => {
    if (!pose.prev) return undefined;
    const n = pose.n;
    const t = setTimeout(() => setPose((p) => (p.n === n ? { ...p, prev: null } : p)), CROSSFADE_MS + 40);
    return () => clearTimeout(t);
  }, [pose.n, pose.prev]);

  useEffect(() => {
    const node = box.current;
    const leanEl = leanRef.current;
    const hopEl = hopRef.current;
    const bubbleEl = bubbleRef.current;
    if (!on || !node || !leanEl || !hopEl || !bubbleEl) return undefined;
    const root = document.documentElement;
    const page = node.closest('.mm.lp') || document.body;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const still = () => reduce.matches || root.dataset.motion === 'reduced';
    const gate = document.querySelector('.lp-dockgate');
    const dock = gate?.querySelector('.mm-dock') || null;
    const first = scrollBus.read();
    const s = {
      shown: false, others: new Set(), barOn: false, askOpen: root.dataset.askMobi === 'open', footer: false,
      y: first.y || window.scrollY, vh: first.vh || window.innerHeight, lastT: 0, speed: 0, resting: true,
      section: '', pose: 'idle', poseAt: -Infinity, lift: 0, inset: 0, tuck: false, tuckPx: 0, hopN: 0, deg: 0, stretch: 1, rest: true,
      bubble: 'never', bubbleAt: 0, bubbleY: 0,
    };
    const timers = { settle: 0, rest: 0, pose: 0, bubbleIn: 0, bubbleOut: 0, tuck: 0 };
    const hop = (kind) => { if (still()) return; s.hopN += 1; hopEl.dataset.hop = `${kind}-${s.hopN % 2}`; };

    // ---- where his feet stand: on the dock's top edge when it is up, else his own gap (CSS) ----
    const docked = () => Boolean(dock && gate.dataset.shown === 'true' && dock.dataset.hidden !== 'true'
      && page.dataset.closeIn !== 'true' && !page.querySelector('.ss[data-live="true"]') && !document.getElementById('mm-nav-sheet'));
    const restBottom = () => parseFloat(getComputedStyle(node).bottom) || COMPANION.gapPx;
    // The dock floats as a card (inset from the edges), so its edge is read from layout (offsetTop and offsetLeft of a
    // fixed box are relative to the window and ignore its rise transform): his feet on its top edge, 16 px in from its right end.
    const place = () => {
      const on = docked();
      const gap = restBottom();
      const lift = floorLift({ docked: on, dockHeight: on ? window.innerHeight - dock.offsetTop : 0, restBottom: gap });
      const inset = on ? Math.max(0, Math.round(window.innerWidth - (dock.offsetLeft + dock.offsetWidth))) : 0;
      // Tucked: on a bar he ducks behind its edge; with no bar he ducks to the screen's foot. Only his head shows.
      const tuck = s.tuck ? COMPANION.heightPx - COMPANION.headPx + (lift ? 0 : gap) : 0;
      if (lift === s.lift && inset === s.inset && tuck === s.tuckPx) return false;
      s.lift = lift; s.inset = inset; s.tuckPx = tuck;
      node.style.setProperty('--mc-lift', `${lift}px`);
      node.style.setProperty('--mc-inset', `${inset}px`);
      node.style.setProperty('--mc-tuck', `${tuck}px`);
      return true;
    };

    // ---- never over a control: when he settles, look under his (untucked) box; a control there tucks him down ----
    const tuckCheck = () => {
      clearTimeout(timers.tuck); timers.tuck = 0;
      if (!s.shown) return;
      const right = window.innerWidth - COMPANION.insetPx - s.inset;
      const bottom = window.innerHeight - restBottom() - s.lift;
      const xs = [right - 42, right - 24, right - 6];
      const ys = [bottom - COMPANION.heightPx + 8, bottom - 30, bottom - 6];
      const hit = xs.some((x) => ys.some((y) => controlAt(x, y, node)));
      if (hit === s.tuck) return;
      s.tuck = hit;
      if (hit) node.dataset.tuck = 'true'; else delete node.dataset.tuck;
      place();
    };

    // ---- the hello, once a browser session ----
    const hideBubble = () => {
      clearTimeout(timers.bubbleIn); clearTimeout(timers.bubbleOut);
      if (s.bubble === 'on') { s.bubble = 'done'; delete bubbleEl.dataset.on; } else if (s.bubble === 'due') s.bubble = 'never';
    };
    const hello = () => {
      if (s.bubble !== 'never') return;
      let seen = false;
      try { seen = sessionStorage.getItem(COMPANION.bubbleKey) === '1'; } catch { seen = false; }
      if (seen) { s.bubble = 'done'; return; }
      s.bubble = 'due';
      timers.bubbleIn = setTimeout(() => {
        if (!s.shown) { s.bubble = 'never'; return; }
        s.bubble = 'on'; s.bubbleAt = performance.now(); s.bubbleY = s.y;
        bubbleEl.dataset.on = 'true';
        try { sessionStorage.setItem(COMPANION.bubbleKey, '1'); } catch { /* private mode: he may say it again next visit */ }
        timers.bubbleOut = setTimeout(hideBubble, COMPANION.bubbleMs);
      }, (still() ? 0 : ARRIVE_MS) + BUBBLE_DELAY_MS);
    };

    // ---- the pose: the section across 55 % of the screen, committed only when slow or resting ----
    const tryPose = () => {
      clearTimeout(timers.pose); timers.pose = 0;
      const wanted = poseForSection(s.section);
      if (!s.shown) {
        if (wanted !== s.pose) { s.pose = wanted; setPose((p) => ({ cur: wanted, prev: null, n: p.n + 1 })); }
        return;
      }
      const now = performance.now();
      const d = poseDecision({ current: s.pose, wanted, speed: s.speed, resting: s.resting, now, lastAt: s.poseAt });
      if (d.waitMs) { timers.pose = setTimeout(tryPose, d.waitMs); return; }
      if (!d.commit) return; // still fast: the rest timer asks again
      s.pose = wanted; s.poseAt = now;
      setPose((p) => ({ cur: wanted, prev: p.cur, n: p.n + 1 }));
      hop('pose');
    };

    // ---- in and out: out at once, back only after a 250 ms settle ----
    const wanted = () => wantShown({
      scrollY: s.y, viewport: s.vh, otherMobi: s.others.size > 0, barOn: s.barOn, askOpen: s.askOpen, footer: s.footer,
      navOpen: Boolean(document.getElementById('mm-nav-sheet')),
    });
    const stepIn = () => {
      s.shown = true;
      place();
      node.dataset.state = 'in';
      hop('arrive');
      s.poseAt = performance.now();
      tuckCheck();
      hello();
    };
    const stepOut = () => {
      s.shown = false;
      node.dataset.state = 'out';
      hideBubble();
    };
    const sync = () => {
      if (!wanted()) {
        clearTimeout(timers.settle); timers.settle = 0;
        if (s.shown) stepOut();
        return;
      }
      if (s.shown || timers.settle) return;
      timers.settle = setTimeout(() => { timers.settle = 0; if (wanted()) stepIn(); }, COMPANION.settleMs);
    };

    // ---- the lean: CSS variables on his own element, written only when they change ----
    const writeLean = (v, resting) => {
      const { deg, stretch } = still() ? { deg: 0, stretch: 0 } : lean(v);
      if (deg !== s.deg) { s.deg = deg; leanEl.style.setProperty('--mc-lean', `${deg}deg`); }
      // A flick's stretch holds its peak while the flick lasts; CSS settles it (420 ms ease-out).
      const sy = 1 + stretch;
      if (sy !== s.stretch && (sy > s.stretch || resting || stretch === 0)) { s.stretch = sy; leanEl.style.setProperty('--mc-stretch', String(sy)); }
      if (resting !== s.rest) { s.rest = resting; leanEl.dataset.rest = resting ? 'true' : 'false'; }
    };
    const rest = () => {
      timers.rest = 0;
      s.speed = 0; s.resting = true; s.lastT = 0;
      writeLean(0, true);
      tryPose();
      tuckCheck();
    };
    const offScroll = scrollBus.subscribe(({ y, dy, vh, t, resized }) => {
      const gap = s.lastT ? t - s.lastT : 16;
      s.lastT = t;
      s.y = y; s.vh = vh;
      if (resized) place();
      // A held story moves the page a whole resting place at once and a declared jump is the page's own move: no lean.
      const v = scrollBus.held() || scrollBus.jumping() ? 0 : velocity(dy, gap > 100 ? 16 : gap);
      s.speed = v; s.resting = false;
      if (s.shown) writeLean(v, false);
      if (s.bubble === 'on' && bubbleGone({ shownAt: s.bubbleAt, now: performance.now(), fromY: s.bubbleY, y })) hideBubble();
      sync();
      if (s.shown && Math.abs(v) < COMPANION.slowSpeed && poseForSection(s.section) !== s.pose && !timers.pose) tryPose();
      clearTimeout(timers.rest);
      timers.rest = setTimeout(rest, COMPANION.restMs);
    });

    // ---- what the page says: the dock, the held stories' bar, the Ask sheet ----
    const bars = [...page.querySelectorAll('.lp-bar')];
    const readPage = () => {
      s.barOn = bars.some((bar) => bar.dataset.on === 'true');
      s.askOpen = root.dataset.askMobi === 'open';
      place();
      sync();
    };
    const pageWatch = new MutationObserver(readPage);
    pageWatch.observe(page, { subtree: true, attributes: true, attributeFilter: ['data-shown', 'data-hidden', 'data-live', 'data-close-in', 'data-on'] });
    const rootWatch = new MutationObserver(readPage);
    rootWatch.observe(root, { attributes: true, attributeFilter: ['data-ask-mobi'] });

    // ---- any other Mobi on screen (a seat's figure, the desk's Mobi) and the footer ----
    const others = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.boundingClientRect.height > 0) s.others.add(e.target); else s.others.delete(e.target);
      }
      sync();
    }, { threshold: 0 });
    // The hero's film stars Mobi too (PipGuide's flyer waits for it the same way), so he first shows once it has gone.
    document.querySelectorAll('.pip-seat[data-pip-station] .pip-seat__art, .lp-mobi, .lp-film__frame').forEach((el) => others.observe(el));
    const foot = document.querySelector('.mm-foot');
    const footWatch = new IntersectionObserver((entries) => { s.footer = entries[entries.length - 1].isIntersecting; sync(); }, { threshold: 0 });
    if (foot) footWatch.observe(foot);

    // ---- the section across the line 55 % down the screen ----
    const sections = new Set(document.querySelectorAll('main > section, main section#colleges, main section#exam-experience, main section#key-cards'));
    const line = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const key = sectionKey({ id: e.target.id, classes: [...e.target.classList] });
        if (key !== s.section) { s.section = key; changed = true; }
      }
      if (changed) { tryPose(); if (s.shown && !timers.tuck) timers.tuck = setTimeout(tuckCheck, COMPANION.restMs); }
    }, { rootMargin: '-55% 0px -45% 0px', threshold: 0 });
    sections.forEach((el) => line.observe(el));

    const handle = api.current;
    handle.tapped = () => {
      hideBubble();
      window.dispatchEvent(new CustomEvent('mm:ask-mobi', { detail: { source: 'companion' } }));
    };

    readPage();
    return () => {
      offScroll();
      pageWatch.disconnect();
      rootWatch.disconnect();
      others.disconnect();
      footWatch.disconnect();
      line.disconnect();
      for (const id of Object.values(timers)) clearTimeout(id);
      handle.tapped = () => {};
      node.dataset.state = 'out';
      delete node.dataset.tuck;
      delete bubbleEl.dataset.on;
      for (const name of ['--mc-lift', '--mc-inset', '--mc-tuck']) node.style.removeProperty(name);
      leanEl.style.removeProperty('--mc-lean');
      leanEl.style.removeProperty('--mc-stretch');
    };
  }, [on]);

  if (!on) return null;
  const facing = (p) => (p === 'pointing' ? 'left' : 'right');
  return (
    <div ref={box} className="mc" data-state="out">
      <div className="mc__vis">
        <p ref={bubbleRef} className="mc__bubble" aria-hidden="true">{HELLO}</p>
        <button type="button" aria-label="Ask Mobi a question" className="mc__btn" onClick={() => api.current.tapped()}>
          <span ref={leanRef} className="mc__lean" data-rest="true">
            <span className="mc__press">
              <span ref={hopRef} className="mc__hop">
                <span className="mc__breath">
                  {pose.prev ? <span key={`p${pose.n}`} className="mc__pose" data-leaving="true"><Mascot pose={pose.prev} facing={facing(pose.prev)} /></span> : null}
                  <span key={`c${pose.n}`} className="mc__pose" data-entering={pose.prev ? 'true' : undefined}><Mascot pose={pose.cur} facing={facing(pose.cur)} /></span>
                </span>
              </span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
