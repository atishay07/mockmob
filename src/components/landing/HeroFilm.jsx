'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

// The home hero's film (round 7, owner 7 Nov 2026: "the promo video playing as the main hero", like klayprep.com).
// For now the approved launch teaser (public/video, 77.8 s, voice and music); later a promo plus walkthrough. Its message
// is the film's own on-screen type, so it plays muted and never starts with sound: the reader turns sound on.
//   - The poster (the film's "Preparing for CUET 2027?" frame) is drawn first in a fixed 16:9 frame, so nothing shifts;
//     it is the hero's largest paint on desktop, so it asks for high priority.
//   - The film's file is picked on mount (480p under 768 px, 720p above) and nothing is fetched until it plays
//     (preload none). It plays by itself only after the page's load event, only while at least half of it is on screen,
//     and pauses when it leaves or the tab hides.
//   - It never plays by itself under Reduce motion (the system's or the site's own, html[data-motion='reduced']) or Data
//     Saver: then a round Play key sits on the poster.
//   - Two round 44 px keys in the corner: sound on/off and pause/play.
export const FILM = Object.freeze({
  label: 'MockMob launch film, 78 seconds',
  poster: '/video/hero-poster.webp',
  small: '/video/hero-480.mp4',
  large: '/video/hero-720.mp4',
  width: 1280,
  height: 720,
  smallBelow: 768,
  visibleShare: 0.5,
});

// No autoplay: Reduce motion (system or the site's switch) or Data Saver.
function stillOnly() {
  try {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
    if (navigator.connection?.saveData === true) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export default function HeroFilm() {
  const figureRef = useRef(null);
  const videoRef = useRef(null);
  // Whether the film should be playing while it is on screen: true by default unless autoplay is off; a reader's own
  // Play or Pause sets it.
  const wantPlay = useRef(false);
  const inView = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // The round Play key on the poster: autoplay is off here, or the browser refused to start the film.
  const [needsTap, setNeedsTap] = useState(false);

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const run = video.play();
    if (run && typeof run.catch === 'function') {
      run.catch(() => {
        wantPlay.current = false;
        setNeedsTap(true);
      });
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const figure = figureRef.current;
    if (!video || !figure) return undefined;
    video.muted = true;
    video.src = window.innerWidth < FILM.smallBelow ? FILM.small : FILM.large;
    // Autoplay off here (Reduce motion or Data Saver): the round Play key shows on the poster whenever the film is paused.
    let autoOff = stillOnly();
    wantPlay.current = !autoOff;
    // It first plays by itself only once the page has loaded, so its file never competes with the first paint; a reader's
    // own Play works at once.
    let loaded = document.readyState === 'complete';

    const sync = () => {
      if (inView.current && !document.hidden && wantPlay.current && loaded) start();
      else if (!video.paused && (!inView.current || document.hidden)) video.pause();
    };
    const onLoad = () => { loaded = true; sync(); };
    if (!loaded) window.addEventListener('load', onLoad, { once: true });
    let io = null;
    if (typeof IntersectionObserver === 'undefined') {
      inView.current = true;
    } else {
      io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        inView.current = entry.isIntersecting && entry.intersectionRatio >= FILM.visibleShare;
        if (autoOff && video.paused) setNeedsTap(true);
        sync();
      }, { threshold: [0, FILM.visibleShare, 1] });
      io.observe(figure);
    }
    // Reduce motion or Data Saver switched on while it plays by itself: it stops and waits for a tap.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPrefs = () => {
      if (!stillOnly()) return;
      autoOff = true;
      wantPlay.current = false;
      if (!video.paused) video.pause();
      setNeedsTap(true);
    };
    motion.addEventListener?.('change', onPrefs);
    window.addEventListener('mm-prefs', onPrefs);
    document.addEventListener('visibilitychange', sync);
    if (!io) sync();
    return () => {
      io?.disconnect();
      motion.removeEventListener?.('change', onPrefs);
      window.removeEventListener('mm-prefs', onPrefs);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('load', onLoad);
      video.pause();
    };
  }, [start]);

  const play = () => {
    wantPlay.current = true;
    setNeedsTap(false);
    start();
  };
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else {
      wantPlay.current = false;
      video.pause();
    }
  };
  // Sound on unmutes and plays; sound off only mutes.
  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      setSoundOn(true);
      if (video.paused) play();
    } else {
      video.muted = true;
      setSoundOn(false);
    }
  };

  return (
    <figure ref={figureRef} className="lp-film" aria-label={FILM.label} data-playing={playing ? 'true' : 'false'}>
      <div className="lp-film__frame">
        {/* The film's own first frame, the same file as the video's poster, so it is fetched once. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- one fixed 43 KB poster, shared with the video's poster attribute */}
        <img className="lp-film__poster" src={FILM.poster} width={FILM.width} height={FILM.height} alt="" fetchPriority="high" decoding="async" draggable={false} />
        <video
          ref={videoRef}
          className="lp-film__video"
          muted
          playsInline
          loop
          preload="none"
          poster={FILM.poster}
          width={FILM.width}
          height={FILM.height}
          onPlay={() => { setPlaying(true); setNeedsTap(false); }}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setSoundOn(!event.currentTarget.muted)}
        />
        {needsTap && !playing ? (
          // A large pointer target on the poster; keyboards and screen readers use the corner's "Play film" key.
          <button type="button" className="lp-film__start" onClick={play} tabIndex={-1} aria-hidden="true">
            <Play size={24} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
        <div className="lp-film__keys">
          <button type="button" className="lp-film__key" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}>
            {soundOn ? <Volume2 size={20} strokeWidth={2} aria-hidden="true" /> : <VolumeX size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
          <button type="button" className="lp-film__key" onClick={togglePlay} aria-label={playing ? 'Pause film' : 'Play film'}>
            {playing ? <Pause size={20} strokeWidth={2} aria-hidden="true" /> : <Play size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </figure>
  );
}
