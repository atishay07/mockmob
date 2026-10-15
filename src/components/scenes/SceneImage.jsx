'use client';

// One painted scene file, sharp on 1x to 3x screens: a <picture> with AVIF then WebP srcsets of the
// app's own full-size paintings (public/art/scenes, see sceneModel.mjs). Decorative: the state's words
// sit beside it, so alt is empty and screen readers skip it.
//
//   <SceneImage kind="saved" />                       the Night or Day room, by the page's theme
//   <SceneImage kind="milestone" sizes="420px" />     the milestone band
//   <SceneImage kind="welcome" night />                a tall room (Night only)
//
// The box is laid out from the file's ratio before anything decodes (width and height attributes and
// aspect-ratio), so nothing shifts. The file loads lazily and fades in over 200 ms once decoded, as the
// app's SceneImage does, so it never pops in. Night or Day follows html[data-theme]; only the shown
// theme's file is fetched, and a theme switch swaps it. Every room and band is feathered to transparent
// at its edges: no border, radius or card goes around it.

import { useState, useSyncExternalStore } from 'react';
import { sceneArt, sceneSrc, sceneSrcSet } from './sceneModel.mjs';
import './scenes.css';

function subscribeTheme(notify) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('mm-theme', notify);
  return () => {
    observer.disconnect();
    window.removeEventListener('mm-theme', notify);
  };
}
const themeSnapshot = () => (document.documentElement.dataset.theme === 'dark' ? 'night' : 'day');
const serverTheme = () => null;

/** 'night', 'day', or null before the browser has said (the server render and hydration). */
export function useSceneTheme() {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, serverTheme);
}

export default function SceneImage({ kind, night, sizes = '(max-width: 420px) calc(100vw - 40px), 372px', priority = false, className = '', onLoad }) {
  const theme = useSceneTheme();
  const isNight = night ?? (theme == null ? null : theme === 'night');
  const art = isNight == null ? null : sceneArt(kind, { night: isNight });
  const [loadedSrc, setLoadedSrc] = useState(null);
  const fallback = art ? sceneSrc(art, art.widths[0], 'webp') : '';
  const loaded = Boolean(art) && loadedSrc === fallback;
  // The picture is only ever made on the client (the theme is unknown on the server), so React is
  // listening before the browser fires load, even for a file already in the cache.
  const markLoaded = () => {
    setLoadedSrc(fallback);
    onLoad?.();
  };

  const ratio = art ? `${art.width} / ${art.height}` : kind === 'welcome' ? '1296 / 1620' : kind === 'planSeal' ? '1296 / 1944' : '3 / 2';
  return (
    <span className={`scene-img ${className}`.trim()} style={{ aspectRatio: ratio }} data-scene={kind} data-loaded={loaded ? 'true' : 'false'} aria-hidden="true">
      {art ? (
        <picture key={art.base}>
          <source type="image/avif" srcSet={sceneSrcSet(art, 'avif')} sizes={sizes} />
          <source type="image/webp" srcSet={sceneSrcSet(art, 'webp')} sizes={sizes} />
          {/* A plain img with hand-made srcsets: the sizes already exist, so no image optimiser is spent. */}
          <img
            className="scene-img__file"
            src={fallback}
            width={art.width}
            height={art.height}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            draggable={false}
            onLoad={markLoaded}
          />
        </picture>
      ) : null}
    </span>
  );
}
