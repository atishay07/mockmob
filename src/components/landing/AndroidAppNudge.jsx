'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { NUDGE_COPY, NUDGE_PLAY_URL, NUDGE_PREVIEW_PARAM, nudgeDrawn, showAndroidNudge } from './androidNudge.mjs';
import './android-app-nudge.css';

const DEV = process.env.NODE_ENV !== 'production';

/**
 * The Android app nudge (owner, 21 Nov 2026): the app's feature graphic, one line on what the app does, and one key to its
 * Play listing, for an Android phone's own browser only (there is no iPhone app). A normal section at the foot of the home
 * page, after the close band; nothing floats.
 *
 * `listed` is the server's PLAY_LISTING_PUBLIC === 'true' (the listing answers 404 until it is public). The section is always
 * drawn hidden; ?appnudge=1 previews it on an Android phone, on the live site too (owner LK366, 22 Nov 2026).
 * It is drawn hidden and shown after hydration only when the rule in androidNudge.mjs holds, by flipping the `hidden`
 * attribute (no re-render). It sits below everything a reader has seen, so showing it moves nothing on screen.
 * The phone bar (HeroDockGate) steps aside over it: page.js lists .lp-app in its `aside` selector.
 * No funnel step: one would need a database migration.
 */
export default function AndroidAppNudge({ listed = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let preview = false;
    let standalone = false;
    try { preview = new URLSearchParams(window.location.search).get(NUDGE_PREVIEW_PARAM) === '1'; } catch { preview = false; }
    try { standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { standalone = false; }
    const show = showAndroidNudge({
      ua: window.navigator.userAgent,
      listed,
      dev: DEV,
      preview,
      appView: document.documentElement.hasAttribute('data-app-view'),
      standalone,
    });
    node.hidden = !show;
    // The preview of a listing that is not public yet says so (the note is hidden otherwise).
    node.toggleAttribute('data-preview', show && preview && !listed);
  }, [listed]);

  if (!nudgeDrawn()) return null;

  return (
    <section ref={ref} className="lp-app" aria-labelledby="lp-app-title" hidden>
      <div className="mm-wrap lp-app__inner">
        <div className="lp-app__card">
          <div className="lp-app__art">
            {/* eslint-disable-next-line @next/next/no-img-element -- lazy, pre-sized 17 and 32 KB WebP variants */}
            <img
              src="/brand/app/feature-graphic-640.webp"
              srcSet="/brand/app/feature-graphic-640.webp 640w, /brand/app/feature-graphic-1024.webp 1024w"
              sizes="(min-width: 700px) 560px, calc(100vw - 32px)"
              width={1024}
              height={500}
              loading="lazy"
              decoding="async"
              alt={NUDGE_COPY.alt}
            />
          </div>
          <div className="lp-app__body">
            <p className="lp-app__eyebrow">{NUDGE_COPY.eyebrow}</p>
            <h2 id="lp-app-title" className="lp-app__title">{NUDGE_COPY.title}</h2>
            <p className="lp-app__line">{NUDGE_COPY.line}</p>
            <a className="mm-btn mm-btn--secondary lp-app__key" href={NUDGE_PLAY_URL} rel="noopener">
              {NUDGE_COPY.key}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <p className="lp-app__preview">{NUDGE_COPY.previewNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
