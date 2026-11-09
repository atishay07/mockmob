'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { FILM, chapterAt, pickSource } from './heroFilmConfig.mjs';

export { FILM };

// The home hero's film. Round 7 (owner, 7 Nov 2026: "the promo video playing as the main hero", like klayprep.com) put the
// launch teaser here; round 9 (owner, 9 Nov 2026: "the main walkthrough video of the platform ... highly converting")
// plays the walkthrough with a hook (Hero16): muted first, ten chapters: the hook, the study loop, the plan, friends and what Pro holds.
//   - The poster (the film's "Preparing for CUET 2027?" frame) is drawn first in a fixed 16:9 frame, so nothing shifts;
//     it is the hero's largest paint on desktop, so it asks for high priority.
//   - The film's file is picked on mount by the frame's rendered width in device pixels (heroFilmConfig pickSource; Data
//     Saver takes 480p) and nothing is fetched until it plays (preload none). It plays by itself only after the page's
//     load event, only while at least half of the picture is on screen, and pauses when it leaves or the tab hides.
//   - It never plays by itself under Reduce motion (the system's or the site's own, html[data-motion='reduced']) or Data
//     Saver: then a round Play key sits on the poster.
//   - Nothing else is drawn on the picture: a tap or click on it pauses or plays (pointer; keyboards use the keys). Under
//     the frame, one row: the pause/play key, the chapter bar (one segment per chapter: it seeks to that chapter and
//     plays; the current one fills as it plays; arrow keys move between them), the current chapter's name, the sound key.
//   - The fill moves only while the film plays and is on screen (one animation frame at a time; under Reduce motion it
//     steps with the film's own time updates). Paused, nothing runs.

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

