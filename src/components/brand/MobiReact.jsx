'use client';

// Mobi reacting. One component the whole site shares:
//   <MobiReact act="correct" size={72} label="Correct." onDone={() => ...} />
//
// Mobi is the app's character, drawn in SVG and moved by the app's own rig table: the same
// proportions, shading, idle life, emotions and acts (data/mobi_rig.v2.json, evaluated by mobiRig.js
// and mobiSim.js, drawn by MobiFigure.jsx). Every act answers something the student did or shows a
// state; it never loops for show. He breathes, blinks, glances and fidgets between acts; when nothing
// is moving the frame loop stops. Never render him inside the timed NTA exam.
//
// Acts (the app's 31 plus idle, standing at ease):
//   Once acts play and then call onDone: appear hello talk cheer celebrate correct encourage proud
//     oops wake nod tilt wave startle brace relief walk hop curious focus sympathy idea
//   Held acts keep their stance until the act changes: read think loading point sleepy rest sleep
//     listen idle (nudge ends holding the point)
// Mood (the app's MobiMood): calm happy proud curious sleepy concerned focused. A persistent face
//   under the act, blended over 0.3 s: lids, a warm lower lid, a slope, the gaze, the antenna.
// interactive: a tap plays the next act of the app's tap cycle (hello, tilt, hop, startle), never the
//   same twice, capped at 6 a visit, then a light squash. A sleeping Mobi wakes. Under Quiet a
//   celebration (hop) is a nod; under Off it is a squash; under Reduce motion nothing plays. Only use
//   it where Mobi is not part of a bigger button.
// follow: his eyes follow the pointer while it moves and come back after 1.2 s. Hero use only.
// Settings: Reduce motion draws his still pose for the act's length, then the stance (the mark that
//   carries information stays, drawn finished). Celebrations: Quiet turns cheer, celebrate, proud and
//   hop into a small nod; Off plays nothing.
// `still` holds the pose without motion, whatever the settings. `label` makes him an image for
// screen readers; leave it out and he is decorative (say the same thing in text beside him).
// `theme` ('night' or 'day') pins the light; by default he follows the page's theme.
// To replay the same act, change the component's key. `eagerFirst` is accepted and ignored (there is
// no image to load).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import MobiFigure from './MobiFigure';
import { MOBI_MOOD_NAMES } from './mobiRig';
import { createSim } from './mobiSim';
import { createLoop } from './mobiLoop';
import { poseRig } from './mobiPose';
import { book, moves } from './mobiBook';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { MOBI_ACTS, REACTION_ACTS, SPEC, actWait, resolveAct, stanceAfter } from './mobiActs';
import { FOLLOW, TAP_CYCLE, createTapRun, underLevel } from '@/lib/mobiMoments';
import { useInView } from '@/lib/motion/useInView';

export { MOBI_ACTS, resolveAct };

export const MOBI_MOODS = MOBI_MOOD_NAMES;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ASPECT = 140 / 168;

// A steady, different seed for each Mobi on a page, the same on the server and the client, so two
// Mobis never blink together.
function seedOf(id) {
  let h = 7;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100003;
  return h + 1;
}

