'use client';

// A painted quiet state (the app's SceneVignette): a 3:2 room, Night or Day by the page's theme, with
// the living Mobi standing in its lit ellipse, and the room alive for a few breaths (SceneLife).
//
//   <SceneVignette scene="saved" />                    an empty state's room; Mobi rests
//   <SceneVignette scene="unreachable" entrance="oops" /> an error: one shrug on the first failure of a
//                                                       run (90 s), calm on every retry after
//   <SceneVignette scene="nothingYet" compact />        150 px tall instead of 248
//   <SceneVignette scene="saved" act="point" />         a caller's own act (the Saved page points Mobi
//                                                       at its link); 'sleepy' only at the offline desk
//   <SceneVignette scene="nothingYet" interactive />    a tap plays Mobi's tap cycle (MobiReact)
//
// Rooms: allClear (every bubble filled: only for "nothing to repair"), nothingYet (a bare desk and a
// blank sheet), saved (two taped notes and a lime ribbon), noResults (an empty tray and a magnifier),
// offline (the unplugged desk lamp), unreachable (a loose cable and a repair tin).
//
// Size and place follow the app exactly: never taller than 248 px (150 compact), so never wider than
// 372 px; Mobi is 0.42 of the room's height, in a box 1.6 times as wide, his feet on the anchor
// measured on the painting (data/scene-anchors.json). One Mobi per screen: the room's Mobi is the
// state's Mobi, so a caller drops any other one it had there. Decorative: the state's words say it.

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import MobiReact from '@/components/brand/MobiReact';
import { useMobiGate } from '@/lib/mobiHooks';
import { oopsRun } from '@/lib/mobiRation';
import { useInView } from '@/lib/motion/useInView';
import anchors from './anchors';
import SceneImage, { useSceneTheme } from './SceneImage';
import SceneLife from './SceneLife';
import { VIGNETTE_COMPACT_HEIGHT, VIGNETTE_MAX_HEIGHT, vignetteLayout } from './sceneModel.mjs';

const pct = (n) => `${Math.round(n * 100000) / 1000}%`;

export default function SceneVignette({ scene, compact = false, act, entrance, mobi = true, interactive = false, life = true, className = '' }) {
  const theme = useSceneTheme();
  const night = theme !== 'day';
  const path = usePathname() || 'page';
  const [ready, setReady] = useState(false);
  const [seenRef, seen] = useInView({ once: true, threshold: 0.3 });
  // An error's first failure of a run: Mobi shrugs once as he arrives, then rests.
  const shrug = useMobiGate(() => (entrance === 'oops' ? oopsRun(`error:${path}`) : false), false);
  const [entered, setEntered] = useState(false);

  const layout = vignetteLayout(anchors, scene, { night });
  if (!layout) return null;
  const maxHeight = compact ? VIGNETTE_COMPACT_HEIGHT : VIGNETTE_MAX_HEIGHT;
  const maxWidth = Math.round(maxHeight / layout.aspect);
  // Mobi sits in the lit ellipse; asleep is a seat only the unplugged desk offers.
  const stance = act === 'sleepy' && scene !== 'offline' ? 'rest' : act || 'rest';
  const shown = shrug && !entered ? 'oops' : stance;
  // His drawn height follows the room's width through CSS (--scene-mobi, container units); this is the
  // full-size figure for anything that reads the prop.
  const mobiPx = Math.round(maxHeight * layout.mobi.height);

  return (
    <span
      ref={seenRef}
      className={`scene-room${compact ? ' scene-room--compact' : ''} ${className}`.trim()}
      style={{ '--scene-max-w': `${maxWidth}px`, '--scene-mobi': Math.round(layout.mobiOfWidth * 100000) / 1000 }}
      data-scene={scene}
      aria-hidden={interactive ? undefined : 'true'}
    >
      <SceneImage kind={scene} sizes={`(max-width: ${maxWidth + 48}px) calc(100vw - 48px), ${maxWidth}px`} onLoad={() => setReady(true)} />
      {life && theme ? <SceneLife scene={scene} night={night} run={ready && seen} /> : null}
      {mobi ? (
        <span
          className="scene-room__mobi"
          style={{ left: pct(layout.mobi.left), top: pct(layout.mobi.top), width: pct(layout.mobi.width), height: pct(layout.mobi.height) }}
        >
          <MobiReact act={shown} size={mobiPx} interactive={interactive} onDone={shown === 'oops' ? () => setEntered(true) : undefined} />
        </span>
      ) : null}
    </span>
  );
}