// Reduce motion alone (the fill steps instead of gliding).
function reducedMotion() {
  try {
    return document.documentElement.getAttribute('data-motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

const COUNT = FILM.chapters.length;

export default function HeroFilm() {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const segRefs = useRef([]);
  // Whether the film should be playing while it is on screen: true by default unless autoplay is off; a reader's own
  // Play or Pause sets it.
  const wantPlay = useRef(false);
  const inView = useRef(false);
  // A chapter chosen before the film's length is known: applied once it is.
  const pendingSeek = useRef(null);
  const chapterRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // The round Play key on the poster: autoplay is off here, or the browser refused to start the film.
  const [needsTap, setNeedsTap] = useState(false);
  const [chapter, setChapter] = useState(0);
  // The film is narrated: until sound has come on once, a small "Sound on" key sits in the picture's corner.
  const heardOnce = useRef(false);
  const [heard, setHeard] = useState(false);

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

  // Where the film is: the current chapter (a render only when it changes) and its fill (one custom property).
  const paint = useCallback(() => {
    const video = videoRef.current;
    const bar = barRef.current;
    if (!video || !bar || pendingSeek.current !== null) return;
    const { index, share } = chapterAt(video.currentTime, video.duration, FILM.chapters);
    bar.style.setProperty('--p', share.toFixed(4));
    if (index !== chapterRef.current) {
      chapterRef.current = index;
      setChapter(index);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return undefined;
    video.muted = true;
    video.src = pickSource(frame.getBoundingClientRect().width, window.devicePixelRatio, navigator.connection?.saveData === true);
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
      io.observe(frame);
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

    // The fill: one frame at a time while it plays and is on screen; it stops itself when the film pauses or leaves.
    let raf = 0;
    const tick = () => {
      raf = 0;
      paint();
      if (!video.paused && !video.ended && inView.current && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && !reducedMotion()) raf = requestAnimationFrame(tick); };
    const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0; paint(); };
    // Under Reduce motion the fill steps with the film's own time updates (they stop when it pauses).
    const onTime = () => { if (reducedMotion()) paint(); };
    const onMeta = () => {
      if (pendingSeek.current === null) return;
      const at = pendingSeek.current;
      pendingSeek.current = null;
      video.currentTime = at;
    };

    motion.addEventListener?.('change', onPrefs);
    window.addEventListener('mm-prefs', onPrefs);
    document.addEventListener('visibilitychange', sync);
    video.addEventListener('playing', run);
    video.addEventListener('pause', halt);
    video.addEventListener('seeked', paint);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    if (!io) sync();
    return () => {
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      motion.removeEventListener?.('change', onPrefs);
      window.removeEventListener('mm-prefs', onPrefs);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('load', onLoad);
      video.removeEventListener('playing', run);
      video.removeEventListener('pause', halt);
      video.removeEventListener('seeked', paint);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.pause();
    };
  }, [start, paint]);

  const play = useCallback(() => {
    wantPlay.current = true;
    setNeedsTap(false);
    start();
  }, [start]);
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else {
      wantPlay.current = false;
      video.pause();
    }
  };
  // Sound on unmutes and plays; sound off only mutes. The first time sound comes on, the film goes back to the start of
  // the chapter on screen, so the narrator's line is heard whole rather than from its middle.
  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      setSoundOn(true);
      if (!heardOnce.current) {
        heardOnce.current = true;
        setHeard(true);
        if (video.readyState >= 1) {
          const { index } = chapterAt(video.currentTime, video.duration, FILM.chapters);
          video.currentTime = FILM.chapters[index].start;
        }
      }
      if (video.paused) play();
    } else {
      video.muted = true;
      setSoundOn(false);
    }
  };
  // A chapter's segment: to its first frame, and play.
  const seek = (index) => {
    const video = videoRef.current;
    if (!video) return;
    const at = FILM.chapters[index].start;
    chapterRef.current = index;
    setChapter(index);
    barRef.current?.style.setProperty('--p', '0');
    if (video.readyState >= 1) {
      pendingSeek.current = null;
      video.currentTime = at;
    } else pendingSeek.current = at;
    play();
  };
  // The chapter bar is one stop for Tab; the arrow keys, Home and End move between its segments.
  const onBarKey = (event) => {
    const from = Number(event.target?.dataset?.index);
    if (!Number.isInteger(from)) return;
    const to = { ArrowRight: from + 1, ArrowLeft: from - 1, Home: 0, End: COUNT - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    segRefs.current[Math.min(COUNT - 1, Math.max(0, to))]?.focus();
  };

  const current = FILM.chapters[chapter];
  return (
    <figure className="lp-film" aria-label={FILM.label} data-playing={playing ? 'true' : 'false'}>
      {/* A tap or click on the picture pauses or plays (a pointer's shortcut; the keys under it do the same for keyboards). */}
      <div ref={frameRef} className="lp-film__frame" onClick={togglePlay}>
        {/* The film's own first frame, the same file as the video's poster, so it is fetched once. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- one fixed poster under 60 KB, shared with the video's poster attribute */}
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
          // A large pointer target on the poster; keyboards and screen readers use the "Play film" key under it.
          <button type="button" className="lp-film__start" onClick={(event) => { event.stopPropagation(); play(); }} tabIndex={-1} aria-hidden="true">
            <Play size={24} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
        {!heard && !needsTap ? (
          // The narrator is muted by default: one small key in the corner until sound has come on once (keyboards and
          // screen readers use the sound key under the frame).
          <button type="button" className="lp-film__unmute" onClick={(event) => { event.stopPropagation(); toggleSound(); }} tabIndex={-1} aria-hidden="true">
            <VolumeX size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>Sound on</span>
          </button>
        ) : null}
      </div>
      <div className="lp-film__keys">
        <button type="button" className="lp-film__key" onClick={togglePlay} aria-label={playing ? 'Pause film' : 'Play film'}>
          {playing ? <Pause size={20} strokeWidth={2} aria-hidden="true" /> : <Play size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
        <div className="lp-film__track">
          <p className="lp-film__now"><span className="lp-sr">{`Chapter ${chapter + 1} of ${COUNT}: `}</span>{current.name}</p>
          <div ref={barRef} className="lp-film__chapters" role="toolbar" aria-label="Chapters" onKeyDown={onBarKey}>
            {FILM.chapters.map((c, i) => (
              <button
                key={c.id}
                ref={(el) => { segRefs.current[i] = el; }}
                type="button"
                className="lp-film__seg"
                data-index={i}
                data-state={i < chapter ? 'past' : i === chapter ? 'current' : 'next'}
                tabIndex={i === chapter ? 0 : -1}
                aria-current={i === chapter ? 'true' : undefined}
                aria-label={`Chapter ${i + 1} of ${COUNT}: ${c.name}`}
                onClick={() => seek(i)}
              >
                <span className="lp-film__rail" aria-hidden="true"><span className="lp-film__fill" /></span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="lp-film__key" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}>
          {soundOn ? <Volume2 size={20} strokeWidth={2} aria-hidden="true" /> : <VolumeX size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>
    </figure>
  );
}