export default function MobiReact({
  act = 'idle', size = 96, still = false, label, onDone, facing = 'right', className = '',
  mood = 'calm', interactive = false, follow = false, onTap, theme,
}) {
  const prefs = useMobiPrefs();
  const id = useId();
  const rootRef = useRef(null);
  // He only moves while he is on screen, so a screenful of Mobis costs nothing off screen.
  const [seenRef, onScreen] = useInView({ once: false, initial: true, threshold: 0.05 });
  const setRoot = useCallback((node) => { rootRef.current = node; seenRef(node); }, [seenRef]);

  // A tap can put him in another act for a while (the cycle), or wake him and keep him standing
  // until the act he was given changes.
  const [tapState, setTapState] = useState({ base: act, stance: null, playing: null });
  const tapRun = useRef(null);
  const tapTimer = useRef(0);
  if (tapState.base !== act) setTapState({ base: act, stance: null, playing: null });

  // A once act that has played leaves him in his stance, the way the app's does (he does not stay
  // frozen mid-cheer): `settled` remembers which act has finished.
  const [settled, setSettled] = useState(null);
  if (settled && settled !== act) setSettled(null);
  const tapped = (tapState.base === act && (tapState.playing?.act || tapState.stance)) || null;
  const shown = tapped || (settled === act ? stanceAfter(act) || 'idle' : act);
  const resolved = resolveAct(shown, { celebrations: prefs.celebrations, reduced: prefs.reduced, still });
  const live = resolved.live && onScreen;
  const moodName = MOBI_MOODS.includes(mood) ? mood : 'calm';
  const px = size / 168;
  const lite = size < 56;

  // The first frame (also the server's): the stance he starts from, or his still pose.
  const [initial] = useState(() => poseRig(moves, book, resolved.act, moodName, { live: resolved.live }));

  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);

  // A once act reports when it has finished. Under Reduce motion a reaction holds its still pose
  // for the act's length first (the app's rule); anything else reports at once.
  const propResolved = resolveAct(act, { celebrations: prefs.celebrations, reduced: prefs.reduced, still });
  const wait = actWait(propResolved.act, propResolved.live);
  const once = !SPEC[propResolved.act].held;
  // Under Reduce motion only the reactions give way after their still pose; the rest stay as drawn.
  const gives = propResolved.live || REACTION_ACTS.includes(propResolved.act);
  useEffect(() => {
    if (!once) return undefined;
    const timer = window.setTimeout(() => { if (gives) setSettled(act); doneRef.current?.(act); }, wait);
    return () => window.clearTimeout(timer);
  }, [once, wait, gives, act, propResolved.act]);

  // ---- The rig: a sim stepped by a frame loop that stops when he is at rest ------------------------
  const figRef = useRef(null);
  const simRef = useRef(null);
  const pxRef = useRef(px);
  const played = useRef({ key: null });
  useEffect(() => { pxRef.current = px; }, [px]);

  const paint = useCallback((rig) => { figRef.current?.paint(rig, { px: pxRef.current }); }, []);
  const loopRef = useRef(null);
  useEffect(() => {
    const loop = createLoop(() => simRef.current, (rig) => figRef.current?.paint(rig, { px: pxRef.current }));
    loopRef.current = loop;
    return () => { loop.stop(); loopRef.current = null; };
  }, []);
  const wake = useCallback(() => loopRef.current?.wake(), []);
  const stop = useCallback(() => loopRef.current?.stop(), []);

  // Reduce motion, `still`, Quiet's held acts: no sim runs; he is drawn once in his still pose.
  useLayoutEffect(() => {
    if (resolved.live) return;
    stop();
    simRef.current = null;
    played.current.key = null;
    figRef.current?.paint(poseRig(moves, book, resolved.act, moodName, { live: false }), { px });
  }, [resolved.live, resolved.act, moodName, px, stop]);

  // The sim exists while he is allowed to move; each act (or tap) plays once.
  const bodyKey = `${resolved.act}-${tapState.playing?.n || 0}`;
  useEffect(() => {
    if (!resolved.live) return;
    const spec = SPEC[resolved.act];
    let sim = simRef.current;
    if (!sim) {
      sim = createSim(book, { seed: seedOf(id), stance: spec.held ? spec.stance : 'stand' });
      sim.setMood(moodName, { instant: true });
      sim.step(1 / 120);
      simRef.current = sim;
      played.current.key = null;
      paint(sim.rig);
    }
    if (played.current.key !== bodyKey) {
      const first = played.current.key === null;
      played.current.key = bodyKey;
      // A held act he is already standing in needs no play (a once act's settle, or the first frame).
      const redundant = spec.held && !spec.ms && sim.stance === spec.stance && sim.act == null;
      if (!(redundant || (first && spec.held && !spec.ms))) sim.play(resolved.act);
    }
    wake();
  }, [resolved.live, resolved.act, bodyKey, moodName, id, paint, wake]);

  useEffect(() => {
    const sim = simRef.current;
    if (sim && resolved.live) { sim.setMood(moodName); wake(); }
  }, [moodName, resolved.live, wake]);

  // Off screen (or the tab hidden) he holds still; back on screen he carries on.
  useEffect(() => {
    if (live) wake(); else stop();
    return stop;
  }, [live, wake, stop]);

  // ---- Tap ---------------------------------------------------------------------------------------
  const onTapHit = (event) => {
    if (prefs.reduced) return;
    const sim = simRef.current;
    const squash = () => {
      if (!sim) return;
      const box = event.currentTarget.getBoundingClientRect();
      sim.boop(clamp(((event.clientX || box.left + box.width / 2) - (box.left + box.width / 2)) / (box.width / 2 || 1), -1, 1));
      wake();
    };
    const current = (tapState.base === act && tapState.stance) || act;
    if (!tapRun.current) tapRun.current = createTapRun(TAP_CYCLE);
    const sleeping = current === 'sleep';
    let next = sleeping ? 'wake' : tapRun.current.tap(Date.now());
    // A tap the Celebrations setting holds back still squashes (the app's rule).
    if (next && next !== 'wake') next = underLevel(next, prefs.celebrations);
    if (!next) { squash(); return; }
    window.clearTimeout(tapTimer.current);
    setTapState((s) => ({ base: act, stance: next === 'wake' ? 'idle' : (s.base === act ? s.stance : null), playing: { act: next, n: (s.playing?.n || 0) + 1 } }));
    tapTimer.current = window.setTimeout(() => setTapState((s) => ({ ...s, playing: null })), SPEC[next].ms || 800);
    onTap?.(next);
  };

  // His eyes follow the pointer while it moves, and come back after 1.2 s.
  useEffect(() => {
    if (!follow || !live) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;
    let raf = 0;
    let release = 0;
    const sign = facing === 'left' ? -1 : 1;
    const onMove = (event) => {
      if (raf) return;
      const { clientX, clientY } = event;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const sim = simRef.current;
        if (!sim) return;
        const box = el.getBoundingClientRect();
        const span = Math.max(220, window.innerWidth * 0.35);
        const x = clamp(sign * (clientX - (box.left + box.width / 2)) / span, -FOLLOW.clampX, FOLLOW.clampX);
        const y = clamp((clientY - (box.top + box.height * 0.45)) / span, -FOLLOW.clampY, FOLLOW.clampY);
        sim.lookAt([x, y]);
        wake();
        window.clearTimeout(release);
        release = window.setTimeout(() => { simRef.current?.lookAt(null); wake(); }, FOLLOW.releaseAfterMs);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(release);
      simRef.current?.lookAt(null);
    };
  }, [follow, live, facing, wake]);

  const accessibleName = label || (interactive ? 'Mobi' : undefined);
  return (
    <span
      ref={setRoot}
      className={`mobi-react ${className}`.trim()}
      data-act={resolved.act}
      data-live={live ? 'true' : 'false'}
      data-facing={facing}
      data-mood={moodName}
      data-mb-theme={theme === 'night' || theme === 'day' ? theme : undefined}
      data-interactive={interactive ? 'true' : undefined}
      role={label && !interactive ? 'img' : undefined}
      aria-label={label && !interactive ? label : undefined}
      aria-hidden={label || interactive ? undefined : true}
      style={{ '--mobi-size': `${size}px`, '--mobi-ar': ASPECT.toFixed(4) }}
    >
      <span className="mobi-react__look">
        <MobiFigure ref={figRef} initial={initial} px={px} lite={lite} />
      </span>
      {interactive ? <button type="button" className="mobi-react__hit" aria-label={accessibleName} onClick={onTapHit} /> : null}
    </span>
  );
}
