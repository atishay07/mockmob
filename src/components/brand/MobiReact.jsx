'use client';

// Mobi reacting. One component the whole site shares:
//   <MobiReact act="correct" size={72} label="Correct." onDone={() => ...} />
//
// Mobi is the existing Mascot art (seven raster poses), moved with CSS: a body that squashes and
// hops, a lean that sways, a breath underneath everything, lids that blink over the visor, a
// cross-fade when he changes pose, and small SVG marks drawn around him (a tick inking itself,
// thought dots, sparkles, confetti, z's). Every act answers something the student did or shows a
// state; it never loops for show. Never render him inside the timed NTA exam.
//
// Acts (the app's 26 plus idle, standing at ease):
//   Once acts play and then call onDone: appear hello talk cheer celebrate correct encourage proud
//     oops nudge wake nod tilt wave startle brace relief walk
//   Held acts keep their stance until the act changes: read think loading point sleepy rest sleep
//     listen idle (nudge ends holding the point)
// Mood (the app's MobiMood): calm happy proud curious sleepy concerned. A persistent face under the
//   act: a lean, a lift, a glint at the antenna. The raster cannot move its eyes, so the mood lives
//   in posture and marks.
// interactive: a tap plays the next act of the app's tap cycle (hello, tilt, correct, startle),
//   never the same twice, capped at 6 a visit, then a light squash. A sleeping Mobi wakes.
//   Under Quiet a tap is a nod; under Off or Reduce motion nothing plays. Only use it where Mobi
//   is not part of a bigger button.
// follow: the head leans a little toward the pointer, and lets go after 1.2 s. Hero use only.
// Settings: Reduce motion holds the pose for the act's length, then the stance (the mark that
//   carries information stays, drawn finished). Celebrations: Quiet turns cheer, celebrate and
//   proud into a small nod; Off plays nothing.
// `still` holds the pose without motion, whatever the settings. `label` makes him an image for
// screen readers; leave it out and he is decorative (say the same thing in text beside him).
// To replay the same act, change the component's key.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mascot } from './Mascot';
import { MobiMarks } from './MobiMarks';
import { EYES } from './mobiEyes';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { MOBI_ACTS, REACTION_ACTS, SPEC, actWait, resolveAct, stanceAfter } from './mobiActs';
import { FOLLOW, TAP_CYCLE, createTapRun } from '@/lib/mobiMoments';
import { useInView } from '@/lib/motion/useInView';
import assets from '@/../public/brand/mascot/manifest.json';

export { MOBI_ACTS, resolveAct };

