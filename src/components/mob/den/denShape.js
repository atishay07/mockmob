"use client";
// The den's last shape on this device, for its skeleton (MOB-BUILD-SPEC-V3 D6: no layout shift, the den's own shape).
// A per-viewer convenience in localStorage: which page the Mob tab drew (the den, the den's start, or the older ring),
// whether the Mob switcher row stood above it, and the heights of the blocks under the room at this width band. A
// missing or unreadable store only means the skeleton uses the den's usual shape (the open-game card and the quest).
import { shapeBand, parseShape, DEFAULT_BLOCKS } from '@/lib/mob/v3/denSkeleton.mjs';

const KEY = 'mm:den:shape:v1';

export function readDenShape() {
  try { return parseShape(JSON.parse(window.localStorage.getItem(KEY) || 'null')); } catch { return parseShape(null); }
}

function write(next) {
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the usual shape next time */ }
  applyShapeVars(parseShape(next));
}

/**
 * The root layout's first script sets these before the first paint from the same store (--den-skel-b0..3 and
 * data-den-switch on <html>), so a server-drawn skeleton already has this device's sizes. Kept in step here.
 */
export function applyShapeVars(shape) {
  try {
    const d = document.documentElement;
    const blocks = shape.blocks?.[shapeBand(window.innerWidth)] || [];
    for (let i = 0; i < 4; i++) {
      if (blocks[i]) d.style.setProperty(`--den-skel-b${i}`, `${blocks[i]}px`);
      else d.style.removeProperty(`--den-skel-b${i}`);
    }
    if (shape.switcher) d.dataset.denSwitch = '1';
    else delete d.dataset.denSwitch;
  } catch { /* the skeleton's own sizes */ }
}

/** After the den has drawn: the heights of what sits under the room (the card, the notice, the quest strip). */
export function rememberDenShape(den) {
  if (!den || typeof window === 'undefined') return;
  const stage = den.querySelector(':scope > .den-stage');
  if (!stage) return;
  const blocks = [];
  for (const el of den.children) {
    if (el === stage || !(el instanceof HTMLElement)) continue;
    if (el.matches('.sr-only, .den-toast, .den-fly, .mob-notice')) continue;
    const h = Math.round(el.getBoundingClientRect().height);
    if (h > 0) blocks.push(h);
  }
  const band = shapeBand(window.innerWidth);
  const prev = readDenShape();
  const switcher = Boolean(den.parentElement?.querySelector(':scope > .mob-switch'));
  const next = { ...prev, kind: 'den', switcher, blocks: { ...prev.blocks, [band]: blocks.slice(0, 4) } };
  if (JSON.stringify(next) === JSON.stringify(prev)) return;
  write(next);
}

/** The Mob tab drew the den's start (no Mob yet) or the older ring page. */
export function rememberMobKind(kind) {
  if (typeof window === 'undefined') return;
  const prev = readDenShape();
  if (prev.kind === kind) return;
  write({ ...prev, kind });
}

export { DEFAULT_BLOCKS };
