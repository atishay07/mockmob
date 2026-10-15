'use client';

// A painted room, alive and quiet (the app's SceneLife): at Night the lamp breathes (its glow swells
// and eases over 8 s), nine dust motes drift up through its cone and three stars in the window
// twinkle; by Day only the sunlit pool on the floor breathes. Nothing else moves.
//
// It is decoration: one layer over the picture, inside the picture's own box (never over text),
// transform and opacity only. It runs for three breaths (24 s), easing in and out over 1.5 s at the
// ends, and then removes itself, leaving the plain painting. It never runs under Reduce motion (the
// student's switch or the device's), or when the browser asks to save data; it pauses while the tab
// is hidden. The numbers come from data/scene-anchors.json through lifeLayers() in sceneModel.mjs, so
// the website's room breathes where and how the app's does.

import { useState, useSyncExternalStore } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import anchors from './anchors';
import { lifeLayers } from './sceneModel.mjs';

function subscribeVisibility(notify) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}
const hiddenSnapshot = () => document.visibilityState === 'hidden';
const serverHidden = () => false;

// The browser's own "use less data" signal. The web has no graphics tier of its own, so this is the
// one lighter setting it can honour.
function saveData() {
  try { return Boolean(navigator.connection?.saveData); } catch { return false; }
}

const pct = (n) => `${Math.round(n * 100000) / 1000}%`;
const num = (n) => Math.round(n * 10000) / 10000;

export default function SceneLife({ scene, night, run = true }) {
  const prefs = useMobiPrefs();
  const hidden = useSyncExternalStore(subscribeVisibility, hiddenSnapshot, serverHidden);
  const [done, setDone] = useState(false);
  if (!run || done || prefs.reduced || saveData()) return null;
  const life = lifeLayers(anchors, scene, { night });
  if (!life) return null;

  const { breathSeconds, cycles, fadeEndsMs } = life.timing;
  const span = breathSeconds * cycles;
  const swayPeriod = breathSeconds / 1.5;
  const starPeriod = breathSeconds / 2;
  return (
    <span
      className="scene-life"
      data-night={night ? 'true' : 'false'}
      data-paused={hidden ? 'true' : 'false'}
      aria-hidden="true"
      style={{ '--life-span': `${span}s`, '--life-breath': `${breathSeconds}s`, '--life-cycles': cycles, '--life-ends': `${fadeEndsMs}ms` }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'scene-life-env') setDone(true);
      }}
    >
      <span
        className="scene-life__pool"
        style={{ left: pct(life.pool.x), top: pct(life.pool.y), width: pct(life.pool.width), '--pool-alpha': life.pool.alpha }}
      />
      {life.glow ? (
        <span
          className="scene-life__glow"
          style={{ left: pct(life.glow.x), top: pct(life.glow.y), width: pct(life.glow.radius * 2), '--glow-alpha': life.glow.alphaHigh, '--glow-low': num(life.glow.alphaLow / life.glow.alphaHigh) }}
        />
      ) : null}
      {life.motes.length ? (
        <span className="scene-life__motes">
          {life.motes.map((mote, i) => {
            // The app's phase p = (t + i / 9) mod 1: start each mote that far into its first breath, and
            // let it run exactly to the end of the span.
            const rise = { animationDelay: `${num(-mote.phase * breathSeconds)}s`, animationIterationCount: num(cycles + mote.phase) };
            // Sway: sin(2 pi (1.5 p + s)), drawn as -cos, so a quarter period ahead.
            const swayPhase = (1.5 * mote.phase + mote.sway + 0.25) % 1;
            const sway = { animationDelay: `${num(-swayPhase * swayPeriod)}s`, animationIterationCount: num(span / swayPeriod + swayPhase) };
            return (
              <span
                key={i}
                className="scene-life__mote"
                style={{
                  ...rise,
                  // Across in % of the width; down in % of the height, as container units (the room is 3:2).
                  '--x0': num(mote.x0 * 100), '--x1': num(mote.x1 * 100),
                  '--y0': num(mote.y0 * 100 * life.aspect), '--y1': num(mote.y1 * 100 * life.aspect),
                  '--mote-a': num(mote.alpha),
                }}
              >
                <i style={{ ...sway, '--mote-size': num(mote.size * 100), '--sway': num(mote.swayOfWidth * 100) }} />
              </span>
            );
          })}
        </span>
      ) : null}
      {life.stars.map((star, i) => (
        <span
          key={i}
          className="scene-life__star"
          style={{
            left: pct(star.x),
            top: pct(star.y),
            animationDelay: `${num(-star.phase * starPeriod)}s`,
            animationIterationCount: num(span / starPeriod + star.phase),
          }}
        >
          <i />
        </span>
      ))}
    </span>
  );
}