export const MOBI_MOODS = ['calm', 'happy', 'proud', 'curious', 'sleepy', 'concerned'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A steady, different blink offset for each Mobi on a page, the same on the server and the client.
function blinkOffset(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 6007;
  return -(h % 5200);
}

export default function MobiReact({
  act = 'idle', size = 96, still = false, label, onDone, facing = 'right', className = '',
  mood = 'calm', interactive = false, follow = false, onTap,
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
  const [squash, setSquash] = useState(false);
  const tapRun = useRef(null);
  const tapTimer = useRef(0);
  const squashTimer = useRef(0);
  if (tapState.base !== act) setTapState({ base: act, stance: null, playing: null });
  useEffect(() => () => { window.clearTimeout(tapTimer.current); window.clearTimeout(squashTimer.current); }, []);

  // A once act that has played leaves him in his stance, the way the app's does (he does not stay
  // frozen mid-cheer): `settled` remembers which act has finished.
  const [settled, setSettled] = useState(null);
  if (settled && settled !== act) setSettled(null);
  const tapped = (tapState.base === act && (tapState.playing?.act || tapState.stance)) || null;
  const shown = tapped || (settled === act ? stanceAfter(act) || 'idle' : act);
  const resolved = resolveAct(shown, { celebrations: prefs.celebrations, reduced: prefs.reduced, still });
  const spec = SPEC[resolved.act];
  const asset = assets[spec.pose] || assets.attentive;
  const ratio = asset.width / asset.height;
  const live = resolved.live && onScreen;
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

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

  // The pose changes with a short cross-fade: the old pose fades out under the new one.
  const [posed, setPosed] = useState({ pose: spec.pose, prev: null });
  if (posed.pose !== spec.pose) setPosed({ pose: spec.pose, prev: posed.pose });
  useEffect(() => {
    if (!posed.prev) return undefined;
    const timer = window.setTimeout(() => setPosed((p) => (p.prev ? { pose: p.pose, prev: null } : p)), 280);
    return () => window.clearTimeout(timer);
  }, [posed.prev, posed.pose]);

  const eyes = EYES[spec.pose];
  const moodName = MOBI_MOODS.includes(mood) ? mood : 'calm';
  const lid = spec.lids != null ? spec.lids : moodName === 'sleepy' ? 0.38 : 0;

  const onTapHit = () => {
    if (prefs.celebrations === 'off' || prefs.reduced) return;
    window.clearTimeout(squashTimer.current);
    const lightSquash = () => { setSquash(true); squashTimer.current = window.setTimeout(() => setSquash(false), 260); };
    const current = (tapState.base === act && tapState.stance) || act;
    if (!tapRun.current) tapRun.current = createTapRun(TAP_CYCLE);
    const sleeping = current === 'sleep';
    let next = sleeping ? 'wake' : tapRun.current.tap(Date.now());
    if (!next) { lightSquash(); return; }
    if (prefs.celebrations === 'quiet' && next !== 'wake') next = 'nod';
    window.clearTimeout(tapTimer.current);
    setTapState((s) => ({ base: act, stance: next === 'wake' ? 'idle' : (s.base === act ? s.stance : null), playing: { act: next, n: (s.playing?.n || 0) + 1 } }));
    tapTimer.current = window.setTimeout(() => setTapState((s) => ({ ...s, playing: null })), SPEC[next].ms || 800);
    onTap?.(next);
  };

  // The head leans a little toward the pointer while it moves, and lets go after 1.2 s.
  useEffect(() => {
    if (!follow || !live) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;
    let raf = 0;
    let release = 0;
    const onMove = (event) => {
      if (raf) return;
      const x = event.clientX;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const box = el.getBoundingClientRect();
        const span = Math.max(220, window.innerWidth * 0.35);
        el.style.setProperty('--mr-follow', clamp((x - (box.left + box.width / 2)) / span, -FOLLOW.clampX, FOLLOW.clampX).toFixed(3));
        window.clearTimeout(release);
        release = window.setTimeout(() => el.style.setProperty('--mr-follow', '0'), FOLLOW.releaseAfterMs);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(release);
      el.style.setProperty('--mr-follow', '0');
    };
  }, [follow, live]);

  const bodyKey = `${resolved.act}-${tapState.playing?.n || 0}`;
  const accessibleName = label || (interactive ? 'Mobi' : undefined);
  return (
    <span
      ref={setRoot}
      className={`mobi-react ${className}`.trim()}
      data-act={resolved.act}
      data-live={live ? 'true' : 'false'}
      data-facing={facing}
      data-mood={moodName}
      data-squash={squash ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
      data-lids={eyes ? 'true' : undefined}
      role={label && !interactive ? 'img' : undefined}
      aria-label={label && !interactive ? label : undefined}
      aria-hidden={label || interactive ? undefined : true}
      style={{ '--mobi-size': `${size}px`, '--mobi-ar': ratio.toFixed(4), '--mr-dir': facing === 'left' ? -1 : 1, '--mr-blink': `${blinkOffset(id)}ms`, '--mr-lid': lid }}
    >
      <span className="mobi-react__shadow" />
      <span className="mobi-react__breath">
        <span className="mobi-react__look">
          <span className="mobi-react__body" key={`body-${bodyKey}`}>
            <span className="mobi-react__lean" key={`lean-${bodyKey}`}>
              {posed.prev && live ? <span className="mobi-react__pose mobi-react__pose--out" key={`out-${posed.prev}`}><Mascot pose={posed.prev} facing={facing} eager /></span> : null}
              <span className={`mobi-react__pose${posed.prev && live ? ' mobi-react__pose--in' : ''}`} key={spec.pose}><Mascot pose={spec.pose} facing={facing} eager /></span>
              {eyes ? (
                <span className="mobi-react__lids" aria-hidden="true">
                  {eyes.map(([left, top, width, height]) => <i key={left} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />)}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </span>
      <MobiMarks act={resolved.act} mood={moodName} />
      {interactive ? <button type="button" className="mobi-react__hit" aria-label={accessibleName} onClick={onTapHit} /> : null}
    </span>
  );
}
